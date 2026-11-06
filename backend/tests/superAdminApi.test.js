// The Super Admin role at the API: it passes every admin guard, sees the admin pages,
// stays out of the lists and reports, and nobody can change it through any route.
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const { pagesForRole } = require("../config/pages");

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
// The Super Admin is hidden: routes aimed at it answer as for a missing account
const NOT_FOUND = "User not found";
const ADMIN_PAGE_KEYS = pagesForRole("Admin").map((page) => page.key);

const loginAs = async (username) => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password: PASSWORD });
  return res.body.token;
};

// Creates Auth + Employee + Settings for one person and signs them in
const person = async (
  username,
  { role = "Employee", employeeId = `EMP-${username}`, job = {} } = {},
) => {
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
    employeeId,
    email: `${username}@example.com`,
    role,
  });
  await Settings.create({
    userId: user._id,
    general: { jobDescription: { employmentType: "Regular", ...job } },
  });
  return { user, token: await loginAs(username) };
};

const as = (token) => ({ Authorization: `Bearer ${token}` });
const superAdmin = () =>
  person("admin", {
    role: "Super Admin",
    employeeId: "ADM-001",
    job: { basicPay: 90000, startDate: "2025-01-06" },
  });
const plainAdmin = () => person("hr", { role: "Admin", employeeId: "ADM-002" });
const employee = (username = "ana") =>
  person(username, {
    employeeId: "AC-001",
    job: {
      basicPay: 25000,
      startDate: "2025-03-03",
      regularizationDate: "2025-09-03",
    },
  });

// Admin-only GET routes across the routers
const ADMIN_ROUTES = [
  "/api/employee/employees",
  "/api/employee/latest-employeeId",
  "/api/filing",
  "/api/filing/overtime",
  "/api/access/pages",
  "/api/thirteenth-month?year=2026",
  "/api/dropdownOption",
  "/api/auth/pending-users",
  "/api/attendance/attendance",
];

describe("Super Admin passes every admin guard", () => {
  it.each(ADMIN_ROUTES)("opens %s", async (url) => {
    const { token } = await superAdmin();
    const res = await request(app).get(url).set(as(token));
    expect(res.status).toBe(200);
  });

  it.each(ADMIN_ROUTES)("still refuses an employee on %s", async (url) => {
    const { token } = await employee();
    const res = await request(app).get(url).set(as(token));
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Admin access required");
  });

  it("is an admin in Logistics", async () => {
    const { user, token } = await superAdmin();
    const res = await request(app).get("/api/logistics/me").set(as(token));
    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(true);
    expect(res.body.userId).toBe(String(user._id));
  });

  it("can open another employee's records", async () => {
    const { token } = await superAdmin();
    const { user } = await employee();
    const res = await request(app)
      .get(`/api/attendance/${user._id}/records`)
      .set(as(token));
    expect(res.status).toBe(200);
  });
});

// A token carries the role it was signed with. Once the stored role differs, the
// session ends (401 ROLE_CHANGED), whatever the direction of the change.
const ROLE_CHANGED = {
  message: "Your role has changed. Please sign in again.",
  code: "ROLE_CHANGED",
};

describe("A token whose role no longer matches the account ends the session", () => {
  it("ends an old token (role Admin inside) once the account is Super Admin", async () => {
    const { user } = await superAdmin();
    const oldToken = jwt.sign(
      { userId: user._id, role: "Admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    for (const url of ["/api/filing", "/api/filing/overtime"]) {
      const res = await request(app).get(url).set(as(oldToken));
      expect(res.status).toBe(401);
      expect(res.body).toEqual(ROLE_CHANGED);
    }
  });

  it("ends the session of an employee whose token claims Admin", async () => {
    const { user } = await employee();
    const forged = jwt.sign(
      { userId: user._id, role: "Admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    const res = await request(app).get("/api/filing").set(as(forged));
    expect(res.status).toBe(401);
    expect(res.body).toEqual(ROLE_CHANGED);
  });
});

describe("Super Admin pages", () => {
  it("gets every admin page from login and /me", async () => {
    await superAdmin();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user.allowedPages).toEqual(ADMIN_PAGE_KEYS);

    const me = await request(app)
      .get("/api/auth/me")
      .set(as(login.body.token));
    expect(me.status).toBe(200);
    expect(me.body.user.allowedPages).toEqual(ADMIN_PAGE_KEYS);
    expect(me.body.user.allowedPages).toContain("logistics-setup");
  });

  it("is hidden from Manage Access: answered as a missing account", async () => {
    const boss = await superAdmin();
    const hr = await plainAdmin();
    const res = await request(app)
      .get(`/api/access/users/${boss.user._id}`)
      .set(as(hr.token));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: NOT_FOUND });
  });
});

describe("lists and reports leave the Super Admin out", () => {
  it("lists only employees on the Employees page", async () => {
    const { token } = await superAdmin();
    await employee();

    const res = await request(app)
      .get("/api/employee/employees?includeResigned=true")
      .set(as(token));
    expect(res.status).toBe(200);
    expect(res.body.map((row) => row.username)).toEqual(["ana"]);
  });

  it("leaves the Super Admin out of the 13th month report", async () => {
    const { user, token } = await superAdmin();
    await employee();

    const res = await request(app)
      .get("/api/thirteenth-month?year=2026")
      .set(as(token));
    expect(res.status).toBe(200);
    expect(res.body.rows.map((row) => row.employeeId)).toEqual(["AC-001"]);

    const one = await request(app)
      .get(`/api/thirteenth-month/${user._id}?year=2026`)
      .set(as(token));
    expect(one.status).toBe(404);
  });
});

describe("nobody can change the Super Admin account: it answers as missing", () => {
  it("refuses to delete it", async () => {
    const boss = await superAdmin();
    const hr = await plainAdmin();

    const res = await request(app)
      .delete("/api/employee/delete-employee/ADM-001")
      .set(as(hr.token));
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Employee not found");
    expect(await User.exists({ _id: boss.user._id })).toBeTruthy();
    expect(await Employee.exists({ userId: boss.user._id })).toBeTruthy();
    expect(await Settings.exists({ userId: boss.user._id })).toBeTruthy();
  });

  it("refuses to edit it, even from its own token", async () => {
    const boss = await superAdmin();
    const hr = await plainAdmin();

    for (const token of [hr.token, boss.token]) {
      const res = await request(app)
        .put(`/api/employee/edit-employee-via-admin/${boss.user._id}`)
        .set(as(token))
        .send({ username: "renamed", firstName: "Changed" });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe(NOT_FOUND);
    }

    const saved = await User.findById(boss.user._id).lean();
    expect(saved.username).toBe("admin");
    expect(saved.role).toBe("Super Admin");
    const record = await Employee.findOne({ userId: boss.user._id }).lean();
    expect(record.firstName).toBe("Admin");
  });

  it("refuses to mark it resigned or reinstate it", async () => {
    const boss = await superAdmin();
    const hr = await plainAdmin();

    const resign = await request(app)
      .patch(`/api/employee/employees/${boss.user._id}/resign`)
      .set(as(hr.token))
      .send({ resignationDate: "2026-10-30", resignationReason: "Test" });
    expect(resign.status).toBe(404);
    expect(resign.body.message).toBe(NOT_FOUND);

    const reinstate = await request(app)
      .patch(`/api/employee/employees/${boss.user._id}/reinstate`)
      .set(as(hr.token));
    expect(reinstate.status).toBe(404);
    expect(reinstate.body.message).toBe(NOT_FOUND);

    const saved = await User.findById(boss.user._id).lean();
    expect(saved.status).toBe("Active");
  });

  it("refuses to change its page access", async () => {
    const boss = await superAdmin();
    const hr = await plainAdmin();

    for (const body of [{ pages: ["employees"] }, { reset: true }]) {
      const res = await request(app)
        .put(`/api/access/users/${boss.user._id}`)
        .set(as(hr.token))
        .send(body);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe(NOT_FOUND);
    }

    const saved = await User.findById(boss.user._id).lean();
    expect(saved.pageAccess).toBeUndefined();
  });

  it("refuses another admin's change to its settings, but lets it change its own", async () => {
    const boss = await superAdmin();
    const hr = await plainAdmin();
    const url = `/api/settings/updateGeneralSettings/${boss.user._id}`;

    const other = await request(app)
      .put(url)
      .set(as(hr.token))
      .send({ employee: { contactNumber: "09170000000" } });
    expect(other.status).toBe(404);
    expect(other.body.message).toBe(NOT_FOUND);

    const own = await request(app)
      .put(url)
      .set(as(boss.token))
      .send({ employee: { contactNumber: "09171111111" } });
    expect(own.status).toBe(200);
    expect(own.body.employee.contactNumber).toBe("09171111111");
  });

  it("still lets the Super Admin edit and delete an employee", async () => {
    const boss = await superAdmin();
    const { user } = await employee();

    const edit = await request(app)
      .put(`/api/employee/edit-employee-via-admin/${user._id}`)
      .set(as(boss.token))
      .send({ firstName: "Anabelle" });
    expect(edit.status).toBe(200);

    const del = await request(app)
      .delete("/api/employee/delete-employee/AC-001")
      .set(as(boss.token));
    expect(del.status).toBe(200);
    expect(await User.exists({ _id: user._id })).toBeNull();
  });

  it("never creates a Super Admin through Add Employee or signup", async () => {
    const { token } = await superAdmin();

    const add = await request(app)
      .post("/api/employee/add-employee-via-admin")
      .set(as(token))
      .send({
        firstName: "Rico",
        lastName: "Test",
        employeeId: "AC-001",
        email: "rico@example.com",
        username: "rico",
        password: PASSWORD,
        role: "Super Admin",
        employmentType: "Probationary",
        startDate: "2026-11-02",
      });
    expect(add.status).toBe(201);

    await request(app).post("/api/auth/signup").send({
      firstName: "Sol",
      lastName: "Test",
      email: "sol@example.com",
      username: "sol",
      password: PASSWORD,
      role: "Super Admin",
    });

    const rico = await User.findOne({ username: "rico" }).lean();
    const sol = await User.findOne({ username: "sol" }).lean();
    expect(rico.role).toBe("Employee");
    expect(sol.role).toBe("Employee");
    expect((await Employee.findOne({ userId: rico._id }).lean()).role).toBe(
      "Employee",
    );
    expect(await User.countDocuments({ role: "Super Admin" })).toBe(1);
  });
});

describe("Employee ID for the next new employee", () => {
  it("starts at AC-001 and follows the highest ID as a number", async () => {
    const { token } = await superAdmin();

    const first = await request(app)
      .get("/api/employee/latest-employeeId")
      .set(as(token));
    expect(first.body.newEmployeeId).toBe("AC-001");

    await person("nine", { employeeId: "AC-009" });
    await person("two", { employeeId: "AC-002" });
    const next = await request(app)
      .get("/api/employee/latest-employeeId")
      .set(as(token));
    expect(next.body.newEmployeeId).toBe("AC-010");
  });
});
