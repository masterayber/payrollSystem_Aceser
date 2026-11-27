// PUT /api/settings/updateGeneralSettings/:id through the `employee` object (an
// Employee's own Settings > General, the Super Admin's own profile, an older Admin with
// an employee record, and an admin saving someone else's details). A first name, last
// name or email that is sent must not be blank, with the same words as an Admin's own
// account (adminGeneralSettings.test.js), and is saved trimmed. A field that is not
// sent is left as it is. Also the screen's matching check
// (frontend/src/components/Profile/profileForm.js checkProfileForm).
import {
  ACCOUNT_FORM_MESSAGES,
  checkProfileForm,
  toProfileForm,
  toProfilePayload,
} from "../../frontend/src/components/Profile/profileForm";

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

const as = (token) => ({ Authorization: `Bearer ${token}` });
const save = (token, id, body) =>
  request(app)
    .put(`/api/settings/updateGeneralSettings/${id}`)
    .set(as(token))
    .send(body);

const loginAs = async (username) => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
};

// A person with Employee and Settings records (an Employee, or the main account)
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
    firstName: "Ana",
    lastName: "Reyes",
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

// What the account and the employee record hold now
const stored = async (id) => {
  const user = await User.findById(id).lean();
  const employee = await Employee.findOne({ userId: id }).lean();
  return {
    email: user.email,
    firstName: employee.firstName,
    lastName: employee.lastName,
    employeeEmail: employee.email,
  };
};

const UNCHANGED = {
  email: "ana@example.com",
  firstName: "Ana",
  lastName: "Reyes",
  employeeEmail: "ana@example.com",
};

// The body the Employee's Save sends (toProfilePayload), with one field changed
const screenBody = (changes = {}) => {
  const form = {
    ...toProfileForm({
      email: "ana@example.com",
      employee: {
        firstName: "Ana",
        lastName: "Reyes",
        email: "ana@example.com",
        contactNumber: "09170000001",
      },
    }),
    ...changes,
  };
  return toProfilePayload(form);
};

describe("a blank name or email that is sent is refused", () => {
  it.each([
    ["a blank first name", screenBody({ firstName: "" })],
    ["a spaces-only first name", screenBody({ firstName: "   " })],
    ["a blank last name", screenBody({ lastName: "" })],
    ["a spaces-only last name", screenBody({ lastName: "  " })],
    ["a blank email (both copies)", screenBody({ email: "" })],
    ["a spaces-only email", screenBody({ email: "   " })],
    ["a blank top-level email alone", { email: "", employee: { contactNumber: "1" } }],
    ["a blank employee email alone", { employee: { email: " " } }],
    ["a null first name", { employee: { firstName: null } }],
  ])("refuses %s from the Employee's own Save, and saves nothing", async (_l, body) => {
    const ana = await person("ana");

    const res = await save(ana.token, ana.user._id, body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual(REQUIRED);
    expect(await stored(ana.user._id)).toEqual(UNCHANGED);
    const employee = await Employee.findOne({ userId: ana.user._id }).lean();
    expect(employee.contactNumber).toBeUndefined();
  });

  it("refuses an admin saving an employee's details with a blank name", async () => {
    const sa = await person("admin", "Super Admin");
    const ana = await person("ana");

    const res = await save(sa.token, ana.user._id, {
      employee: { lastName: " " },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual(REQUIRED);
    expect(await stored(ana.user._id)).toEqual(UNCHANGED);
  });

  it("refuses the Super Admin's own profile with a blank email", async () => {
    const sa = await person("admin", "Super Admin");

    const res = await save(sa.token, sa.user._id, screenBody({ email: "" }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual(REQUIRED);
    expect((await User.findById(sa.user._id)).email).toBe("admin@example.com");
  });
});

describe("what still saves", () => {
  it("saves the Employee's full Save with the names and email trimmed", async () => {
    const ana = await person("ana");

    const res = await save(
      ana.token,
      ana.user._id,
      screenBody({
        firstName: "  Ana Marie ",
        lastName: " Reyes-Cruz ",
        email: " ana.cruz@example.com ",
      }),
    );

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("ana.cruz@example.com");
    expect(res.body.employee).toMatchObject({
      firstName: "Ana Marie",
      lastName: "Reyes-Cruz",
      email: "ana.cruz@example.com",
      contactNumber: "09170000001",
    });
    expect(await stored(ana.user._id)).toEqual({
      email: "ana.cruz@example.com",
      firstName: "Ana Marie",
      lastName: "Reyes-Cruz",
      employeeEmail: "ana.cruz@example.com",
    });
  });

  it("leaves the names and email alone when they are not sent", async () => {
    const ana = await person("ana");

    const res = await save(ana.token, ana.user._id, {
      employee: { contactNumber: "09171234567" },
    });

    expect(res.status).toBe(200);
    expect(res.body.employee.contactNumber).toBe("09171234567");
    expect(await stored(ana.user._id)).toEqual(UNCHANGED);
  });

  it("lets an admin save an employee's contact details without the names", async () => {
    const sa = await person("admin", "Super Admin");
    const ana = await person("ana");

    const res = await save(sa.token, ana.user._id, {
      employee: { contactNumber: "09179999999" },
    });

    expect(res.status).toBe(200);
    expect(await stored(ana.user._id)).toEqual(UNCHANGED);
  });

  // Decision 3 of the 2026-11-13 Friday batch: the shape check stays on Admin accounts
  // until the odd emails already stored are counted (adminGeneralSettings.test.js)
  it("still saves a badly shaped email, trimmed, for now", async () => {
    const ana = await person("ana");

    const res = await save(ana.token, ana.user._id, screenBody({ email: " ana@example " }));

    expect(res.status).toBe(200);
    expect((await stored(ana.user._id)).email).toBe("ana@example");
  });

  it("refuses a changed email another account already uses, in another case", async () => {
    const ana = await person("ana");
    await person("ben");

    const res = await save(
      ana.token,
      ana.user._id,
      screenBody({ email: " Ben@Example.com " }),
    );

    expect(res.status).toBe(400);
    expect(res.body).toEqual(TAKEN);
    expect(await stored(ana.user._id)).toEqual(UNCHANGED);
  });
});

describe("the screen's check before Save (checkProfileForm)", () => {
  const FORM = toProfileForm({
    email: "ana@example.com",
    employee: { firstName: "Ana", lastName: "Reyes", email: "ana@example.com" },
  });

  it("uses the server's words", () => {
    expect(ACCOUNT_FORM_MESSAGES.required).toBe(REQUIRED.message);
  });

  it("lets a filled form through", () => {
    expect(checkProfileForm(FORM)).toBe("");
    expect(checkProfileForm({ ...FORM, firstName: " Ana " })).toBe("");
  });

  it.each([
    ["firstName", ""],
    ["firstName", "   "],
    ["lastName", ""],
    ["email", ""],
    ["email", "  "],
  ])("asks for the names and email when %s is %p", (field, value) => {
    expect(checkProfileForm({ ...FORM, [field]: value })).toBe(
      ACCOUNT_FORM_MESSAGES.required,
    );
  });

  it("lets a badly shaped email through, like the server (for now)", () => {
    expect(checkProfileForm({ ...FORM, email: "ana@example" })).toBe("");
  });
});
