// /api/admins (PR B): the Super Admin creates and manages Admin accounts. Rules 2, 4,
// 6 to 9, 13 and 21 of the roles and permissions plan, and "no admin changes its own
// role". The pure rules are in adminAccounts.test.js.
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const { ADMIN_DEFAULT_PAGE_KEYS, pagesForRole } = require("../config/pages");
const { checkNewPassword } = require("../utils/password");

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
const DENIED = {
  message: "You do not have access to this page",
  code: "PAGE_ACCESS_DENIED",
};
const BLOCKED = {
  message: "Please change your password before continuing.",
  code: "PASSWORD_CHANGE_REQUIRED",
};
const INACTIVE = { message: "Account is not active", code: "ACCOUNT_INACTIVE" };
const ADMIN_PAGE_KEYS = pagesForRole("Admin").map((page) => page.key);

const login = (username, password = PASSWORD) =>
  request(app).post("/api/auth/login").send({ username, password });

const loginAs = async (username, password = PASSWORD) => {
  const res = await login(username, password);
  expect(res.status).toBe(200);
  return res.body.token;
};

// Creates Auth + Employee + Settings for one person and signs them in (when Active)
const person = async (
  username,
  { role = "Employee", status = "Active", employeeId, pageAccess } = {},
) => {
  const user = await User.create({
    username,
    password: PASSWORD,
    email: `${username}@example.com`,
    role,
    status,
    ...(pageAccess ? { pageAccess } : {}),
  });
  await Employee.create({
    userId: user._id,
    firstName: username.charAt(0).toUpperCase() + username.slice(1),
    lastName: "Test",
    employeeId: employeeId ?? `EMP-${username}`,
    email: `${username}@example.com`,
    role,
  });
  await Settings.create({
    userId: user._id,
    general: { jobDescription: { employmentType: "Regular" } },
  });
  const token = status === "Active" ? await loginAs(username) : null;
  return { user, token };
};

const as = (token) => ({ Authorization: `Bearer ${token}` });
const missingId = () => String(new mongoose.Types.ObjectId());
const superAdmin = () =>
  person("admin", { role: "Super Admin", employeeId: "ADM-001" });
const employee = (username = "ana", extra = {}) => person(username, extra);

const NEW_ADMIN = {
  firstName: "Rhea",
  lastName: "Cruz",
  username: "hr.rhea",
  email: "rhea@example.com",
};

const createAdmin = (token, body = {}) =>
  request(app)
    .post("/api/admins")
    .set(as(token))
    .send({ ...NEW_ADMIN, ...body });

// Creates an Admin through the API, sets its own password and signs it in again
const signedInAdmin = async (saToken, body = {}) => {
  const created = await createAdmin(saToken, body);
  expect(created.status).toBe(201);
  const username = body.username ?? NEW_ADMIN.username;
  const first = await loginAs(username, created.body.temporaryPassword);
  const changed = await request(app)
    .post("/api/auth/change-password")
    .set(as(first))
    .send({
      currentPassword: created.body.temporaryPassword,
      newPassword: PASSWORD,
    });
  expect(changed.status).toBe(200);
  const stored = await User.findOne({ username });
  return { admin: stored, token: await loginAs(username), created };
};

// Every /api/admins route, with a body where one is needed
const ROUTES = (id) => [
  ["get", "/api/admins"],
  ["post", "/api/admins", NEW_ADMIN],
  ["patch", `/api/admins/${id}`, { lastName: "Ruiz" }],
  ["post", `/api/admins/${id}/disable`],
  ["post", `/api/admins/${id}/enable`],
  ["post", `/api/admins/${id}/reset-password`],
];

const send = (method, url, token, body) => {
  let req = request(app)[method](url);
  if (token) req = req.set(as(token));
  return body === undefined ? req : req.send(body);
};

describe("only the Super Admin may call /api/admins (rule 6)", () => {
  it("refuses an Employee with the same 403 as a page it can't open", async () => {
    const { token } = await employee();
    for (const [method, url, body] of ROUTES(missingId())) {
      const res = await send(method, url, token, body);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(DENIED);
    }
  });

  it("refuses an Admin, even one with every tick, and changes nothing", async () => {
    const sa = await superAdmin();
    const { admin, token } = await signedInAdmin(sa.token, {
      pages: ADMIN_PAGE_KEYS,
    });
    for (const [method, url, body] of ROUTES(admin._id)) {
      const res = await send(method, url, token, body);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(DENIED);
    }
    const after = await User.findById(admin._id).lean();
    expect(after.lastName).toBe("Cruz");
    expect(after.status).toBe("Active");
    expect(after.mustChangePassword).toBe(false);
    expect(await User.countDocuments({ role: "Admin" })).toBe(1);
  });

  it("refuses a request without a token", async () => {
    for (const [method, url, body] of ROUTES(missingId())) {
      expect((await send(method, url, null, body)).status).toBe(401);
    }
  });
});

describe("POST /api/admins (rule 7)", () => {
  it("creates an Active Admin with a temporary password shown once", async () => {
    const sa = await superAdmin();
    const res = await createAdmin(sa.token);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Admin account created.");
    const { temporaryPassword, admin } = res.body;
    expect(temporaryPassword).toHaveLength(12);
    expect(checkNewPassword({ next: temporaryPassword })).toBeNull();

    expect(admin).toEqual({
      id: expect.any(String),
      firstName: "Rhea",
      lastName: "Cruz",
      username: "hr.rhea",
      email: "rhea@example.com",
      status: "Active",
      mustChangePassword: true,
      pages: ADMIN_DEFAULT_PAGE_KEYS,
      payAccess: [],
      linkedEmployee: null,
      lastLogin: null,
    });

    const stored = await User.findById(admin.id).lean();
    expect(stored.role).toBe("Admin");
    expect(stored.status).toBe("Active");
    expect(stored.mustChangePassword).toBe(true);
    expect(String(stored.createdBy)).toBe(String(sa.user._id));
    expect(stored.pageAccess).toEqual(ADMIN_DEFAULT_PAGE_KEYS);
    // Only the hash is stored
    expect(stored.password).not.toBe(temporaryPassword);
    expect(await bcrypt.compare(temporaryPassword, stored.password)).toBe(true);
    // Not an employee: no Employee or Settings record
    expect(await Employee.exists({ userId: admin.id })).toBeNull();
    expect(await Settings.exists({ userId: admin.id })).toBeNull();
  });

  it("accepts the 13th month tick on create and edit; it is not in the HR set", async () => {
    const sa = await superAdmin();
    expect(ADMIN_DEFAULT_PAGE_KEYS).not.toContain("thirteenth-month");

    const res = await createAdmin(sa.token, {
      pages: ["reports", "thirteenth-month"],
    });
    expect(res.status).toBe(201);
    expect(res.body.admin.pages).toEqual([
      "admin-dashboard",
      "reports",
      "admin-settings",
      "thirteenth-month",
    ]);
    const id = res.body.admin.id;
    expect((await User.findById(id).lean()).pageAccess).toContain(
      "thirteenth-month",
    );

    const off = await request(app)
      .patch(`/api/admins/${id}`)
      .set(as(sa.token))
      .send({ pages: ["reports"] });
    expect(off.status).toBe(200);
    expect(off.body.pages).toEqual(["admin-dashboard", "reports", "admin-settings"]);
    const on = await request(app)
      .patch(`/api/admins/${id}`)
      .set(as(sa.token))
      .send({ pages: ["thirteenth-month"] });
    expect(on.status).toBe(200);
    expect(on.body.pages).toEqual([
      "admin-dashboard",
      "admin-settings",
      "thirteenth-month",
    ]);

    const plain = await createAdmin(sa.token, {
      username: "hr.two",
      email: "two@example.com",
    });
    expect(plain.body.admin.pages).not.toContain("thirteenth-month");
  });

  it("shows the 13th month tick in a ticked Admin's allowedPages, and always for the Super Admin", async () => {
    const sa = await superAdmin();
    const { token } = await signedInAdmin(sa.token, {
      pages: ["employees", "thirteenth-month"],
    });
    const me = await request(app).get("/api/auth/me").set(as(token));
    expect(me.body.user.allowedPages).toContain("thirteenth-month");

    const saMe = await request(app).get("/api/auth/me").set(as(sa.token));
    expect(saMe.body.user.allowedPages).toContain("thirteenth-month");
  });

  it("gives a new password each time", async () => {
    const sa = await superAdmin();
    const one = await createAdmin(sa.token);
    const two = await createAdmin(sa.token, {
      username: "hr.two",
      email: "two@example.com",
    });
    expect(one.body.temporaryPassword).not.toBe(two.body.temporaryPassword);
  });

  it("stores the ticks, the pay list (Active and Resigned) and the linked employee", async () => {
    const sa = await superAdmin();
    const ana = await employee("ana", { employeeId: "AC-001" });
    const ben = await employee("ben", { employeeId: "AC-002", status: "Resigned" });

    const res = await createAdmin(sa.token, {
      pages: ["employees", "reports"],
      payAccess: [String(ana.user._id), String(ben.user._id)],
      linkedEmployeeId: String(ana.user._id),
    });

    expect(res.status).toBe(201);
    expect(res.body.admin.pages).toEqual([
      "admin-dashboard",
      "employees",
      "reports",
      "admin-settings",
    ]);
    expect(res.body.admin.payAccess).toEqual([
      {
        id: String(ana.user._id),
        name: "Ana Test",
        employeeId: "AC-001",
        status: "Active",
      },
      {
        id: String(ben.user._id),
        name: "Ben Test",
        employeeId: "AC-002",
        status: "Resigned",
      },
    ]);
    expect(res.body.admin.linkedEmployee).toEqual({
      id: String(ana.user._id),
      name: "Ana Test",
    });
    const stored = await User.findById(res.body.admin.id).lean();
    expect(stored.payAccess.map(String)).toEqual([
      String(ana.user._id),
      String(ben.user._id),
    ]);
    expect(String(stored.linkedEmployeeId)).toBe(String(ana.user._id));
  });

  it("takes no role, status, password or flag from the body", async () => {
    const sa = await superAdmin();
    const res = await createAdmin(sa.token, {
      status: "Inactive",
      password: "chosenbyme",
      mustChangePassword: false,
    });
    expect(res.status).toBe(201);
    const stored = await User.findById(res.body.admin.id).lean();
    expect(stored.status).toBe("Active");
    expect(stored.mustChangePassword).toBe(true);
    expect(await bcrypt.compare("chosenbyme", stored.password)).toBe(false);
  });

  const refusals = [
    ["a missing first name", { firstName: "" }, "First name, last name, username and email are required."],
    ["a missing last name", { lastName: undefined }, "First name, last name, username and email are required."],
    ["a blank username", { username: "  " }, "First name, last name, username and email are required."],
    ["a missing email", { email: undefined }, "First name, last name, username and email are required."],
    ["an email with no dot after the @", { email: "rhea@example" }, "Enter a valid email address."],
    ["an email with no @", { email: "rhea.example.com" }, "Enter a valid email address."],
    ["an email with a space", { email: "rhea cruz@example.com" }, "Enter a valid email address."],
    ["a role key (rule 2)", { role: "Admin" }, "Role can't be changed."],
    ["a role of Super Admin", { role: "Super Admin" }, "Role can't be changed."],
    ["an employee page key", { pages: ["employees", "payroll"] }, "Not an admin page: payroll"],
    ["an unknown page key", { pages: ["nope"] }, "Not an admin page: nope"],
  ];

  it.each(refusals)("refuses %s and creates nothing", async (_, body, message) => {
    const sa = await superAdmin();
    const res = await createAdmin(sa.token, body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    expect(await User.countDocuments({ role: "Admin" })).toBe(0);
  });

  it("refuses a username or email any account already uses", async () => {
    const sa = await superAdmin();
    await employee("ana");

    const byUsername = await createAdmin(sa.token, { username: "ana" });
    expect(byUsername.status).toBe(400);
    expect(byUsername.body.message).toBe("Username is already taken.");

    const bySuperAdmin = await createAdmin(sa.token, { username: "admin" });
    expect(bySuperAdmin.body.message).toBe("Username is already taken.");

    const byEmail = await createAdmin(sa.token, { email: "ana@example.com" });
    expect(byEmail.status).toBe(400);
    expect(byEmail.body.message).toBe("Email is already registered.");

    expect(await User.countDocuments({ role: "Admin" })).toBe(0);
  });

  it("refuses a username or email used in another case", async () => {
    const sa = await superAdmin();
    await employee("ana");

    const byUsername = await createAdmin(sa.token, { username: "ANA" });
    expect(byUsername.status).toBe(400);
    expect(byUsername.body.message).toBe("Username is already taken.");

    const byEmail = await createAdmin(sa.token, { email: "Ana@Example.COM" });
    expect(byEmail.status).toBe(400);
    expect(byEmail.body.message).toBe("Email is already registered.");

    expect(await User.countDocuments({ role: "Admin" })).toBe(0);
  });

  it("checks the username and email before any pay-list or linked id", async () => {
    const sa = await superAdmin();
    await employee("ana");

    for (const ids of [
      { payAccess: ["abc"] },
      { payAccess: [missingId()] },
      { linkedEmployeeId: "xyz" },
      { linkedEmployeeId: String(sa.user._id) },
    ]) {
      const byUsername = await createAdmin(sa.token, {
        username: "ana",
        ...ids,
      });
      expect(byUsername.body.message).toBe("Username is already taken.");
      const byEmail = await createAdmin(sa.token, {
        email: "ana@example.com",
        ...ids,
      });
      expect(byEmail.body.message).toBe("Email is already registered.");
    }
    expect(await User.countDocuments({ role: "Admin" })).toBe(0);
  });

  it("refuses the first bad id in list order, malformed or not an employee", async () => {
    const sa = await superAdmin();
    const ana = await employee("ana");
    const missing = missingId();

    const malformedFirst = await createAdmin(sa.token, {
      payAccess: [String(ana.user._id), "abc", missing],
    });
    expect(malformedFirst.body.message).toBe("Not an employee: abc");

    const missingFirst = await createAdmin(sa.token, {
      payAccess: [missing, "abc"],
    });
    expect(missingFirst.body.message).toBe(`Not an employee: ${missing}`);

    const linked = await createAdmin(sa.token, {
      payAccess: [String(ana.user._id)],
      linkedEmployeeId: "xyz",
    });
    expect(linked.status).toBe(400);
    expect(linked.body.message).toBe("Not an employee: xyz");

    expect(await User.countDocuments({ role: "Admin" })).toBe(0);
  });

  it("refuses anyone on the pay list who is not an Employee account (rule 21)", async () => {
    const sa = await superAdmin();
    const ana = await employee("ana");
    const pending = await employee("pia", { status: "Pending" });
    const other = await createAdmin(sa.token, {
      username: "hr.other",
      email: "other@example.com",
    });
    const missing = missingId();

    for (const bad of [
      String(sa.user._id),
      other.body.admin.id,
      String(pending.user._id),
      missing,
      "abc",
    ]) {
      const res = await createAdmin(sa.token, {
        payAccess: [String(ana.user._id), bad],
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(`Not an employee: ${bad}`);
    }
    expect(await User.countDocuments({ role: "Admin" })).toBe(1);
  });

  it("refuses a linked employee who is not an Employee account", async () => {
    const sa = await superAdmin();
    const res = await createAdmin(sa.token, {
      linkedEmployeeId: String(sa.user._id),
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(`Not an employee: ${sa.user._id}`);
    expect(await User.countDocuments({ role: "Admin" })).toBe(0);
  });
});

describe("a new Admin signing in", () => {
  it("signs in with the temporary password and must change it first (rule 10)", async () => {
    const sa = await superAdmin();
    const created = await createAdmin(sa.token);

    const res = await login("hr.rhea", created.body.temporaryPassword);
    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(true);
    expect(res.body.user.role).toBe("Admin");
    // Its name comes from the Auth record; it has no Employee record
    expect(res.body.user.firstName).toBe("Rhea");
    expect(res.body.user.lastName).toBe("Cruz");
    expect(res.body.user.employee).toBeNull();
    expect(res.body.user).not.toHaveProperty("password");

    const blocked = await request(app)
      .get("/api/employee/employees")
      .set(as(res.body.token));
    expect(blocked.status).toBe(403);
    expect(blocked.body).toEqual(BLOCKED);
  });

  it("gets the HR set after its own password change", async () => {
    const sa = await superAdmin();
    const { token } = await signedInAdmin(sa.token);

    const me = await request(app).get("/api/auth/me").set(as(token));
    expect(me.body.user.mustChangePassword).toBe(false);
    expect(me.body.user.allowedPages).toEqual(ADMIN_DEFAULT_PAGE_KEYS);

    expect(
      (await request(app).get("/api/employee/latest-employeeId").set(as(token)))
        .status,
    ).toBe(200);
    const reports = await request(app)
      .get("/api/thirteenth-month?year=2026")
      .set(as(token));
    expect(reports.status).toBe(403);
    expect(reports.body).toEqual(DENIED);
  });

  it("records the last login", async () => {
    const sa = await superAdmin();
    await signedInAdmin(sa.token);
    const list = await request(app).get("/api/admins").set(as(sa.token));
    expect(new Date(list.body[0].lastLogin).getTime()).toBeGreaterThan(0);
  });

  it("is hidden: not in the employee list, and its profile answers as missing", async () => {
    const sa = await superAdmin();
    await employee("ana");
    const { admin } = await signedInAdmin(sa.token);

    const list = await request(app)
      .get("/api/employee/employees")
      .set(as(sa.token));
    expect(list.body.map((row) => row.username)).toEqual(["ana"]);

    const profile = await request(app)
      .get(`/api/employee/employees/${admin._id}`)
      .set(as(sa.token));
    expect(profile.status).toBe(404);
  });
});

describe("GET /api/admins", () => {
  it("lists every Admin, not the Super Admin, without password hashes", async () => {
    const sa = await superAdmin();
    const ana = await employee("ana", { employeeId: "AC-001" });
    await createAdmin(sa.token, {
      payAccess: [String(ana.user._id)],
      linkedEmployeeId: String(ana.user._id),
    });
    await createAdmin(sa.token, {
      firstName: "Abel",
      lastName: "Aquino",
      username: "hr.abel",
      email: "abel@example.com",
    });

    const res = await request(app).get("/api/admins").set(as(sa.token));
    expect(res.status).toBe(200);
    expect(res.body.map((row) => row.username)).toEqual(["hr.abel", "hr.rhea"]);
    const rhea = res.body[1];
    expect(rhea.payAccess).toEqual([
      {
        id: String(ana.user._id),
        name: "Ana Test",
        employeeId: "AC-001",
        status: "Active",
      },
    ]);
    expect(rhea.linkedEmployee).toEqual({
      id: String(ana.user._id),
      name: "Ana Test",
    });
    expect(rhea.mustChangePassword).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/password"|resetToken/);
  });

  it("leaves a deleted employee off the pay list and the link", async () => {
    const sa = await superAdmin();
    const ana = await employee("ana", { employeeId: "AC-001" });
    await createAdmin(sa.token, {
      payAccess: [String(ana.user._id)],
      linkedEmployeeId: String(ana.user._id),
    });

    const deleted = await request(app)
      .delete("/api/employee/delete-employee/AC-001")
      .set(as(sa.token));
    expect(deleted.status).toBe(200);

    const stored = await User.findOne({ username: "hr.rhea" }).lean();
    expect(stored.payAccess).toEqual([]);
    expect(stored.linkedEmployeeId).toBeUndefined();
    const res = await request(app).get("/api/admins").set(as(sa.token));
    expect(res.body[0].payAccess).toEqual([]);
    expect(res.body[0].linkedEmployee).toBeNull();
  });
});

describe("PATCH /api/admins/:id", () => {
  it("changes the names, email, ticks, pay list and link; not the username", async () => {
    const sa = await superAdmin();
    const ana = await employee("ana", { employeeId: "AC-001" });
    const created = await createAdmin(sa.token);
    const id = created.body.admin.id;

    const res = await request(app)
      .patch(`/api/admins/${id}`)
      .set(as(sa.token))
      .send({
        firstName: "Rhea Mae",
        lastName: "Ruiz",
        email: "rhea.ruiz@example.com",
        username: "someone.else",
        pages: ["reports"],
        payAccess: [String(ana.user._id)],
        linkedEmployeeId: String(ana.user._id),
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      firstName: "Rhea Mae",
      lastName: "Ruiz",
      email: "rhea.ruiz@example.com",
      username: "hr.rhea",
      pages: ["admin-dashboard", "reports", "admin-settings"],
      linkedEmployee: { id: String(ana.user._id), name: "Ana Test" },
    });
    expect(res.body.payAccess).toHaveLength(1);

    const cleared = await request(app)
      .patch(`/api/admins/${id}`)
      .set(as(sa.token))
      .send({ linkedEmployeeId: null, payAccess: [] });
    expect(cleared.status).toBe(200);
    expect(cleared.body.linkedEmployee).toBeNull();
    expect(cleared.body.payAccess).toEqual([]);
    expect(cleared.body.pages).toEqual([
      "admin-dashboard",
      "reports",
      "admin-settings",
    ]);
  });

  it("refuses a role key and leaves the role and everything else as it was (rule 2)", async () => {
    const sa = await superAdmin();
    const created = await createAdmin(sa.token);
    for (const role of ["Super Admin", "Employee", "Admin"]) {
      const res = await request(app)
        .patch(`/api/admins/${created.body.admin.id}`)
        .set(as(sa.token))
        .send({ role, lastName: "Ruiz" });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Role can't be changed.");
    }
    const stored = await User.findById(created.body.admin.id).lean();
    expect(stored.role).toBe("Admin");
    expect(stored.lastName).toBe("Cruz");
  });

  it("refuses an email another account uses, a bad page and a non-employee", async () => {
    const sa = await superAdmin();
    await employee("ana");
    const created = await createAdmin(sa.token);
    const url = `/api/admins/${created.body.admin.id}`;

    const email = await request(app)
      .patch(url)
      .set(as(sa.token))
      .send({ email: "ana@example.com" });
    expect(email.status).toBe(400);
    expect(email.body.message).toBe("Email is already registered.");

    const page = await request(app)
      .patch(url)
      .set(as(sa.token))
      .send({ pages: ["filing"] });
    expect(page.body.message).toBe("Not an admin page: filing");

    const pay = await request(app)
      .patch(url)
      .set(as(sa.token))
      .send({ payAccess: [String(sa.user._id)] });
    expect(pay.body.message).toBe(`Not an employee: ${sa.user._id}`);

    const stored = await User.findById(created.body.admin.id).lean();
    expect(stored.email).toBe("rhea@example.com");
    expect(stored.pageAccess).toEqual(ADMIN_DEFAULT_PAGE_KEYS);
    expect(stored.payAccess).toEqual([]);
  });

  it("refuses a badly shaped email and changes nothing", async () => {
    const sa = await superAdmin();
    const created = await createAdmin(sa.token);
    const before = await User.findById(created.body.admin.id).lean();

    for (const email of ["rhea@example", "rhea", " @example.com"]) {
      const res = await request(app)
        .patch(`/api/admins/${created.body.admin.id}`)
        .set(as(sa.token))
        .send({ lastName: "Ruiz", email });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "Enter a valid email address." });
    }

    expect(await User.findById(created.body.admin.id).lean()).toEqual(before);
  });

  it("accepts a well-shaped new email, trimmed", async () => {
    const sa = await superAdmin();
    const created = await createAdmin(sa.token);
    const res = await request(app)
      .patch(`/api/admins/${created.body.admin.id}`)
      .set(as(sa.token))
      .send({ email: " rhea.cruz@example.com.ph " });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("rhea.cruz@example.com.ph");
  });

  it("refuses an Admin (not the Super Admin) before it looks at the email", async () => {
    const sa = await superAdmin();
    const created = await createAdmin(sa.token);
    const other = await signedInAdmin(sa.token, {
      username: "hr.mark",
      email: "mark@example.com",
      pages: ADMIN_PAGE_KEYS,
    });

    const res = await request(app)
      .patch(`/api/admins/${created.body.admin.id}`)
      .set(as(other.token))
      .send({ email: "bad" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(DENIED);
  });

  it("keeps the Admin's own email (not a duplicate of itself)", async () => {
    const sa = await superAdmin();
    const created = await createAdmin(sa.token);
    const res = await request(app)
      .patch(`/api/admins/${created.body.admin.id}`)
      .set(as(sa.token))
      .send({ email: "rhea@example.com" });
    expect(res.status).toBe(200);
  });

  it("refuses another account's email in another case, keeps its own in a new case", async () => {
    const sa = await superAdmin();
    await employee("ana");
    const created = await createAdmin(sa.token);
    const url = `/api/admins/${created.body.admin.id}`;

    const other = await request(app)
      .patch(url)
      .set(as(sa.token))
      .send({ email: "ANA@example.com" });
    expect(other.status).toBe(400);
    expect(other.body.message).toBe("Email is already registered.");
    expect((await User.findById(created.body.admin.id)).email).toBe(
      "rhea@example.com",
    );

    const own = await request(app)
      .patch(url)
      .set(as(sa.token))
      .send({ email: "Rhea@Example.com" });
    expect(own.status).toBe(200);
    expect(own.body.email).toBe("Rhea@Example.com");
  });

  it("answers 404 for the Super Admin, an employee, a missing and a bad id", async () => {
    const sa = await superAdmin();
    const ana = await employee("ana");
    for (const id of [sa.user._id, ana.user._id, missingId(), "abc"]) {
      const res = await request(app)
        .patch(`/api/admins/${id}`)
        .set(as(sa.token))
        .send({ role: "Admin", lastName: "Changed" });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Admin not found");
    }
    expect((await User.findById(sa.user._id)).role).toBe("Super Admin");
    expect((await User.findById(ana.user._id)).role).toBe("Employee");
  });

  it("applies new ticks on the Admin's next request without ending its session (rule 8)", async () => {
    const sa = await superAdmin();
    const { admin, token } = await signedInAdmin(sa.token);
    const reports = () =>
      request(app).get("/api/thirteenth-month?year=2026").set(as(token));
    const employeesPage = () =>
      request(app).get("/api/employee/latest-employeeId").set(as(token));

    expect((await reports()).status).toBe(403);
    expect((await employeesPage()).status).toBe(200);

    await request(app)
      .patch(`/api/admins/${admin._id}`)
      .set(as(sa.token))
      .send({ pages: ["reports", "thirteenth-month"] })
      .expect(200);

    expect((await reports()).status).toBe(200);
    const now = await employeesPage();
    expect(now.status).toBe(403);
    expect(now.body).toEqual(DENIED);
    // Same token, same role: the session goes on
    expect((await request(app).get("/api/auth/me").set(as(token))).status).toBe(
      200,
    );
  });
});

describe("disable and enable (rule 9)", () => {
  it("disables a signed-in Admin: next request 401, login 'This account is disabled.'", async () => {
    const sa = await superAdmin();
    const { admin, token } = await signedInAdmin(sa.token);

    const res = await request(app)
      .post(`/api/admins/${admin._id}/disable`)
      .set(as(sa.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Admin disabled." });
    expect((await User.findById(admin._id)).status).toBe("Inactive");

    const next = await request(app).get("/api/auth/me").set(as(token));
    expect(next.status).toBe(401);
    expect(next.body).toEqual(INACTIVE);

    const again = await login("hr.rhea");
    expect(again.status).toBe(403);
    expect(again.body.message).toBe("This account is disabled.");

    const enabled = await request(app)
      .post(`/api/admins/${admin._id}/enable`)
      .set(as(sa.token));
    expect(enabled.body).toEqual({ message: "Admin enabled." });
    expect((await login("hr.rhea")).status).toBe(200);
  });

  it("answers 404 for the Super Admin and an employee, and changes neither", async () => {
    const sa = await superAdmin();
    const ana = await employee("ana");
    for (const id of [sa.user._id, ana.user._id]) {
      for (const action of ["disable", "enable"]) {
        const res = await request(app)
          .post(`/api/admins/${id}/${action}`)
          .set(as(sa.token));
        expect(res.status).toBe(404);
        expect(res.body.message).toBe("Admin not found");
      }
    }
    expect((await User.findById(sa.user._id)).status).toBe("Active");
    expect((await User.findById(ana.user._id)).status).toBe("Active");
  });

  it("has no delete route: an Admin is never deleted", async () => {
    const sa = await superAdmin();
    const created = await createAdmin(sa.token);
    const res = await request(app)
      .delete(`/api/admins/${created.body.admin.id}`)
      .set(as(sa.token));
    expect(res.status).toBe(404);
    expect(await User.exists({ _id: created.body.admin.id })).not.toBeNull();
  });
});

describe("POST /api/admins/:id/reset-password (rule 13)", () => {
  it("gives a new temporary password, forces the change and stops the old one", async () => {
    const sa = await superAdmin();
    const { admin, token } = await signedInAdmin(sa.token);

    const res = await request(app)
      .post(`/api/admins/${admin._id}/reset-password`)
      .set(as(sa.token));
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Password reset.");
    expect(res.body.temporaryPassword).toHaveLength(12);
    expect(checkNewPassword({ next: res.body.temporaryPassword })).toBeNull();

    expect((await User.findById(admin._id)).mustChangePassword).toBe(true);
    expect((await login("hr.rhea")).status).toBe(401);

    // An open session is sent to the change-password screen on its next request
    const open = await request(app)
      .get("/api/employee/latest-employeeId")
      .set(as(token));
    expect(open.status).toBe(403);
    expect(open.body).toEqual(BLOCKED);

    const fresh = await login("hr.rhea", res.body.temporaryPassword);
    expect(fresh.status).toBe(200);
    expect(fresh.body.user.mustChangePassword).toBe(true);
  });

  it("answers 404 for the Super Admin and leaves its password alone", async () => {
    const sa = await superAdmin();
    const res = await request(app)
      .post(`/api/admins/${sa.user._id}/reset-password`)
      .set(as(sa.token));
    expect(res.status).toBe(404);
    expect((await login("admin")).status).toBe(200);
  });
});

// No admin changes its own role: an Admin calling every write route it can reach with
// a role in the body, and /api/admins on its own id, keeps the role "Admin" and is not
// signed out. The Super Admin can't change its own role either.
describe("no admin changes its own role (rules 2 and 19)", () => {
  it("an Admin with every tick stays an Admin", async () => {
    const sa = await superAdmin();
    const { admin, token } = await signedInAdmin(sa.token, {
      pages: ADMIN_PAGE_KEYS,
    });
    const id = String(admin._id);

    for (const role of ["Super Admin", "Employee"]) {
      const calls = [
        ["put", `/api/settings/updateGeneralSettings/${id}`, { role, employee: {} }],
        ["put", `/api/employee/edit-employee-via-admin/${id}`, { role }],
        ["put", `/api/access/users/${id}`, { role, pages: [] }],
        ["patch", `/api/admins/${id}`, { role }],
        [
          "post",
          "/api/auth/change-password",
          { role, currentPassword: PASSWORD, newPassword: PASSWORD },
        ],
      ];
      for (const [method, url, body] of calls) {
        const res = await send(method, url, token, body);
        expect(res.status).not.toBe(500);
      }
    }

    expect((await User.findById(id)).role).toBe("Admin");
    const me = await request(app).get("/api/auth/me").set(as(token));
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe("Admin");
  });

  it("the Super Admin can't change its own role through any route", async () => {
    const sa = await superAdmin();
    const id = String(sa.user._id);
    const calls = [
      ["patch", `/api/admins/${id}`, { role: "Admin" }],
      ["put", `/api/settings/updateGeneralSettings/${id}`, { role: "Admin", employee: {} }],
      ["put", `/api/employee/edit-employee-via-admin/${id}`, { role: "Admin" }],
      ["put", `/api/access/users/${id}`, { role: "Admin", pages: [] }],
    ];
    for (const [method, url, body] of calls) {
      const res = await send(method, url, sa.token, body);
      expect(res.status).not.toBe(500);
    }
    expect((await User.findById(id)).role).toBe("Super Admin");
    expect(
      (await request(app).get("/api/auth/me").set(as(sa.token))).status,
    ).toBe(200);
  });
});
