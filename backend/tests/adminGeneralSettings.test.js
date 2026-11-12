// PUT /api/settings/updateGeneralSettings/:id for an Admin's own account (PR D2,
// rules 9 to 13 of "2026-11-12 PR D2 settings by tick proposal"). An Admin account has
// no employee record, so Settings > General saves its first and last name on the
// account itself, with the email. Employees and the main account keep using the
// `employee` object; their top-level names are ignored.
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
const REQUIRED = { message: "First name, last name and email are required." };
const TAKEN = { message: "Email is already registered." };
const NOT_FOUND = { message: "User not found" };
const DENIED = {
  message: "You do not have access to this page",
  code: "PAGE_ACCESS_DENIED",
};

const as = (token) => ({ Authorization: `Bearer ${token}` });
const URL = (id) => `/api/settings/updateGeneralSettings/${id}`;
const save = (token, id, body) =>
  request(app).put(URL(id)).set(as(token)).send(body);

const loginAs = async (username, password = PASSWORD) => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password });
  expect(res.status).toBe(200);
  return res.body.token;
};

// An Employee (or the main account) with its Employee and Settings records
const person = async (username, role = "Employee") => {
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
    employeeId: `EMP-${username}`,
    email: `${username}@example.com`,
    role,
  });
  await Settings.create({
    userId: user._id,
    general: { jobDescription: { employmentType: "Regular" } },
  });
  return { user, token: await loginAs(username) };
};

const superAdmin = () => person("admin", "Super Admin");
const employee = (username = "ana") => person(username);

// An Admin account as D1's Add Admin leaves it: names on the account, no Employee or
// Settings record
const plainAdmin = async (
  username = "hr.rhea",
  { firstName = "Rhea", lastName = "Cruz", pageAccess = ["dashboard"] } = {},
) => {
  const user = await User.create({
    username,
    password: PASSWORD,
    email: `${username}@example.com`,
    role: "Admin",
    status: "Active",
    firstName,
    lastName,
    pageAccess,
  });
  return { user, token: await loginAs(username) };
};

const stored = (id) => User.findById(id).lean();

const GOOD = {
  firstName: "Rhea",
  lastName: "Cruz-Santos",
  email: "rhea.santos@example.com",
};

describe("rule 9: an Admin saves its own name and email", () => {
  it("stores the trimmed names and email on the account and replies with them", async () => {
    const rhea = await plainAdmin();
    const res = await save(rhea.token, rhea.user._id, {
      firstName: "  Rhea ",
      lastName: " Cruz-Santos  ",
      email: " rhea.santos@example.com ",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      _id: String(rhea.user._id),
      firstName: "Rhea",
      lastName: "Cruz-Santos",
      email: "rhea.santos@example.com",
      employee: {},
    });

    const saved = await stored(rhea.user._id);
    expect(saved).toMatchObject({
      firstName: "Rhea",
      lastName: "Cruz-Santos",
      email: "rhea.santos@example.com",
    });
    expect(await Employee.exists({ userId: rhea.user._id })).toBeNull();
  });

  it("replies with only the screen's fields: no password, reset token or access", async () => {
    const rhea = await plainAdmin();
    const res = await save(rhea.token, rhea.user._id, GOOD);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      "_id",
      "email",
      "employee",
      "firstName",
      "lastName",
      "profilePhoto",
      "settings",
    ]);
  });

  it("keeps its own email in a new case", async () => {
    const rhea = await plainAdmin();
    const res = await save(rhea.token, rhea.user._id, {
      ...GOOD,
      email: "HR.Rhea@Example.com",
    });

    expect(res.status).toBe(200);
    expect((await stored(rhea.user._id)).email).toBe("HR.Rhea@Example.com");
  });
});

describe("rule 10: an Admin's name and email are required", () => {
  it.each([
    ["no first name", { lastName: "Cruz", email: "rhea@example.com" }],
    ["no last name", { firstName: "Rhea", email: "rhea@example.com" }],
    ["no email", { firstName: "Rhea", lastName: "Cruz" }],
    ["a blank first name", { ...GOOD, firstName: "   " }],
    ["a blank last name", { ...GOOD, lastName: "" }],
    ["a blank email", { ...GOOD, email: "  " }],
    ["a first name that is not text", { ...GOOD, firstName: 5 }],
    ["an empty body", {}],
  ])("refuses %s with 400 and saves nothing", async (_label, body) => {
    const rhea = await plainAdmin();
    const before = await stored(rhea.user._id);

    const res = await save(rhea.token, rhea.user._id, body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual(REQUIRED);
    expect(await stored(rhea.user._id)).toEqual(before);
  });
});

describe("rule 11: an email another account uses", () => {
  it("refuses another account's email, in any case, and saves nothing", async () => {
    await employee("ana");
    await plainAdmin("hr.mark", { firstName: "Mark", lastName: "Reyes" });
    const rhea = await plainAdmin();
    const before = await stored(rhea.user._id);

    for (const email of ["ANA@example.com", "hr.mark@example.com"]) {
      const res = await save(rhea.token, rhea.user._id, { ...GOOD, email });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(TAKEN);
    }
    expect(await stored(rhea.user._id)).toEqual(before);
  });

  it("refuses an email held only by an employee record", async () => {
    const { user } = await employee("ana");
    await Employee.updateOne(
      { userId: user._id },
      { $set: { email: "ana.work@example.com" } },
    );
    const rhea = await plainAdmin();
    const before = await stored(rhea.user._id);

    const res = await save(rhea.token, rhea.user._id, {
      ...GOOD,
      email: "ana.work@example.com",
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(TAKEN);
    expect(await stored(rhea.user._id)).toEqual(before);
  });
});

describe("rule 12: what the top-level fields change for each account", () => {
  it("ignores an Employee's top-level names; the employee object still saves", async () => {
    const ana = await employee("ana");
    const res = await save(ana.token, ana.user._id, {
      firstName: "Hacked",
      lastName: "Name",
      employee: { firstName: "Anabelle" },
    });

    expect(res.status).toBe(200);
    expect(res.body.employee.firstName).toBe("Anabelle");
    expect(res.body).not.toHaveProperty("firstName");
    expect(res.body).not.toHaveProperty("lastName");

    const saved = await stored(ana.user._id);
    expect(saved.firstName).toBeUndefined();
    expect(saved.lastName).toBeUndefined();
  });

  it("does not require names from an Employee (the old body still saves)", async () => {
    const ana = await employee("ana");
    const res = await save(ana.token, ana.user._id, {
      employee: { contactNumber: "09171234567" },
    });

    expect(res.status).toBe(200);
    expect(res.body.employee.contactNumber).toBe("09171234567");
  });

  it("ignores the main account's top-level names on its own account", async () => {
    const boss = await superAdmin();
    const res = await save(boss.token, boss.user._id, {
      firstName: "Other",
      lastName: "Name",
      employee: { lastName: "Boss" },
    });

    expect(res.status).toBe(200);
    expect(res.body.employee).toMatchObject({ firstName: "Admin", lastName: "Boss" });
    expect(res.body).not.toHaveProperty("firstName");

    const saved = await stored(boss.user._id);
    expect(saved.firstName).toBeUndefined();
    expect(saved.lastName).toBeUndefined();
  });

  it("keeps an older Admin with an employee record on the employee object", async () => {
    const rhea = await plainAdmin("hr.rhea", { firstName: "Rhea", lastName: "Cruz" });
    await Employee.create({
      userId: rhea.user._id,
      firstName: "Rhea",
      lastName: "Cruz",
      employeeId: "ADM-002",
      email: "hr.rhea@example.com",
      role: "Admin",
    });

    const res = await save(rhea.token, rhea.user._id, {
      firstName: "Other",
      lastName: "",
      employee: { contactNumber: "09170000000" },
    });

    expect(res.status).toBe(200);
    expect(res.body.employee.contactNumber).toBe("09170000000");
    expect(res.body).toMatchObject({ firstName: "Rhea", lastName: "Cruz" });
    expect(await stored(rhea.user._id)).toMatchObject({
      firstName: "Rhea",
      lastName: "Cruz",
    });
  });

  it("ignores top-level names when an admin edits an employee", async () => {
    const boss = await superAdmin();
    const rhea = await plainAdmin("hr.rhea", { pageAccess: ["employees"] });
    const ana = await employee("ana");

    for (const token of [boss.token, rhea.token]) {
      const res = await save(token, ana.user._id, {
        firstName: "Hacked",
        lastName: "Name",
        employee: { contactNumber: "0917" },
      });
      expect(res.status).toBe(200);
    }

    const saved = await stored(ana.user._id);
    expect(saved.firstName).toBeUndefined();
    expect(saved.lastName).toBeUndefined();
  });

  it("changes nothing else on an Admin's account from the body", async () => {
    const ana = await employee("ana");
    const rhea = await plainAdmin();
    const before = await stored(rhea.user._id);

    const res = await save(rhea.token, rhea.user._id, {
      ...GOOD,
      role: "Super Admin",
      status: "Inactive",
      pageAccess: ["employees", "settings-company", "settings-manage"],
      payAccess: [String(ana.user._id)],
      linkedEmployeeId: String(ana.user._id),
      username: "taken.over",
      password: "Another123!",
    });

    expect(res.status).toBe(200);
    const saved = await stored(rhea.user._id);
    expect(saved).toMatchObject({
      username: before.username,
      password: before.password,
      role: "Admin",
      status: "Active",
      pageAccess: before.pageAccess,
      firstName: "Rhea",
      lastName: "Cruz-Santos",
    });
    expect(saved.payAccess).toBeUndefined();
    expect(saved.linkedEmployeeId).toBeUndefined();

    // Still signed in, and the old password still works
    expect(
      (await request(app).get("/api/auth/me").set(as(rhea.token))).status,
    ).toBe(200);
    await loginAs("hr.rhea");
  });
});

describe("rule 13: who may call the route for an Admin or the main account", () => {
  it("answers 404 when an Admin targets another Admin or the main account; nothing saved", async () => {
    const boss = await superAdmin();
    const mark = await plainAdmin("hr.mark", { firstName: "Mark", lastName: "Reyes" });
    const rhea = await plainAdmin("hr.rhea", { pageAccess: ["employees"] });
    const markBefore = await stored(mark.user._id);
    const bossBefore = await stored(boss.user._id);

    for (const id of [mark.user._id, boss.user._id]) {
      const res = await save(rhea.token, id, {
        ...GOOD,
        email: "changed@example.com",
        employee: { contactNumber: "0917" },
      });
      expect(res.status).toBe(404);
      expect(res.body).toEqual(NOT_FOUND);
    }

    expect(await stored(mark.user._id)).toEqual(markBefore);
    expect(await stored(boss.user._id)).toEqual(bossBefore);
  });

  it("refuses an Admin without the Employees tick before the lookup", async () => {
    const mark = await plainAdmin("hr.mark", { firstName: "Mark", lastName: "Reyes" });
    const rhea = await plainAdmin();

    const res = await save(rhea.token, mark.user._id, GOOD);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(DENIED);
  });

  it("refuses an Employee calling for an Admin's account", async () => {
    const rhea = await plainAdmin();
    const before = await stored(rhea.user._id);
    const ana = await employee("ana");

    const res = await save(ana.token, rhea.user._id, GOOD);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Access denied" });
    expect(await stored(rhea.user._id)).toEqual(before);
  });

  it("refuses a call without a token", async () => {
    const rhea = await plainAdmin();
    const res = await request(app).put(URL(rhea.user._id)).send(GOOD);
    expect(res.status).toBe(401);
  });

  it("lets the main account still save its own settings", async () => {
    const boss = await superAdmin();
    const res = await save(boss.token, boss.user._id, {
      email: "boss@example.com",
      employee: { email: "boss@example.com" },
    });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("boss@example.com");
  });
});
