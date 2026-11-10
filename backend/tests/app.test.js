jest.mock("../utils/nodemailer", () => jest.fn().mockResolvedValue());

const request = require("supertest");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const CompanySettings = require("../models/companySettings");
const Attendance = require("../models/attendance");
const LeaveApplication = require("../models/leaveApplication");
const OvertimeApplication = require("../models/overtimeApplication");
const sendEmail = require("../utils/nodemailer");
const { clearCodes, MAX_ATTEMPTS } = require("../utils/otpStore");

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await User.deleteMany({});
  await Employee.deleteMany({});
  await Settings.deleteMany({});
  await CompanySettings.deleteMany({});
  await Attendance.deleteMany({});
  await LeaveApplication.deleteMany({});
  await OvertimeApplication.deleteMany({});
  clearCodes();
  sendEmail.mockClear();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

// The pre-save hook hashes the password, so tests pass it in plain text
const createUser = (overrides = {}) =>
  User.create({
    username: "employee1",
    password: "Password123!",
    email: "employee1@example.com",
    role: "Employee",
    status: "Active",
    ...overrides,
  });

const loginAs = async (username, password = "Password123!") => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password });
  return res.body.token;
};

describe("GET /", () => {
  it("returns 200", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toBe("API is running...");
  });
});

describe("POST /api/auth/login", () => {
  it("returns a token for an active user with the right password", async () => {
    await createUser();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "employee1", password: "Password123!" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.password).toBeUndefined();
  });

  it("reject a wrong password", async () => {
    await createUser();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "employee1", password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it("gives an unknown username the same reply as a wrong password", async () => {
    await createUser();
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ username: "employee1", password: "wrong" });
    const unknownUser = await request(app)
      .post("/api/auth/login")
      .send({ username: "nobody", password: "wrong" });

    expect(unknownUser.status).toBe(wrongPassword.status);
    expect(unknownUser.body).toEqual(wrongPassword.body);
  });

  it("only says an account is pending once the password is right", async () => {
    await createUser({ status: "Pending" });
    const right = await request(app)
      .post("/api/auth/login")
      .send({ username: "employee1", password: "Password123!" });
    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ username: "employee1", password: "wrong" });

    expect(right.status).toBe(403);
    expect(wrong.status).toBe(401);
  });

  it("rejects a username that isn't text", async () => {
    await createUser();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: { $ne: null }, password: "Password123!" });

    expect(res.status).toBe(400);
    expect(res.body.token).toBeUndefined();
  });
});

describe("Admin-only route guard (GET /api/employee/emloyees)", () => {
  it("return 401 without a token", async () => {
    const res = await request(app).get("/api/employee/employees");
    expect(res.status).toBe(401);
  });

  it("returns 401 with a forged token", async () => {
    const res = await request(app)
      .get("/api/employee/employees")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("returns 403 for an employee", async () => {
    await createUser();
    const token = await loginAs("employee1");

    const res = await request(app)
      .get("/api/employee/employees")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("returns 200 for an admin", async () => {
    await createUser({
      username: "admin1",
      email: "admin1@example.com",
      role: "Super Admin",
    });
    const token = await loginAs("admin1");

    const res = await request(app)
      .get("/api/employee/employees")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("does not return the OTP in the response", async () => {
    await createUser();
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "employee1@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.otp).toBeUndefined();
  });
  it("says an unregistered email isn't registered, and sends nothing", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@example.com" });

    expect(res.status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("makes you wait a minute before another code", async () => {
    await createUser();
    const send = () =>
      request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "employee1@example.com" });

    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(429);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("OTP and password reset", () => {
  // Requests a code and reads it from the mocked email
  const requestCode = async () => {
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "employee1@example.com" });
    return sendEmail.mock.calls.at(-1)[1];
  };

  const sendOtp = (otp) =>
    request(app)
      .post("/api/auth/otp")
      .send({ email: "employee1@example.com", otp });

  it("resets the password with the emailed code", async () => {
    await createUser();
    const otp = await requestCode();

    const verified = await sendOtp(otp);
    expect(verified.status).toBe(200);

    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ resetToken: verified.body.resetToken, password: "NewPass123!" });
    expect(reset.status).toBe(200);
    expect(await loginAs("employee1", "NewPass123!")).toBeDefined();
  });

  it("says how many tries are left after a wrong code", async () => {
    await createUser();
    const otp = await requestCode();
    const wrong = otp === "111111" ? "222222" : "111111";

    const res = await sendOtp(wrong);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      `Incorrect code. ${MAX_ATTEMPTS - 1} tries left.`,
    );
  });

  it("turns away a code that isn't 6 digits without using a try", async () => {
    await createUser();
    const otp = await requestCode();

    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      expect((await sendOtp("12ab")).status).toBe(400);
    }
    expect((await sendOtp(otp)).status).toBe(200);
  });

  it("locks the code after too many wrong tries", async () => {
    await createUser();
    const otp = await requestCode();
    const wrong = otp === "111111" ? "222222" : "111111";

    for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
      expect((await sendOtp(wrong)).status).toBe(400);
    }
    expect((await sendOtp(wrong)).status).toBe(429);
    // Even the right code no longer works
    expect((await sendOtp(otp)).status).toBe(429);
  });

  it("does not accept a reset token as a login", async () => {
    await createUser();
    const verified = await sendOtp(await requestCode());

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${verified.body.resetToken}`);
    expect(res.status).toBe(401);
  });

  it("does not accept a login token as a reset token", async () => {
    await createUser();
    const token = await loginAs("employee1");

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ resetToken: token, password: "Hijacked123!" });
    expect(res.status).toBe(400);
    expect(await loginAs("employee1")).toBeDefined();
  });
});

describe("PUT /api/settings/updateGeneralSettings/:id", () => {
  it("ignores role, status and password sent by an employee", async () => {
    const user = await createUser();
    const token = await loginAs("employee1");

    const res = await request(app)
      .put(`/api/settings/updateGeneralSettings/${user._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        role: "Admin",
        status: "Inactive",
        password: "hacked",
        employee: {},
        settings: {},
      });

    expect(res.status).toBe(200);
    expect(res.body.password).toBeUndefined();

    const saved = await User.findById(user._id);
    expect(saved.role).toBe("Employee");
    expect(saved.status).toBe("Active");
    // The old password still works, so it was not overwritten
    expect(await loginAs("employee1")).toBeDefined();
  });

  it("still lets an employee change their own email", async () => {
    const user = await createUser();
    const token = await loginAs("employee1");

    const res = await request(app)
      .put(`/api/settings/updateGeneralSettings/${user._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "new@example.com", employee: {}, settings: {} });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("new@example.com");
  });

  it("returns 403 when an employee edits someone else", async () => {
    const other = await createUser({
      username: "employee2",
      email: "employee2@example.com",
    });
    await createUser();
    const token = await loginAs("employee1");

    const res = await request(app)
      .put(`/api/settings/updateGeneralSettings/${other._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "Admin", employee: {}, settings: {} });

    expect(res.status).toBe(403);
  });

  it("saves the employee's own profile fields", async () => {
    const user = await createUser();
    await Employee.create({
      userId: user._id,
      firstName: "Juan",
      lastName: "Dela Cruz",
      email: "employee1@example.com",
    });
    const token = await loginAs("employee1");

    const res = await request(app)
      .put(`/api/settings/updateGeneralSettings/${user._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        employee: { contactNumber: "09171234567", address: { city: "Makati" } },
        settings: {},
      });

    expect(res.status).toBe(200);
    expect(res.body.employee.contactNumber).toBe("09171234567");
    expect(res.body.employee.address.city).toBe("Makati");
  });

  it("ignores role, employeeId and userId inside the employee object", async () => {
    const user = await createUser();
    await Employee.create({
      userId: user._id,
      firstName: "Juan",
      lastName: "Dela Cruz",
      email: "employee1@example.com",
      employeeId: "EMP-001",
    });
    const token = await loginAs("employee1");

    const res = await request(app)
      .put(`/api/settings/updateGeneralSettings/${user._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        employee: {
          firstName: "Pedro",
          role: "Admin",
          employeeId: "EMP-999",
          userId: "000000000000000000000000",
        },
        settings: {},
      });

    expect(res.status).toBe(200);

    const saved = await Employee.findOne({ userId: user._id });
    expect(saved.firstName).toBe("Pedro");
    expect(saved.role).not.toBe("Admin");
    expect(saved.employeeId).toBe("EMP-001");
  });

  it("ignores settings, so an employee can't change their job details", async () => {
    const user = await createUser();
    await Settings.create({
      userId: user._id,
      general: { jobDescription: { position: "Staff" } },
    });
    const token = await loginAs("employee1");

    const res = await request(app)
      .put(`/api/settings/updateGeneralSettings/${user._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        employee: {},
        settings: { general: { jobDescription: { position: "CEO" } } },
      });

    expect(res.status).toBe(200);
    const saved = await Settings.findOne({ userId: user._id });
    expect(saved.general.jobDescription.position).toBe("Staff");
  });

  describe("an email another account uses", () => {
    const setupTwo = async () => {
      const user = await createUser();
      await Employee.create({
        userId: user._id,
        firstName: "Juan",
        lastName: "Dela Cruz",
        email: "employee1@example.com",
      });
      await createUser({ username: "employee2", email: "employee2@example.com" });
      const token = await loginAs("employee1");
      const save = (body) =>
        request(app)
          .put(`/api/settings/updateGeneralSettings/${user._id}`)
          .set("Authorization", `Bearer ${token}`)
          .send(body);
      return { user, save };
    };

    it.each([
      [
        "as the account email",
        { email: "Employee2@Example.com", employee: { firstName: "Pedro" } },
      ],
      [
        "as the employee record's email",
        { employee: { firstName: "Pedro", email: "EMPLOYEE2@example.com" } },
      ],
    ])("is refused %s, in another case, and nothing is saved", async (_label, body) => {
      const { user, save } = await setupTwo();

      const res = await save(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email is already registered.");
      expect((await User.findById(user._id)).email).toBe("employee1@example.com");
      const employee = await Employee.findOne({ userId: user._id });
      expect(employee.email).toBe("employee1@example.com");
      expect(employee.firstName).toBe("Juan");
    });

    it("is refused when an admin edits someone else's settings too", async () => {
      const { user } = await setupTwo();
      await createUser({
        username: "admin1",
        email: "admin1@example.com",
        role: "Super Admin",
      });
      const token = await loginAs("admin1");

      const res = await request(app)
        .put(`/api/settings/updateGeneralSettings/${user._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "ADMIN1@example.com", employee: { email: "ADMIN1@example.com" } });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email is already registered.");
      expect((await User.findById(user._id)).email).toBe("employee1@example.com");
    });

    it("lets the account keep its own email in a new case", async () => {
      const { user, save } = await setupTwo();

      const res = await save({
        email: "Employee1@Example.com",
        employee: { email: "Employee1@Example.com" },
      });

      expect(res.status).toBe(200);
      expect((await User.findById(user._id)).email).toBe("Employee1@Example.com");
      expect((await Employee.findOne({ userId: user._id })).email).toBe(
        "Employee1@Example.com",
      );
    });
  });
});

describe("POST /api/auth/signup", () => {
  it("ignores role and status sent in the body", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      firstName: "Eve",
      lastName: "Attacker",
      email: "eve@example.com",
      username: "eve",
      password: "Password123!",
      role: "Admin",
      status: "Active,",
    });

    expect(res.status).toBeLessThan(300);
    const user = await User.findOne({ email: "eve@example.com" });
    expect(user.role).toBe("Employee");
    expect(user.status).toBe("Pending");
  });

  it("refuses an email already registered in another case and creates nothing", async () => {
    await createUser({ email: "test.admin@aceserph.com" });

    const res = await request(app).post("/api/auth/signup").send({
      firstName: "Tess",
      lastName: "Admin",
      email: "Test.Admin@aceserph.com",
      username: "tess",
      password: "Password123!",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Email is already registered.");
    expect(await User.countDocuments()).toBe(1);
    expect(await Employee.countDocuments()).toBe(0);
  });

  it.each([
    ["the same case", "employee1"],
    ["another case", "Employee1"],
  ])(
    "refuses a username already taken in %s with a 400 and creates nothing",
    async (_label, username) => {
      await createUser();

      const res = await request(app).post("/api/auth/signup").send({
        firstName: "Emma",
        lastName: "Ployee",
        email: "emma@example.com",
        username,
        password: "Password123!",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Username is already taken.");
      expect(await User.countDocuments()).toBe(1);
      expect(await Employee.countDocuments()).toBe(0);
      expect(await Settings.countDocuments()).toBe(0);
    },
  );

  it("refuses an email only an employee record still uses, in another case", async () => {
    await Employee.create({
      firstName: "Old",
      lastName: "Record",
      email: "old.record@example.com",
    });

    const res = await request(app).post("/api/auth/signup").send({
      firstName: "New",
      lastName: "Person",
      email: "Old.Record@example.com",
      username: "newperson",
      password: "Password123!",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Email is already registered.");
    expect(await User.countDocuments()).toBe(0);
  });
});

describe("Admin employee profile routes", () => {
  const setup = async () => {
    const employeeUser = await createUser();
    await Employee.create({
      userId: employeeUser._id,
      firstName: "Juan",
      lastName: "Dela Cruz",
      email: "employee1@example.com",
      employeeId: "EMP-001",
    });
    await createUser({
      username: "admin1",
      email: "admin1@example.com",
      role: "Super Admin",
    });
    const token = await loginAs("admin1");
    return { employeeUser, token };
  };

  it("returns the full profile without the password", async () => {
    const { employeeUser, token } = await setup();

    const res = await request(app)
      .get(`/api/employee/employees/${employeeUser._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("employee1");
    expect(res.body.password).toBeUndefined();
    expect(res.body.employee.employeeId).toBe("EMP-001");
    expect(res.body.jobDescription.schedule).toBeDefined();
  });

  it("carries the account's createdAt", async () => {
    const { employeeUser, token } = await setup();

    const res = await request(app)
      .get(`/api/employee/employees/${employeeUser._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("createAt");
    expect(new Date(res.body.createdAt).getTime()).toBe(
      employeeUser.createdAt.getTime(),
    );
  });

  it("finds a username or email taken in another case (check-user-exists)", async () => {
    const { employeeUser, token } = await setup();
    const check = (body) =>
      request(app)
        .post("/api/employee/check-user-exists")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

    const taken = await check({
      username: "EMPLOYEE1",
      email: "Employee1@Example.com",
    });
    expect(taken.status).toBe(200);
    expect(taken.body).toEqual({ email: true, username: true });

    // The same person's own values, in any case, are not taken
    const own = await check({
      username: "Employee1",
      email: "EMPLOYEE1@example.com",
      excludeId: String(employeeUser._id),
    });
    expect(own.body).toEqual({});

    // Whole values only, with dots taken literally
    const partial = await check({
      username: "employee",
      email: "employee1@exampleXcom",
    });
    expect(partial.body).toEqual({});
  });

  it("finds an Employee ID taken in another case (check-user-exists)", async () => {
    const { employeeUser, token } = await setup();
    const check = (body) =>
      request(app)
        .post("/api/employee/check-user-exists")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

    expect((await check({ employeeId: "emp-001" })).body).toEqual({
      employeeId: true,
    });
    expect(
      (await check({ employeeId: "emp-001", excludeId: String(employeeUser._id) }))
        .body,
    ).toEqual({});
  });

  describe("username, email and Employee ID used by someone else", () => {
    // A second employee whose values the first one's edit tries to take
    const setupTwo = async () => {
      const { employeeUser, token } = await setup();
      const other = await createUser({
        username: "employee2",
        email: "employee2@example.com",
      });
      await Employee.create({
        userId: other._id,
        firstName: "Ana",
        lastName: "Santos",
        email: "employee2@example.com",
        employeeId: "EMP-002",
      });
      const edit = (body) =>
        request(app)
          .put(`/api/employee/edit-employee-via-admin/${employeeUser._id}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ contactNumber: "09170000000", ...body });
      return { employeeUser, token, edit };
    };

    const expectNothingSaved = async (employeeUser) => {
      const user = await User.findById(employeeUser._id);
      expect(user.username).toBe("employee1");
      expect(user.email).toBe("employee1@example.com");
      const employee = await Employee.findOne({ userId: employeeUser._id });
      expect(employee.email).toBe("employee1@example.com");
      expect(employee.employeeId).toBe("EMP-001");
      expect(employee.contactNumber).toBeUndefined();
    };

    it.each([
      [{ username: "EMPLOYEE2" }, "Username is already taken."],
      [{ email: "Employee2@Example.com" }, "Email is already registered."],
      [{ employeeId: "emp-002" }, "Employee ID already exists."],
    ])(
      "Edit Employee refuses %j and saves nothing",
      async (body, message) => {
        const { employeeUser, edit } = await setupTwo();

        const res = await edit(body);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe(message);
        await expectNothingSaved(employeeUser);
      },
    );

    it("Edit Employee refuses another account's username even when it is an admin's", async () => {
      const { employeeUser, edit } = await setupTwo();

      const res = await edit({ username: "Admin1" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Username is already taken.");
      await expectNothingSaved(employeeUser);
    });

    it("Edit Employee lets the employee keep their own values in a new case", async () => {
      const { employeeUser, edit } = await setupTwo();

      const res = await edit({
        username: "Employee1",
        email: "Employee1@Example.com",
        employeeId: "emp-001",
      });

      expect(res.status).toBe(200);
      const user = await User.findById(employeeUser._id);
      expect(user.username).toBe("Employee1");
      expect(user.email).toBe("Employee1@Example.com");
      const employee = await Employee.findOne({ userId: employeeUser._id });
      expect(employee.email).toBe("Employee1@Example.com");
      expect(employee.employeeId).toBe("emp-001");
      expect(employee.contactNumber).toBe("09170000000");
    });

    it("Edit Employee stays closed to an employee", async () => {
      const { employeeUser } = await setupTwo();
      const token = await loginAs("employee2");

      const res = await request(app)
        .put(`/api/employee/edit-employee-via-admin/${employeeUser._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ username: "employee1" });

      expect(res.status).toBe(403);
    });

    it.each([
      [{ username: "EMPLOYEE1" }, "Username is already taken."],
      [{ email: "Employee1@Example.com" }, "Email is already registered."],
      [{ employeeId: "emp-001" }, "Employee ID already exists."],
    ])(
      "Add Employee refuses %j and creates nothing",
      async (body, message) => {
        const { token } = await setup();

        const res = await request(app)
          .post("/api/employee/add-employee-via-admin")
          .set("Authorization", `Bearer ${token}`)
          .send({
            firstName: "Ana",
            lastName: "Santos",
            employeeId: "EMP-002",
            email: "ana@example.com",
            username: "ana",
            password: "Password123!",
            employmentType: "Probationary",
            ...body,
          });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe(message);
        expect(await User.countDocuments()).toBe(2);
        expect(await Employee.countDocuments()).toBe(1);
        expect(await Settings.countDocuments()).toBe(0);
      },
    );

    it("Add Employee creates an account whose values are all free", async () => {
      const { token } = await setup();

      const res = await request(app)
        .post("/api/employee/add-employee-via-admin")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "Ana",
          lastName: "Santos",
          employeeId: "EMP-002",
          email: "ana@example.com",
          username: "ana",
          password: "Password123!",
          employmentType: "Probationary",
        });

      expect(res.status).toBe(201);
      expect(await User.exists({ username: "ana" })).toBeTruthy();
    });
  });

  it("returns 404 for an unknown user", async () => {
    const { token } = await setup();

    const res = await request(app)
      .get(`/api/employee/employees/${new mongoose.Types.ObjectId()}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 403 for an employee", async () => {
    const { employeeUser } = await setup();
    const token = await loginAs("employee1");

    const res = await request(app)
      .get(`/api/employee/employees/${employeeUser._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("saves contact and emergency details", async () => {
    const { employeeUser, token } = await setup();

    const res = await request(app)
      .put(`/api/employee/edit-employee-via-admin/${employeeUser._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        contactNumber: "09171234567",
        address: { city: "Makati" },
        emergencyDetails: { contactFirstName: "Maria" },
      });

    expect(res.status).toBe(200);
    const saved = await Employee.findOne({ userId: employeeUser._id });
    expect(saved.contactNumber).toBe("09171234567");
    expect(saved.address.city).toBe("Makati");
    expect(saved.emergencyDetails.contactFirstName).toBe("Maria");
  });

  it("hashes a password reset so the employee can log in with it", async () => {
    const { employeeUser, token } = await setup();

    await request(app)
      .put(`/api/employee/edit-employee-via-admin/${employeeUser._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "NewPass123!" });

    const saved = await User.findById(employeeUser._id);
    expect(saved.password).not.toBe("NewPass123!");
    expect(await loginAs("employee1", "NewPass123!")).toBeDefined();
  });

  it("saves basic pay and the date of regularization", async () => {
    const { employeeUser, token } = await setup();
    await Settings.create({ userId: employeeUser._id });

    const res = await request(app)
      .put(`/api/employee/edit-employee-via-admin/${employeeUser._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        employmentType: "Regular",
        regularizationDate: "2026-10-26",
        basicPay: "25000",
      });

    expect(res.status).toBe(200);
    const profile = await request(app)
      .get(`/api/employee/employees/${employeeUser._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(profile.body.jobDescription.basicPay).toBe(25000);
    expect(profile.body.jobDescription.regularizationDate).toMatch(
      /^2026-10-26/,
    );
  });

  it("rejects a regular employee without a date of regularization and saves nothing", async () => {
    const { employeeUser, token } = await setup();
    await Settings.create({ userId: employeeUser._id });

    const res = await request(app)
      .put(`/api/employee/edit-employee-via-admin/${employeeUser._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ username: "renamed", employmentType: "Regular" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/date of regularization/);
    const user = await User.findById(employeeUser._id);
    expect(user.username).toBe("employee1");
  });

  it("rejects negative basic pay when adding an employee", async () => {
    const { token } = await setup();

    const res = await request(app)
      .post("/api/employee/add-employee-via-admin")
      .set("Authorization", `Bearer ${token}`)
      .send({
        firstName: "Ana",
        lastName: "Santos",
        employeeId: "EMP-002",
        email: "ana@example.com",
        username: "ana",
        password: "Password123!",
        employmentType: "Probationary",
        basicPay: -100,
      });

    expect(res.status).toBe(400);
    expect(await User.findOne({ username: "ana" })).toBeNull();
  });
});

describe("Company settings (/api/settings/company)", () => {
  const createAdmin = () =>
    createUser({
      username: "admin1",
      email: "admin1@example.com",
      role: "Super Admin",
    });

  // Smallest valid PNG header; multer only checks the declared type
  const png = Buffer.from("89504e470d0a1a0a", "hex");

  it("lets an employee read the defaults", async () => {
    await createUser();
    const token = await loginAs("employee1");

    const res = await request(app)
      .get("/api/settings/company")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("");
    expect(res.body.dateFormat).toBe("MM-DD-YYYY");
    expect(res.body.timeFormat).toBe("12 Hour");
  });

  it("returns 403 when an employee saves", async () => {
    await createUser();
    const token = await loginAs("employee1");

    const res = await request(app)
      .put("/api/settings/company")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hacked" });

    expect(res.status).toBe(403);
  });

  it("saves the allowed fields and ignores the rest", async () => {
    await createAdmin();
    const token = await loginAs("admin1");

    const res = await request(app)
      .put("/api/settings/company")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "ACESER Corporation",
        contact: "(02) 8123 4567",
        dateFormat: "YYYY-MM-DD",
        logo: "/uploads/evil.html",
        key: "second",
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("ACESER Corporation");
    expect(res.body.dateFormat).toBe("YYYY-MM-DD");
    expect(res.body.logo).toBe("");
    expect(await CompanySettings.countDocuments()).toBe(1);
  });

  it("returns 400 for an unknown date format", async () => {
    await createAdmin();
    const token = await loginAs("admin1");

    const res = await request(app)
      .put("/api/settings/company")
      .set("Authorization", `Bearer ${token}`)
      .send({ dateFormat: "DD/MM/YY" });

    expect(res.status).toBe(400);
  });

  it("rejects a logo that isn't an image", async () => {
    await createAdmin();
    const token = await loginAs("admin1");

    const res = await request(app)
      .put("/api/settings/company/logo")
      .set("Authorization", `Bearer ${token}`)
      .attach("logo", Buffer.from("<script>alert(1)</script>"), {
        filename: "logo.html",
        contentType: "text/html",
      });

    expect(res.status).toBe(400);
  });

  it("uploads a logo and removes it again", async () => {
    await createAdmin();
    const token = await loginAs("admin1");

    const upload = await request(app)
      .put("/api/settings/company/logo")
      .set("Authorization", `Bearer ${token}`)
      .attach("logo", png, { filename: "logo.png", contentType: "image/png" });

    expect(upload.status).toBe(200);
    expect(upload.body.logo).toMatch(/^\/uploads\/company-logo-\d+\.png$/);
    const filePath = path.join(__dirname, "..", upload.body.logo);
    expect(fs.existsSync(filePath)).toBe(true);

    const remove = await request(app)
      .delete("/api/settings/company/logo")
      .set("Authorization", `Bearer ${token}`);

    expect(remove.status).toBe(200);
    expect(remove.body.logo).toBe("");
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

describe("Signup steps (update-info, created-account)", () => {
  const signup = (email = "new@example.com", username = "newuser") =>
    request(app).post("/api/auth/signup").send({
      firstName: "New",
      lastName: "User",
      email,
      username,
      password: "Password123!",
    });

  const info = {
    birthday: "1995-05-05",
    contactNumber: "09170000000",
    gender: "Female",
    contactFirstName: "Ana",
    contactLastName: "Cruz",
    contactEmergency: "09171111111",
    contactAddress: "Manila",
  };

  it("returns 401 without the signup token", async () => {
    await signup();

    const res = await request(app)
      .post("/api/employee/update-info")
      .send({ email: "new@example.com", ...info });

    expect(res.status).toBe(401);
    const employee = await Employee.findOne({ email: "new@example.com" });
    expect(employee.contactNumber).toBe("");
  });

  it("updates only the token's own employee, whatever email is sent", async () => {
    await signup("other@example.com", "other");
    const { signupToken } = (await signup()).body;

    const res = await request(app)
      .post("/api/employee/update-info")
      .set("Authorization", `Bearer ${signupToken}`)
      .send({ email: "other@example.com", ...info });

    expect(res.status).toBe(200);
    const own = await Employee.findOne({ email: "new@example.com" });
    const other = await Employee.findOne({ email: "other@example.com" });
    expect(own.contactNumber).toBe(info.contactNumber);
    expect(other.contactNumber).toBe("");
  });

  it("returns 403 once the account is approved", async () => {
    const { signupToken } = (await signup()).body;
    await User.updateOne({ email: "new@example.com" }, { status: "Active" });

    const res = await request(app)
      .post("/api/employee/update-info")
      .set("Authorization", `Bearer ${signupToken}`)
      .send(info);

    expect(res.status).toBe(403);
  });

  it("can't be used as a login token", async () => {
    const { signupToken } = (await signup()).body;
    await User.updateOne({ email: "new@example.com" }, { status: "Active" });

    const res = await request(app)
      .get("/api/filing/user-leave-requests")
      .set("Authorization", `Bearer ${signupToken}`);

    expect(res.status).toBe(401);
  });

  it("only shows the token's own account on Created Account", async () => {
    await signup("other@example.com", "other");
    const { signupToken } = (await signup()).body;
    const other = await Employee.findOne({ email: "other@example.com" });

    const res = await request(app)
      .get(`/api/employee/created-account/${other._id}`)
      .set("Authorization", `Bearer ${signupToken}`);

    expect(res.status).toBe(404);
  });
});

describe("Employee filing changes (Pending only, own overtime days)", () => {
  let employee;
  let token;

  beforeEach(async () => {
    employee = await createUser();
    token = await loginAs("employee1");
  });

  const createLeave = (status = "Pending", userId = employee._id) =>
    LeaveApplication.create({
      userId,
      leaveType: "Vacation Leave",
      leaveDetails: "Family trip",
      startDate: "2026-10-26",
      endDate: "2026-10-27",
      status,
    });

  // 08:00-20:00 makes the day eligible for overtime (the pre-save hook works it out)
  const createOvertimeDay = (userId = employee._id, date = "2026-10-05") =>
    Attendance.create({
      userId,
      date,
      timeIn: new Date(`${date}T08:00:00Z`),
      timeOut: new Date(`${date}T20:00:00Z`),
    });

  it("still lets an employee edit a Pending leave", async () => {
    const leave = await createLeave();

    const res = await request(app)
      .patch(`/api/filing/edit-leave/${leave._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ leaveDetails: "Changed" });

    expect(res.status).toBe(200);
    expect(res.body.leaveDetails).toBe("Changed");
  });

  it("returns 409 when editing an Approved leave", async () => {
    const leave = await createLeave("Approved");

    const res = await request(app)
      .patch(`/api/filing/edit-leave/${leave._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ leaveDetails: "Changed" });

    expect(res.status).toBe(409);
    const saved = await LeaveApplication.findById(leave._id);
    expect(saved.leaveDetails).toBe("Family trip");
  });

  it("returns 409 when deleting a Disapproved leave", async () => {
    const leave = await createLeave("Disapproved");

    const res = await request(app)
      .delete(`/api/filing/leave/${leave._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(await LeaveApplication.exists({ _id: leave._id })).toBeTruthy();
  });

  it("returns 404 for someone else's leave", async () => {
    const other = await createUser({
      username: "employee2",
      email: "employee2@example.com",
    });
    const leave = await createLeave("Pending", other._id);

    const res = await request(app)
      .delete(`/api/filing/leave/${leave._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 409 when deleting an Approved overtime and keeps the day filed", async () => {
    const day = await createOvertimeDay();
    await Attendance.updateOne({ _id: day._id }, { "overtime.isFiled": true });
    const overtime = await OvertimeApplication.create({
      userId: employee._id,
      attendanceId: day._id,
      selectedOvertime: "2026-10-05",
      end: "20:00",
      status: "Approved",
    });

    const res = await request(app)
      .delete(`/api/filing/overtime/${overtime._id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
    const saved = await Attendance.findById(day._id);
    expect(saved.overtime.isFiled).toBe(true);
  });

  it("rejects overtime filed against someone else's attendance day", async () => {
    const other = await createUser({
      username: "employee2",
      email: "employee2@example.com",
    });
    const otherDay = await createOvertimeDay(other._id);

    const res = await request(app)
      .post("/api/filing/apply-overtime")
      .set("Authorization", `Bearer ${token}`)
      .send({
        attendanceId: otherDay._id,
        selectedOvertime: "2026-10-05",
        end: "20:00",
      });

    expect(res.status).toBe(400);
    const saved = await Attendance.findById(otherDay._id);
    expect(saved.overtime.isFiled).toBe(false);
  });

  it("rejects an edit that moves overtime to someone else's day", async () => {
    const ownDay = await createOvertimeDay();
    const other = await createUser({
      username: "employee2",
      email: "employee2@example.com",
    });
    const otherDay = await createOvertimeDay(other._id);
    const overtime = await OvertimeApplication.create({
      userId: employee._id,
      attendanceId: ownDay._id,
      selectedOvertime: "2026-10-05",
      end: "20:00",
    });

    const res = await request(app)
      .patch(`/api/filing/edit-overtime/${overtime._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        attendanceId: otherDay._id,
        selectedOvertime: "2026-10-05",
        end: "20:00",
      });

    expect(res.status).toBe(400);
    const saved = await Attendance.findById(otherDay._id);
    expect(saved.overtime.isFiled).toBe(false);
  });
});

describe("Profile photo upload (/api/settings/users/:id/profile-photo)", () => {
  const png = Buffer.from("89504e470d0a1a0a", "hex");

  it("rejects a file that isn't an image", async () => {
    const user = await createUser();
    const token = await loginAs("employee1");

    const res = await request(app)
      .put(`/api/settings/users/${user._id}/profile-photo`)
      .set("Authorization", `Bearer ${token}`)
      .attach("profilePhoto", Buffer.from("<script>alert(1)</script>"), {
        filename: "photo.html",
        contentType: "text/html",
      });

    expect(res.status).toBe(400);
    const saved = await User.findById(user._id);
    expect(saved.profilePhoto || "").not.toMatch(/\.html$/);
  });

  it("rejects an image over 2 MB", async () => {
    const user = await createUser();
    const token = await loginAs("employee1");

    const res = await request(app)
      .put(`/api/settings/users/${user._id}/profile-photo`)
      .set("Authorization", `Bearer ${token}`)
      .attach("profilePhoto", Buffer.alloc(2 * 1024 * 1024 + 1), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/2 MB/);
  });

  it("names the file from its image type, not the uploaded name", async () => {
    const user = await createUser();
    const token = await loginAs("employee1");

    const res = await request(app)
      .put(`/api/settings/users/${user._id}/profile-photo`)
      .set("Authorization", `Bearer ${token}`)
      .attach("profilePhoto", png, {
        filename: "photo.html",
        contentType: "image/png",
      });

    expect(res.status).toBe(200);
    expect(res.body.profilePhoto).toMatch(
      /^\/uploads\/profile-photo-\d+\.png$/,
    );
    const filePath = path.join(__dirname, "..", res.body.profilePhoto);
    expect(fs.existsSync(filePath)).toBe(true);
    fs.unlinkSync(filePath);
  });
});

describe("Attendance in login and /me", () => {
  it("sends dates as YYYY-MM-DD and times as HH:MM:SS", async () => {
    const user = await createUser();
    await Attendance.create({
      userId: user._id,
      date: "2026-10-22",
      timeIn: new Date("2026-10-22T08:03:00Z"),
      timeOut: new Date("2026-10-22T17:30:15Z"),
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ username: "employee1", password: "Password123!" });
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.token}`);

    for (const res of [login, me]) {
      expect(res.status).toBe(200);
      const [record] = res.body.user.attendance;
      expect(record.date).toBe("2026-10-22");
      expect(record.timeIn).toBe("08:03:00");
      expect(record.timeOut).toBe("17:30:15");
    }
  });
});

describe("Resign and reinstate (/api/employee/employees/:userId)", () => {
  const setup = async () => {
    const employeeUser = await createUser();
    await Employee.create({
      userId: employeeUser._id,
      firstName: "Juan",
      lastName: "Dela Cruz",
      email: "employee1@example.com",
      employeeId: "EMP-001",
    });
    await Settings.create({
      userId: employeeUser._id,
      general: { jobDescription: { startDate: new Date("2026-01-05") } },
    });
    const admin = await createUser({
      username: "admin1",
      email: "admin1@example.com",
      role: "Super Admin",
    });
    const token = await loginAs("admin1");
    return { employeeUser, admin, token };
  };

  const resign = (userId, token, body) =>
    request(app)
      .patch(`/api/employee/employees/${userId}/resign`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const reinstate = (userId, token) =>
    request(app)
      .patch(`/api/employee/employees/${userId}/reinstate`)
      .set("Authorization", `Bearer ${token}`);

  it("marks the employee resigned, keeps the date and reason, and blocks their login", async () => {
    const { employeeUser, token } = await setup();
    const employeeToken = await loginAs("employee1");

    const res = await resign(employeeUser._id, token, {
      resignationDate: "2026-10-30",
      resignationReason: "Moving abroad",
    });

    expect(res.status).toBe(200);
    expect((await User.findById(employeeUser._id)).status).toBe("Resigned");
    const settings = await Settings.findOne({ userId: employeeUser._id });
    expect(settings.general.jobDescription.resignationReason).toBe(
      "Moving abroad",
    );

    const login = await request(app)
      .post("/api/auth/login")
      .send({ username: "employee1", password: "Password123!" });
    expect(login.status).toBe(403);
    expect(login.body.message).toMatch(/no longer active/);

    // A session opened before the resignation stops working too
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(me.status).toBe(401);
  });

  it("lists resigned employees only when asked", async () => {
    const { employeeUser, token } = await setup();
    await resign(employeeUser._id, token, { resignationDate: "2026-10-30" });

    const active = await request(app)
      .get("/api/employee/employees")
      .set("Authorization", `Bearer ${token}`);
    expect(active.body).toHaveLength(0);

    const all = await request(app)
      .get("/api/employee/employees?includeResigned=true")
      .set("Authorization", `Bearer ${token}`);
    expect(all.body).toHaveLength(1);
    expect(all.body[0].status).toBe("Resigned");
  });

  it("rejects a bad date, a second resignation and the admin's own account", async () => {
    const { employeeUser, admin, token } = await setup();

    const before = await resign(employeeUser._id, token, {
      resignationDate: "2025-12-31",
    });
    expect(before.status).toBe(400);
    expect(before.body.message).toMatch(/before the start date/);

    await resign(employeeUser._id, token, { resignationDate: "2026-10-30" });
    const again = await resign(employeeUser._id, token, {
      resignationDate: "2026-10-30",
    });
    expect(again.status).toBe(409);

    const self = await resign(admin._id, token, {
      resignationDate: "2026-10-30",
    });
    expect(self.status).toBe(400);
  });

  it("reinstates a resigned employee and clears the resignation", async () => {
    const { employeeUser, token } = await setup();
    await resign(employeeUser._id, token, { resignationDate: "2026-10-30" });

    const res = await reinstate(employeeUser._id, token);

    expect(res.status).toBe(200);
    expect((await User.findById(employeeUser._id)).status).toBe("Active");
    const settings = await Settings.findOne({ userId: employeeUser._id });
    expect(settings.general.jobDescription.resignationDate).toBeNull();
    expect(await loginAs("employee1")).toBeDefined();

    expect((await reinstate(employeeUser._id, token)).status).toBe(409);
  });

  it("returns 403 for an employee", async () => {
    const { employeeUser } = await setup();
    const employeeToken = await loginAs("employee1");

    const res = await resign(employeeUser._id, employeeToken, {
      resignationDate: "2026-10-30",
    });
    expect(res.status).toBe(403);
  });

  it("doesn't let the approve route reactivate a resigned employee", async () => {
    const { employeeUser, token } = await setup();
    await resign(employeeUser._id, token, { resignationDate: "2026-10-30" });

    const res = await request(app)
      .put(`/api/auth/users/${employeeUser._id}/status`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect((await User.findById(employeeUser._id)).status).toBe("Resigned");
  });
});

describe("Leave credits (VL and SL)", () => {
  // Regularized 2026-01-05: 15 VL for 2026, 15 SL each month
  const setup = async ({ regularizationDate = "2026-01-05" } = {}) => {
    const employeeUser = await createUser();
    await Settings.create({
      userId: employeeUser._id,
      general: {
        jobDescription: {
          startDate: new Date("2025-07-01"),
          regularizationDate:
            regularizationDate && new Date(regularizationDate),
        },
      },
    });
    const admin = await createUser({
      username: "admin1",
      email: "admin1@example.com",
      role: "Super Admin",
    });
    return {
      employeeUser,
      admin,
      token: await loginAs("employee1"),
      adminToken: await loginAs("admin1"),
    };
  };

  const apply = (token, body) =>
    request(app)
      .post("/api/filing/apply-leave")
      .set("Authorization", `Bearer ${token}`)
      .send({ leaveDetails: "Family trip", ...body });

  it("accepts VL that fits and refuses VL over the balance", async () => {
    const { token } = await setup();

    // Nov 2-20: 15 weekdays
    const fits = await apply(token, {
      leaveType: "Vacation Leave",
      startDate: "2026-11-02",
      endDate: "2026-11-20",
    });
    expect(fits.status).toBe(201);

    // The pending request holds all 15 days
    const over = await apply(token, {
      leaveType: "Vacation Leave",
      startDate: "2026-11-23",
      endDate: "2026-11-23",
    });
    expect(over.status).toBe(400);
    expect(over.body.error).toBe(
      "Not enough Vacation Leave: 0 days left, and this request needs 1.",
    );
    expect(await LeaveApplication.countDocuments()).toBe(1);
  });

  it("refuses VL and SL before regularization, but not other leave types", async () => {
    const { token } = await setup({ regularizationDate: null });

    const sick = await apply(token, {
      leaveType: "Sick Leave",
      startDate: "2026-11-02",
      endDate: "2026-11-02",
    });
    expect(sick.status).toBe(400);
    expect(sick.body.error).toMatch(/date of regularization/);

    const other = await apply(token, {
      leaveType: "Maternity Leave",
      startDate: "2026-11-02",
      endDate: "2026-12-31",
    });
    expect(other.status).toBe(201);
  });

  it("refuses dates that are missing or the wrong way round", async () => {
    const { token } = await setup();

    const res = await apply(token, {
      leaveType: "Vacation Leave",
      startDate: "2026-11-05",
      endDate: "2026-11-02",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("The end date can't be before the start date.");
  });

  it("checks an edit that changes the dates, leaving out the request itself", async () => {
    const { employeeUser, token } = await setup();
    const leave = await LeaveApplication.create({
      userId: employeeUser._id,
      leaveType: "Vacation Leave",
      leaveDetails: "Family trip",
      startDate: "2026-11-02",
      endDate: "2026-11-20",
    });
    const edit = (body) =>
      request(app)
        .patch(`/api/filing/edit-leave/${leave._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(body);

    // Still 15 days: fits, because its own days aren't counted twice
    expect((await edit({ endDate: "2026-11-20" })).status).toBe(200);

    const over = await edit({ endDate: "2026-11-23" });
    expect(over.status).toBe(400);
    expect(over.body.error).toMatch(/Not enough Vacation Leave/);
    const saved = await LeaveApplication.findById(leave._id);
    expect(saved.endDate.toISOString().slice(0, 10)).toBe("2026-11-20");
  });

  it("refuses to approve SL over the month's 15 days and leaves it Pending", async () => {
    const { employeeUser, adminToken } = await setup();
    const sick = (startDate, endDate, status) =>
      LeaveApplication.create({
        userId: employeeUser._id,
        leaveType: "Sick Leave",
        leaveDetails: "Flu",
        startDate,
        endDate,
        status,
      });
    // 14 approved days in November, then a 2-day request filed before credits were checked
    await sick("2026-11-02", "2026-11-19", "Approved");
    const pending = await sick("2026-11-26", "2026-11-27", "Pending");

    const res = await request(app)
      .patch(`/api/filing/leave/${pending._id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Approved" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Not enough Sick Leave for November 2026/);
    expect((await LeaveApplication.findById(pending._id)).status).toBe(
      "Pending",
    );
  });

  it("returns the balance to the employee and the admin, with the opening balance", async () => {
    const { employeeUser, token, adminToken } = await setup();
    await Settings.updateOne(
      { userId: employeeUser._id },
      { "general.jobDescription.vacationLeaveOpening": 4 },
    );
    await LeaveApplication.create({
      userId: employeeUser._id,
      leaveType: "Vacation Leave",
      leaveDetails: "Family trip",
      startDate: "2026-05-04",
      endDate: "2026-05-08",
      status: "Approved",
    });

    const own = await request(app)
      .get("/api/filing/leave-credits")
      .set("Authorization", `Bearer ${token}`);
    expect(own.status).toBe(200);
    expect(own.body.vacation).toMatchObject({ used: 5, pending: 0 });
    expect(own.body.vacation.available).toBe(own.body.vacation.earned - 5);
    expect(own.body.vacation.earned).toBeGreaterThanOrEqual(19);

    const asAdmin = await request(app)
      .get(`/api/filing/leave-credits/${employeeUser._id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body).toEqual(own.body);

    const notAdmin = await request(app)
      .get(`/api/filing/leave-credits/${employeeUser._id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(notAdmin.status).toBe(403);
  });
});
