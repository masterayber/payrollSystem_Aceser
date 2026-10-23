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

    expect(res.status).toBe(400);
    expect(res.body.token).toBeUndefined();
  });

  it("rejects an account pending approval", async () => {
    await createUser({ status: "Pending" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "employee1", password: "Password123!" });

    expect(res.status).toBe(403);
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
      role: "Admin",
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
      role: "Admin",
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
});

describe("Company settings (/api/settings/company)", () => {
  const createAdmin = () =>
    createUser({
      username: "admin1",
      email: "admin1@example.com",
      role: "Admin",
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
