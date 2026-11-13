// No error details in error replies (Friday batch, Group 2; decision 2). A server error
// in routes/settings.js, routes/admins.js or the shared guards in
// middleware/accessMiddleware.js (loadCurrentUser, on every signed-in route, and
// requireSignupToken) answers with its plain message only: no `error` key and no raw
// error text. The error is logged on the server with console.error instead.
// Group 1's cases for auth.js and employee.js are in signInReplies.test.js.
const request = require("supertest");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const CompanySettings = require("../models/companySettings");

const UPLOAD_DIR = path.join(__dirname, "../uploads");

let mongo;
let uploadsBefore;

const uploadNames = () =>
  new Set(fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : []);

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

beforeEach(() => {
  uploadsBefore = uploadNames();
});

afterEach(async () => {
  jest.restoreAllMocks();
  // Files a test's upload left behind
  for (const name of uploadNames()) {
    if (!uploadsBefore.has(name)) fs.unlinkSync(path.join(UPLOAD_DIR, name));
  }
  await User.deleteMany({});
  await Employee.deleteMany({});
  await Settings.deleteMany({});
  await CompanySettings.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const PASSWORD = "Password123!";
const RAW_DETAIL = "raw-database-detail-xyz";

const as = (token) => ({ Authorization: `Bearer ${token}` });

const loginAs = async (username) => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
};

// An account, with an Employee and Settings record for the Employee role (an Admin
// account and the main account here have neither)
const account = async (username, { role = "Employee", status = "Active" } = {}) => {
  const user = await User.create({
    username,
    password: PASSWORD,
    email: `${username}@example.com`,
    role,
    status,
  });
  if (role === "Employee") {
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
      general: { jobDescription: { employmentType: "Regular" } },
    });
  }
  return user;
};

const superAdmin = async () => {
  const user = await account("boss", { role: "Super Admin" });
  return { user, token: await loginAs("boss") };
};

// Makes `target[method]` throw a database-style error carrying RAW_DETAIL. A throw (not a
// rejected promise) works whatever the route chains after the call (.select, .lean).
const breakCall = (target, method) =>
  jest.spyOn(target, method).mockImplementation(() => {
    throw new Error(RAW_DETAIL);
  });

const quietLog = () => jest.spyOn(console, "error").mockImplementation(() => {});

const expectPlainServerError = (res, message, logSpy) => {
  expect(res.status).toBe(500);
  expect(res.body).toEqual({ message });
  expect(res.body).not.toHaveProperty("error");
  expect(JSON.stringify(res.body)).not.toContain(RAW_DETAIL);
  // Logged on the server instead
  expect(
    logSpy.mock.calls.some((args) =>
      args.some((arg) => String(arg?.message ?? arg).includes(RAW_DETAIL)),
    ),
  ).toBe(true);
};

const png = Buffer.from("89504e470d0a1a0a", "hex");

describe("routes/settings.js: no error details in a 500 reply", () => {
  it("GET /company", async () => {
    await account("ana");
    const token = await loginAs("ana");
    const log = quietLog();
    breakCall(CompanySettings, "findOneAndUpdate");

    const res = await request(app).get("/api/settings/company").set(as(token));

    expectPlainServerError(res, "Server error", log);
  });

  it("PUT /company", async () => {
    const { token } = await superAdmin();
    const log = quietLog();
    breakCall(CompanySettings, "findOneAndUpdate");

    const res = await request(app)
      .put("/api/settings/company")
      .set(as(token))
      .send({ name: "ACESER" });

    expectPlainServerError(res, "Server error", log);
    expect(await CompanySettings.countDocuments({})).toBe(0);
  });

  it("PUT /company still answers a bad value with 400 and its message (no log)", async () => {
    const { token } = await superAdmin();
    const log = quietLog();

    const res = await request(app)
      .put("/api/settings/company")
      .set(as(token))
      .send({ dateFormat: "nope" });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body)).toEqual(["message"]);
    expect(log).not.toHaveBeenCalled();
  });

  it("PUT /company/logo", async () => {
    const { token } = await superAdmin();
    const log = quietLog();
    jest
      .spyOn(CompanySettings.prototype, "save")
      .mockRejectedValueOnce(new Error(RAW_DETAIL));

    const res = await request(app)
      .put("/api/settings/company/logo")
      .set(as(token))
      .attach("logo", png, { filename: "logo.png", contentType: "image/png" });

    expectPlainServerError(res, "Server error", log);
  });

  it("DELETE /company/logo", async () => {
    const { token } = await superAdmin();
    const log = quietLog();
    breakCall(CompanySettings, "findOneAndUpdate");

    const res = await request(app)
      .delete("/api/settings/company/logo")
      .set(as(token));

    expectPlainServerError(res, "Server error", log);
  });

  it("the hidden-account check before an admin edits another account", async () => {
    const { token } = await superAdmin();
    const ana = await account("ana");
    const log = quietLog();
    breakCall(User, "exists");

    const res = await request(app)
      .put(`/api/settings/updateGeneralSettings/${ana._id}`)
      .set(as(token))
      .send({ employee: { contactNumber: "09171234567" } });

    expectPlainServerError(res, "Server error", log);
    const stored = await Employee.findOne({ userId: ana._id }).lean();
    expect(stored.contactNumber).not.toBe("09171234567");
  });

  it("still answers an Employee with 403 before reaching a company write (role check)", async () => {
    await account("ana");
    const token = await loginAs("ana");
    const log = quietLog();
    breakCall(CompanySettings, "findOneAndUpdate");

    const res = await request(app)
      .put("/api/settings/company")
      .set(as(token))
      .send({ name: "Hacked" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Admin access required" });
    expect(log).not.toHaveBeenCalled();
  });
});

describe("routes/admins.js: no error details in a 500 reply", () => {
  it("GET /api/admins", async () => {
    const { token } = await superAdmin();
    const log = quietLog();
    breakCall(User, "find");

    const res = await request(app).get("/api/admins").set(as(token));

    expectPlainServerError(res, "Server error", log);
  });

  it("POST /api/admins/:id/disable (a failed save); the Admin stays Active", async () => {
    const { token } = await superAdmin();
    const hr = await account("hr", { role: "Admin" });
    const log = quietLog();
    jest
      .spyOn(User.prototype, "save")
      .mockRejectedValueOnce(new Error(RAW_DETAIL));

    const res = await request(app)
      .post(`/api/admins/${hr._id}/disable`)
      .set(as(token));

    expectPlainServerError(res, "Server error", log);
    expect((await User.findById(hr._id).lean()).status).toBe("Active");
  });

  it("POST /api/admins (a failed save that is not a duplicate); nothing created", async () => {
    const { token } = await superAdmin();
    const log = quietLog();
    jest
      .spyOn(User.prototype, "save")
      .mockRejectedValueOnce(new Error(RAW_DETAIL));

    const res = await request(app).post("/api/admins").set(as(token)).send({
      firstName: "Rhea",
      lastName: "Cruz",
      username: "hr.rhea",
      email: "rhea@example.com",
    });

    expectPlainServerError(res, "Server error", log);
    expect(res.body).not.toHaveProperty("temporaryPassword");
    expect(await User.countDocuments({ role: "Admin" })).toBe(0);
  });
});

describe("middleware/accessMiddleware.js: no error details in a 500 reply", () => {
  it("loadCurrentUser (every signed-in route)", async () => {
    await account("ana");
    const token = await loginAs("ana");
    const log = quietLog();
    breakCall(User, "findById");

    const res = await request(app).get("/api/settings/company").set(as(token));

    expectPlainServerError(res, "Server error", log);
  });

  it("loadCurrentUser on a Super Admin only route", async () => {
    const { token } = await superAdmin();
    const log = quietLog();
    breakCall(User, "findById");

    const res = await request(app).get("/api/admins").set(as(token));

    expectPlainServerError(res, "Server error", log);
  });

  it("requireSignupToken (the sign-up steps)", async () => {
    const pending = await account("newbie", { status: "Pending" });
    const token = jwt.sign(
      { userId: pending._id, purpose: "signup" },
      process.env.JWT_SECRET,
      { expiresIn: "30m" },
    );
    const log = quietLog();
    breakCall(User, "findById");

    const res = await request(app)
      .post("/api/employee/update-info")
      .set(as(token))
      .send({ birthday: "2000-01-01", gender: "Female" });

    expectPlainServerError(res, "Server error", log);
    const stored = await Employee.findOne({ userId: pending._id }).lean();
    expect(stored.gender).not.toBe("Female");
  });

  it("still answers a request without a token with 401 (no log)", async () => {
    const log = quietLog();
    breakCall(User, "findById");

    const res = await request(app).get("/api/settings/company");

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty("error");
    expect(log).not.toHaveBeenCalled();
  });
});
