// Sign-in replies (Friday batch, Group 1):
// - POST /api/auth/login and GET /api/auth/me never carry the reset token (nor the
//   password hash or the retired createdBySuperAdmin field).
// - Both replies show the caller's own pay flag tidied by ownSettings
//   (utils/payVisibility.js): `payNotSet: true` for a stored flag or no basic pay,
//   otherwise no `payNotSet` key.
// - A server error in routes/auth.js or routes/employee.js answers with its plain
//   message only: no `error` key and no raw error text; the error is logged on the
//   server with console.error.
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  jest.restoreAllMocks();
  await User.deleteMany({});
  await Employee.deleteMany({});
  await Settings.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const PASSWORD = "Password123!";
const RESET_SECRET = "reset-token-secret";
const RAW_DETAIL = "raw-database-detail-xyz";

const as = (token) => ({ Authorization: `Bearer ${token}` });

const login = (username) =>
  request(app).post("/api/auth/login").send({ username, password: PASSWORD });

const loginAs = async (username) => {
  const res = await login(username);
  expect(res.status).toBe(200);
  return res.body.token;
};

const me = (token) => request(app).get("/api/auth/me").set(as(token));

// An account, with an Employee and Settings record unless `job` is false (an Admin
// account has neither)
const account = async (username, { role = "Employee", job, status = "Active" } = {}) => {
  const user = await User.create({
    username,
    password: PASSWORD,
    email: `${username}@example.com`,
    role,
    status,
  });
  if (job !== false) {
    await Employee.create({
      userId: user._id,
      firstName: username,
      lastName: "Test",
      employeeId: `EMP-${username}`,
      email: `${username}@example.com`,
      role,
    });
    await Settings.create({
      userId: user._id,
      general: { jobDescription: { employmentType: "Regular", ...job } },
    });
  }
  return user;
};

// Stores a reset token and the retired field straight in the collection, as an
// older record or a Forgot password run would leave them
const withPrivateFields = (user) =>
  User.collection.updateOne(
    { _id: user._id },
    { $set: { resetToken: RESET_SECRET, createdBySuperAdmin: true } },
  );

const expectNoPrivateFields = (replyUser) => {
  expect(replyUser).toBeDefined();
  expect(replyUser).not.toHaveProperty("resetToken");
  expect(replyUser).not.toHaveProperty("password");
  expect(replyUser).not.toHaveProperty("createdBySuperAdmin");
  expect(JSON.stringify(replyUser)).not.toMatch(
    new RegExp(`${RESET_SECRET}|\\$2[aby]\\$`),
  );
};

describe("Sign-in and /me carry no reset token", () => {
  it("leaves it out for an Employee, on both replies", async () => {
    const ana = await account("ana");
    await withPrivateFields(ana);

    const signIn = await login("ana");
    expect(signIn.status).toBe(200);
    expectNoPrivateFields(signIn.body.user);
    expect(signIn.body.user.username).toBe("ana");

    const refresh = await me(signIn.body.token);
    expect(refresh.status).toBe(200);
    expectNoPrivateFields(refresh.body.user);
    expect(refresh.body.user.username).toBe("ana");
  });

  it("leaves it out for an Admin and the Super Admin too", async () => {
    for (const [username, role] of [
      ["hr", "Admin"],
      ["boss", "Super Admin"],
    ]) {
      const user = await account(username, { role, job: false });
      await withPrivateFields(user);

      const signIn = await login(username);
      expect(signIn.status).toBe(200);
      expectNoPrivateFields(signIn.body.user);
      expect(signIn.body.user.role).toBe(role);

      const refresh = await me(signIn.body.token);
      expect(refresh.status).toBe(200);
      expectNoPrivateFields(refresh.body.user);
    }
  });

  it("keeps the fields the screens read: an Admin's linkedEmployeeId, pageAccess, role and mustChangePassword", async () => {
    const ana = await account("ana");
    const hr = await account("hr", { role: "Admin", job: false });
    await User.updateOne(
      { _id: hr._id },
      { linkedEmployeeId: ana._id, pageAccess: ["employees"] },
    );
    await withPrivateFields(hr);

    const signIn = await login("hr");
    expect(signIn.status).toBe(200);
    const refresh = await me(signIn.body.token);
    expect(refresh.status).toBe(200);

    for (const replyUser of [signIn.body.user, refresh.body.user]) {
      expectNoPrivateFields(replyUser);
      expect(String(replyUser.linkedEmployeeId)).toBe(String(ana._id));
      expect(replyUser.pageAccess).toEqual(["employees"]);
      expect(replyUser.role).toBe("Admin");
      expect(replyUser.mustChangePassword).toBe(false);
      expect(Array.isArray(replyUser.allowedPages)).toBe(true);
    }
  });

  it("leaves the stored reset token in place (only the reply drops it)", async () => {
    const ana = await account("ana");
    await withPrivateFields(ana);

    await me(await loginAs("ana"));

    expect((await User.collection.findOne({ _id: ana._id })).resetToken).toBe(
      RESET_SECRET,
    );
  });
});

describe("Sign-in and /me show the own pay flag tidied (ownSettings)", () => {
  const jobsOf = async (username) => {
    const signIn = await login(username);
    expect(signIn.status).toBe(200);
    const refresh = await me(signIn.body.token);
    expect(refresh.status).toBe(200);
    return [
      signIn.body.user.settings.general.jobDescription,
      refresh.body.user.settings.general.jobDescription,
    ];
  };

  it("marks a self sign-up's starting 0 (stored flag) with payNotSet: true", async () => {
    await account("fran", { job: { basicPay: 0, payNotSet: true } });

    for (const job of await jobsOf("fran")) {
      expect(job).toMatchObject({ basicPay: 0, payNotSet: true });
    }
  });

  it("marks no basic pay with payNotSet: true, though the stored flag is false", async () => {
    await account("fay", { job: {} });
    const stored = await Settings.findOne({}).lean();
    expect(stored.general.jobDescription.payNotSet).toBe(false);
    expect(stored.general.jobDescription.basicPay).toBeNull();

    for (const job of await jobsOf("fay")) {
      expect(job).toMatchObject({ basicPay: null, payNotSet: true });
    }
  });

  it("leaves the key out for a set pay (no stored payNotSet: false)", async () => {
    await account("ben", { job: { basicPay: 20000, payNotSet: false } });

    for (const job of await jobsOf("ben")) {
      expect(job.basicPay).toBe(20000);
      expect(job).not.toHaveProperty("payNotSet");
      expect(job).not.toHaveProperty("payHidden");
    }
  });

  it("changes nothing stored", async () => {
    const fay = await account("fay", { job: {} });

    await jobsOf("fay");

    const stored = await Settings.findOne({ userId: fay._id }).lean();
    expect(stored.general.jobDescription.payNotSet).toBe(false);
  });

  it("sends settings: null for an Admin account, which has no Settings record", async () => {
    await account("hr", { role: "Admin", job: false });

    const signIn = await login("hr");
    expect(signIn.status).toBe(200);
    expect(signIn.body.user.settings).toBeNull();

    const refresh = await me(signIn.body.token);
    expect(refresh.body.user.settings).toBeNull();
  });
});

// ---- No error details in error replies ----

// Makes `Model[method]` throw a database-style error carrying RAW_DETAIL. A throw (not a
// rejected promise) works whatever the route chains after the call (.select, .lean).
const breakCall = (Model, method) =>
  jest.spyOn(Model, method).mockImplementation(() => {
    throw new Error(RAW_DETAIL);
  });

const expectPlainServerError = (res, message, logSpy) => {
  expect(res.status).toBe(500);
  expect(res.body).toEqual({ message });
  expect(res.body).not.toHaveProperty("error");
  expect(JSON.stringify(res.body)).not.toContain(RAW_DETAIL);
  // Logged on the server instead
  expect(logSpy).toHaveBeenCalled();
  expect(
    logSpy.mock.calls.some((args) =>
      args.some((arg) => String(arg?.message ?? arg).includes(RAW_DETAIL)),
    ),
  ).toBe(true);
};

const quietLog = () => jest.spyOn(console, "error").mockImplementation(() => {});

describe("routes/auth.js: no error details in a 500 reply", () => {
  it("POST /login", async () => {
    await account("ana");
    const log = quietLog();
    breakCall(User, "findOne");

    expectPlainServerError(await login("ana"), "Server error", log);
  });

  it("POST /signup", async () => {
    const log = quietLog();
    breakCall(User, "exists");

    const res = await request(app).post("/api/auth/signup").send({
      firstName: "New",
      lastName: "Person",
      email: "new@example.com",
      username: "newperson",
      password: PASSWORD,
    });

    expectPlainServerError(res, "Server error", log);
    expect(await User.countDocuments({})).toBe(0);
  });

  it("POST /forgot-password", async () => {
    const log = quietLog();
    breakCall(User, "findOne");

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "ana@example.com" });

    expectPlainServerError(res, "Server error. Please try again later", log);
  });

  it("POST /change-password", async () => {
    await account("ana");
    const token = await loginAs("ana");
    const log = quietLog();
    breakCall(bcrypt, "compare");

    const res = await request(app)
      .post("/api/auth/change-password")
      .set(as(token))
      .send({ currentPassword: PASSWORD, newPassword: "Another123!" });

    expectPlainServerError(res, "Server error", log);
  });

  it("GET /me", async () => {
    await account("ana");
    const token = await loginAs("ana");
    const log = quietLog();
    breakCall(Employee, "findOne");

    expectPlainServerError(await me(token), "Server error", log);
  });

  it("GET /pending-users (Super Admin)", async () => {
    await account("boss", { role: "Super Admin", job: false });
    const token = await loginAs("boss");
    const log = quietLog();
    breakCall(User, "find");

    const res = await request(app).get("/api/auth/pending-users").set(as(token));

    expectPlainServerError(res, "Server error", log);
  });
});

describe("routes/employee.js: no error details in a 500 reply", () => {
  const OTHER_ID = () => new mongoose.Types.ObjectId().toString();

  const superAdmin = async () => {
    await account("boss", { role: "Super Admin", job: false });
    return loginAs("boss");
  };

  it("GET /employees", async () => {
    const token = await superAdmin();
    const log = quietLog();
    breakCall(Employee, "aggregate");

    const res = await request(app).get("/api/employee/employees").set(as(token));

    expectPlainServerError(res, "Error fetching employees", log);
  });

  it("GET /employees/:userId", async () => {
    const token = await superAdmin();
    const log = quietLog();
    breakCall(Employee, "findOne");

    const res = await request(app)
      .get(`/api/employee/employees/${OTHER_ID()}`)
      .set(as(token));

    expectPlainServerError(res, "Error fetching employee", log);
  });

  describe("the sign-up steps (signup token)", () => {
    const signupToken = async () => {
      const pending = await account("newbie", { status: "Pending" });
      return jwt.sign(
        { userId: pending._id, purpose: "signup" },
        process.env.JWT_SECRET,
        { expiresIn: "30m" },
      );
    };

    it("POST /update-info", async () => {
      const token = await signupToken();
      const log = quietLog();
      breakCall(Employee, "findOne");

      const res = await request(app)
        .post("/api/employee/update-info")
        .set(as(token))
        .send({ birthday: "2000-01-01", gender: "Female" });

      expectPlainServerError(res, "Server error. Please try again later", log);
    });

    it("GET /created-account/:id", async () => {
      const token = await signupToken();
      const log = quietLog();
      breakCall(Employee, "findOne");

      const res = await request(app)
        .get(`/api/employee/created-account/${OTHER_ID()}`)
        .set(as(token));

      expectPlainServerError(res, "Server error. Please try again later.", log);
    });
  });

  it("DELETE /delete-employee/:employeeId", async () => {
    const token = await superAdmin();
    const log = quietLog();
    breakCall(Employee, "findOne");

    const res = await request(app)
      .delete("/api/employee/delete-employee/AC-001")
      .set(as(token));

    expectPlainServerError(res, "Internal server error", log);
  });

  it("PATCH /employees/:userId/resign", async () => {
    const token = await superAdmin();
    const log = quietLog();
    breakCall(User, "exists");

    const res = await request(app)
      .patch(`/api/employee/employees/${OTHER_ID()}/resign`)
      .set(as(token))
      .send({ resignationDate: "2026-11-13", resignationReason: "Moving" });

    expectPlainServerError(res, "Failed to mark as resigned", log);
  });

  it("PATCH /employees/:userId/reinstate", async () => {
    const token = await superAdmin();
    const log = quietLog();
    breakCall(User, "exists");

    const res = await request(app)
      .patch(`/api/employee/employees/${OTHER_ID()}/reinstate`)
      .set(as(token));

    expectPlainServerError(res, "Failed to reinstate", log);
  });

  it("POST /add-employee-via-admin", async () => {
    const token = await superAdmin();
    const log = quietLog();
    breakCall(User, "exists");

    const res = await request(app)
      .post("/api/employee/add-employee-via-admin")
      .set(as(token))
      .send({
        firstName: "Rico",
        lastName: "Test",
        employeeId: "AC-001",
        email: "rico@example.com",
        username: "rico",
        password: "Rico2026x",
        employmentType: "Probationary",
        startDate: "2026-11-02",
        basicPay: 20000,
      });

    expectPlainServerError(res, "Internal Server Error", log);
    expect(await User.countDocuments({ username: "rico" })).toBe(0);
  });

  it("PUT /edit-employee-via-admin/:id", async () => {
    const token = await superAdmin();
    const ana = await account("ana", { job: { basicPay: 20000 } });
    const log = quietLog();
    breakCall(Settings, "findOne");

    const res = await request(app)
      .put(`/api/employee/edit-employee-via-admin/${ana._id}`)
      .set(as(token))
      .send({ position: "Staff" });

    expectPlainServerError(res, "Failed to update employee", log);
  });

  it("still answers an Employee with 403 before reaching the route (role check)", async () => {
    await account("ana");
    const token = await loginAs("ana");
    const log = quietLog();
    breakCall(Employee, "aggregate");

    const res = await request(app).get("/api/employee/employees").set(as(token));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Admin access required" });
    expect(log).not.toHaveBeenCalled();
  });
});
