// A role change ends the session: a token signed for the old role gets 401 ROLE_CHANGED
// on every guarded route, and signing in again gives a token that works.
const request = require("supertest");
const mongoose = require("mongoose");
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
  await User.deleteMany({});
  await Employee.deleteMany({});
  await Settings.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const PASSWORD = "Password123!";
const ROLE_CHANGED = {
  message: "Your role has changed. Please sign in again.",
  code: "ROLE_CHANGED",
};

const loginAs = async (username) => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
};

// Creates Auth + Employee + Settings for one person and signs them in
const person = async (username, role) => {
  const user = await User.create({
    username,
    password: PASSWORD,
    email: `${username}@example.com`,
    role,
    status: "Active",
  });
  await Employee.create({
    userId: user._id,
    firstName: username.charAt(0).toUpperCase() + username.slice(1),
    lastName: "Test",
    employeeId: `AC-${username}`,
    email: `${username}@example.com`,
    role,
  });
  await Settings.create({
    userId: user._id,
    general: { jobDescription: { employmentType: "Regular" } },
  });
  return { user, token: await loginAs(username) };
};

const as = (token) => ({ Authorization: `Bearer ${token}` });
const setRole = (user, role) => User.updateOne({ _id: user._id }, { role });

const ME = "/api/auth/me";
const ADMIN_ROUTE = "/api/employee/employees";
// requirePage("filing"): an Employee page, open by default
const EMPLOYEE_ROUTE = "/api/filing/user-leave-requests";
// requireAnyLogisticsPage, from middleware/logisticsAccess.js
const LOGISTICS_ROUTE = "/api/logistics/projects";

describe("Employee promoted to Admin while signed in", () => {
  it("ends the session on /me and on an admin route", async () => {
    const { user, token } = await person("ana", "Employee");
    expect((await request(app).get(ME).set(as(token))).status).toBe(200);

    await setRole(user, "Admin");

    for (const url of [ME, ADMIN_ROUTE]) {
      const res = await request(app).get(url).set(as(token));
      expect(res.status).toBe(401);
      expect(res.body).toEqual(ROLE_CHANGED);
    }
  });

  it("works again after signing in with the new role", async () => {
    const { user } = await person("ana", "Employee");
    await setRole(user, "Admin");

    const token = await loginAs("ana");
    const me = await request(app).get(ME).set(as(token));
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe("Admin");
    expect((await request(app).get(ADMIN_ROUTE).set(as(token))).status).toBe(
      200,
    );
  });
});

describe("Admin moved to Employee while signed in", () => {
  it("ends the session on /me and on an employee route", async () => {
    const { user, token } = await person("hr", "Admin");
    expect((await request(app).get(ME).set(as(token))).status).toBe(200);

    await setRole(user, "Employee");

    for (const url of [ME, EMPLOYEE_ROUTE, ADMIN_ROUTE]) {
      const res = await request(app).get(url).set(as(token));
      expect(res.status).toBe(401);
      expect(res.body).toEqual(ROLE_CHANGED);
    }
  });

  it("works again after signing in, now as an Employee", async () => {
    const { user } = await person("hr", "Admin");
    await setRole(user, "Employee");

    const token = await loginAs("hr");
    expect((await request(app).get(ME).set(as(token))).status).toBe(200);
    expect(
      (await request(app).get(EMPLOYEE_ROUTE).set(as(token))).status,
    ).toBe(200);
    // The new token carries Employee, so the admin guard refuses it as usual
    const admin = await request(app).get(ADMIN_ROUTE).set(as(token));
    expect(admin.status).toBe(403);
    expect(admin.body.message).toBe("Admin access required");
  });
});

describe("Admin moved to Super Admin while signed in", () => {
  it("ends the session of the old Admin token", async () => {
    const { user, token } = await person("boss", "Admin");
    await setRole(user, "Super Admin");

    for (const url of [ME, ADMIN_ROUTE]) {
      const res = await request(app).get(url).set(as(token));
      expect(res.status).toBe(401);
      expect(res.body).toEqual(ROLE_CHANGED);
    }
  });
});

describe("Unchanged role", () => {
  it("keeps the same token working", async () => {
    const { user, token } = await person("ana", "Employee");
    // A save that leaves the role as it was does not end the session
    await setRole(user, "Employee");

    const first = await request(app).get(ME).set(as(token));
    const second = await request(app).get(ME).set(as(token));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});

describe("Status is checked before the role", () => {
  it("answers 'Account is not active' for a resigned account whose role also changed", async () => {
    const { user, token } = await person("ana", "Employee");
    await User.updateOne(
      { _id: user._id },
      { role: "Admin", status: "Resigned" },
    );

    const res = await request(app).get(ME).set(as(token));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      message: "Account is not active",
      code: "ACCOUNT_INACTIVE",
    });
  });
});

describe("Logistics guards", () => {
  it("end the session after a role change", async () => {
    const { user, token } = await person("hr", "Admin");
    expect(
      (await request(app).get(LOGISTICS_ROUTE).set(as(token))).status,
    ).toBe(200);

    await setRole(user, "Employee");

    const res = await request(app).get(LOGISTICS_ROUTE).set(as(token));
    expect(res.status).toBe(401);
    expect(res.body).toEqual(ROLE_CHANGED);
  });
});
