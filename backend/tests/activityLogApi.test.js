// The activity log through the API (PR E, part 1): every successful write by the Super
// Admin or an Admin leaves exactly one entry (who, what, which record, when), written
// before the reply; refusals, reads and Employees' own actions leave none; no entry
// holds an amount of money, a password or a role; and only the Super Admin reads the
// log, at GET /api/admins/activity. Rules 1 to 16 of the PR E plan (section 7), named in
// the test titles. The pure rules are in activityLog.test.js.
jest.mock("../utils/nodemailer", () => jest.fn().mockResolvedValue());

// There is no biometric device in a test: this one connects (or not) and hands over
// the punches a test sets
let mockPunches = [];
let mockDeviceConnects = true;
jest.mock(
  "../utils/zktecoService",
  () =>
    class {
      async connect() {
        return mockDeviceConnects;
      }
      async getAttendanceRecords() {
        return mockPunches;
      }
      async disconnect() {}
    },
);

const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
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
const BasicPayChange = require("../models/basicPayChange");
const Dropdown = require("../models/dropdownOption");
const Holiday = require("../models/holiday");
const DeductionTable = require("../models/deductionTable");
const ActivityLog = require("../models/activityLog");
const { pagesForRole } = require("../config/pages");
const { manilaToday } = require("../utils/leaveCredits");
const { ACTIONS } = require("../utils/activityLog");
const { logActivity, LOG_WAIT_MS } = require("../middleware/activityLog");

const ADMIN_PAGE_KEYS = pagesForRole("Admin").map((page) => page.key);
const UPLOAD_DIR = path.join(__dirname, "../uploads");
const PASSWORD = "Password123!";
const DENIED = {
  message: "You do not have access to this page",
  code: "PAGE_ACCESS_DENIED",
};
const png = Buffer.from("89504e470d0a1a0a", "hex");
const image = { filename: "picture.png", contentType: "image/png" };

let mongo;
let uploads = [];
// The sample people of the plan's worked example (section 10), made before each test
let boss;
let rhea;
let angelica;
let carlo;
let liza;

// A token as sign-in issues it (the tests here are not about signing in)
const tokenFor = (user) =>
  jwt.sign(
    { userId: String(user._id), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

// An account, signed in. insertMany skips the password hashing: nobody signs in with
// this password. `name` is how the log names the account as the one who acted.
const account = async (fields, name) => {
  const [user] = await User.insertMany([
    {
      password: "not-used-to-sign-in",
      email: `${fields.username}@example.com`,
      status: "Active",
      ...fields,
    },
  ]);
  return { user, id: String(user._id), token: tokenFor(user), name };
};

// An Employee account with its employee record and job details
const employee = async (
  username,
  firstName,
  lastName,
  employeeId,
  { status = "Active", job = {} } = {},
) => {
  const person = await account(
    { username, role: "Employee", status },
    `${firstName} ${lastName}`,
  );
  await Employee.create({
    userId: person.user._id,
    firstName,
    lastName,
    employeeId,
    email: person.user.email,
    role: "Employee",
    gender: "Female",
    contactNumber: "09170000000",
  });
  await Settings.create({
    userId: person.user._id,
    general: {
      jobDescription: {
        designation: "Staff",
        department: "Engineering",
        position: "Site Engineer",
        employmentType: "Probationary",
        startDate: new Date("2026-08-03T00:00:00Z"),
        basicPay: 18000,
        ...job,
      },
    },
  });
  return { ...person, record: `${firstName} ${lastName} (${employeeId})` };
};

// An Admin account: its name is on the account, its ticks are `pageAccess`
const admin = (username, firstName, lastName, extra = {}) =>
  account(
    {
      username,
      role: "Admin",
      firstName,
      lastName,
      pageAccess: ADMIN_PAGE_KEYS,
      ...extra,
    },
    `${firstName} ${lastName}`,
  );

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  // The unique index on a holiday's date has to exist for the "already a holiday" tests
  await Holiday.init();
  // And the one on a deduction table's kind and date
  await DeductionTable.init();
});

beforeEach(async () => {
  mockPunches = [];
  mockDeviceConnects = true;
  // The Super Admin (no employee record: the log names it by its username)
  boss = await account({ username: "admin", role: "Super Admin" }, "admin");
  angelica = await employee("angelica", "Angelica", "Ramos", "AC-008", {
    job: {
      employmentType: "Regular",
      startDate: new Date("2024-07-01T00:00:00Z"),
      regularizationDate: new Date("2025-01-06T00:00:00Z"),
      basicPay: 22000,
    },
  });
  carlo = await employee("carlo", "Carlo", "Mercado", "AC-012");
  liza = await employee("liza", "Liza", "Fernandez", "AC-013");
  // Rhea Cruz: an Admin with every tick, and Angelica and Liza on her pay list
  rhea = await admin("hr.rhea", "Rhea", "Cruz", {
    payAccess: [angelica.user._id, liza.user._id],
  });
});

afterEach(async () => {
  jest.restoreAllMocks();
  for (const file of uploads) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  uploads = [];
  await Promise.all(
    [
      User,
      Employee,
      Settings,
      CompanySettings,
      Attendance,
      LeaveApplication,
      OvertimeApplication,
      BasicPayChange,
      Dropdown,
      Holiday,
      DeductionTable,
      ActivityLog,
    ].map((Model) => Model.deleteMany({})),
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const as = (token) => ({ Authorization: `Bearer ${token}` });
const call = (method, url, who, body) => {
  let req = request(app)[method](url);
  if (who) req = req.set(as(who.token));
  return body === undefined ? req : req.send(body);
};
const missingId = () => String(new mongoose.Types.ObjectId());
const quietLog = () => jest.spyOn(console, "error").mockImplementation(() => {});

// A file the test uploaded, removed afterwards if the route didn't
const trackUpload = (urlPath) =>
  uploads.push(path.join(UPLOAD_DIR, path.basename(urlPath)));

const allEntries = () => ActivityLog.find().sort({ at: 1, _id: 1 }).lean();
const expectNoEntry = async () => {
  expect(await allEntries()).toEqual([]);
};

// Rule 5: what every stored entry holds, and nothing else (rule 6: no amount, no
// password, no old or new value, no role)
const ENTRY_KEYS = [
  "__v",
  "_id",
  "action",
  "actorId",
  "actorName",
  "at",
  "changed",
  "group",
  "note",
  "targetId",
  "targetName",
];

const expectEntry = (
  entry,
  { by, action, record, recordId, changed = [], note = "" },
) => {
  expect({
    actorId: String(entry.actorId),
    actorName: entry.actorName,
    action: entry.action,
    group: entry.group,
    targetName: entry.targetName,
    changed: entry.changed,
    note: entry.note,
  }).toEqual({
    actorId: by.id,
    actorName: by.name,
    action,
    group: ACTIONS[action].group,
    targetName: record,
    changed,
    note,
  });
  if (recordId !== undefined) {
    expect(String(entry.targetId)).toBe(String(recordId));
  }
  expect(entry.at).toBeInstanceOf(Date);
  expect(Math.abs(Date.now() - entry.at.getTime())).toBeLessThan(60 * 1000);
  for (const key of Object.keys(entry)) expect(ENTRY_KEYS).toContain(key);
  expect(JSON.stringify(entry)).not.toContain("Super Admin");
};

// Rule 1: exactly one entry, and what it says
const expectOneEntry = async (expected) => {
  const entries = await allEntries();
  expect(entries).toHaveLength(1);
  expectEntry(entries[0], expected);
  return entries[0];
};

// The newest of `count` entries
const expectLatestEntry = async (count, expected) => {
  const entries = await allEntries();
  expect(entries).toHaveLength(count);
  expectEntry(entries[count - 1], expected);
  return entries[count - 1];
};

// The words of an entry, without its ids and time (an id may hold any digits)
const wordsOf = ({ actorName, action, group, targetName, changed, note }) =>
  JSON.stringify({ actorName, action, group, targetName, changed, note });

const EDIT = (id) => `/api/employee/edit-employee-via-admin/${id}`;
const GENERAL = (id) => `/api/settings/updateGeneralSettings/${id}`;

describe("Employees", () => {
  const NEW_EMPLOYEE = {
    firstName: "Nina",
    lastName: "Lopez",
    employeeId: "AC-050",
    gender: "Female",
    email: "nina@example.com",
    username: "nina",
    password: "abcdefgh",
    designation: "Staff",
    department: "Admin",
    position: "Clerk",
    employmentType: "Probationary",
    startDate: "2026-02-02",
    timeIn: "08:00",
    timeOut: "17:00",
    basicPay: 20000,
  };

  it("rule 1: Add Employee by an Admin writes one entry naming the new person, with no pay and no password", async () => {
    const res = await call(
      "post",
      "/api/employee/add-employee-via-admin",
      rhea,
      NEW_EMPLOYEE,
    );
    expect(res.status).toBe(201);

    const entry = await expectOneEntry({
      by: rhea,
      action: "employee.add",
      record: "Nina Lopez (AC-050)",
      recordId: res.body.user._id,
    });
    expect(wordsOf(entry)).not.toContain("20000");
    expect(wordsOf(entry)).not.toContain("abcdefgh");
  });

  it("rule 2: a refused Add Employee (no basic pay) writes nothing", async () => {
    const res = await call("post", "/api/employee/add-employee-via-admin", rhea, {
      ...NEW_EMPLOYEE,
      basicPay: "",
    });
    expect(res.status).toBe(400);
    await expectNoEntry();
  });

  it("rule 6: the Super Admin's pay edit says 'basic pay' and holds no amount anywhere", async () => {
    const res = await call("put", EDIT(angelica.id), boss, { basicPay: 23000 });
    expect(res.status).toBe(200);
    // The pay itself is saved, and kept in the pay history, not in the log
    const saved = await Settings.findOne({ userId: angelica.id }).lean();
    expect(saved.general.jobDescription.basicPay).toBe(23000);

    const entry = await expectOneEntry({
      by: boss,
      action: "employee.edit",
      record: angelica.record,
      recordId: angelica.id,
      changed: ["basic pay"],
    });
    expect(wordsOf(entry)).not.toMatch(/23000|22000|23,000|22,000/);
  });

  it("rule 7: an Admin's edit of someone whose pay is hidden from it never lists basic pay (a blank one is dropped)", async () => {
    const res = await call("put", EDIT(carlo.id), rhea, {
      contactNumber: "09175550101",
      basicPay: "",
    });
    expect(res.status).toBe(200);

    await expectOneEntry({
      by: rhea,
      action: "employee.edit",
      record: carlo.record,
      recordId: carlo.id,
      changed: ["contact number"],
    });
  });

  it("rule 2: an Admin's edit carrying a pay it can't see is refused and writes nothing", async () => {
    const res = await call("put", EDIT(carlo.id), rhea, {
      contactNumber: "09175550101",
      basicPay: 30000,
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PAY_NOT_SHARED");
    await expectNoEntry();
  });

  it("rule 6: setting a password says 'password reset' only", async () => {
    const res = await call("put", EDIT(carlo.id), boss, {
      password: "NewSecret99",
    });
    expect(res.status).toBe(200);

    const entry = await expectOneEntry({
      by: boss,
      action: "employee.edit",
      record: carlo.record,
      changed: ["password reset"],
    });
    expect(JSON.stringify(entry)).not.toContain("NewSecret99");
    const stored = await User.findById(carlo.id).lean();
    expect(JSON.stringify(entry)).not.toContain(stored.password);
  });

  it("rule 8: saving the form unchanged gives an empty list", async () => {
    const res = await call("put", EDIT(angelica.id), boss, {
      firstName: "Angelica",
      lastName: "Ramos",
      employeeId: "AC-008",
      username: "angelica",
      email: "angelica@example.com",
      gender: "Female",
      contactNumber: "09170000000",
      designation: "Staff",
      department: "Engineering",
      position: "Site Engineer",
      employmentType: "Regular",
      startDate: "2024-07-01",
      regularizationDate: "2025-01-06",
      basicPay: 22000,
      password: "",
    });
    expect(res.status).toBe(200);

    await expectOneEntry({
      by: boss,
      action: "employee.edit",
      record: angelica.record,
      changed: [],
    });
  });

  it("rule 8: lists only the fields whose saved value differs, in the table's order", async () => {
    const res = await call("put", EDIT(angelica.id), boss, {
      basicPay: 23000,
      position: "Project Engineer",
      department: "Engineering",
      firstName: "Angel",
      lastName: "Ramos",
      startDate: "2024-07-01",
      timeOut: "18:00",
      birthday: "1995-03-04",
    });
    expect(res.status).toBe(200);

    await expectOneEntry({
      by: boss,
      action: "employee.edit",
      // The record is named as it is after the save
      record: "Angel Ramos (AC-008)",
      changed: ["name", "birthday", "position", "schedule", "basic pay"],
    });
  });

  it("rule 2: a refused edit (bad pay 400, unknown person 404) writes nothing", async () => {
    const bad = await call("put", EDIT(angelica.id), boss, { basicPay: -5 });
    expect(bad.status).toBe(400);
    const gone = await call("put", EDIT(missingId()), boss, { position: "X" });
    expect(gone.status).toBe(404);
    await expectNoEntry();
  });

  it("resign: the person and the last working day, not the reason", async () => {
    const res = await call(
      "patch",
      `/api/employee/employees/${liza.id}/resign`,
      rhea,
      { resignationDate: "2026-10-16", resignationReason: "Moving abroad" },
    );
    expect(res.status).toBe(200);

    const entry = await expectOneEntry({
      by: rhea,
      action: "employee.resign",
      record: liza.record,
      recordId: liza.id,
      note: "Last working day 2026-10-16",
    });
    expect(wordsOf(entry)).not.toContain("Moving abroad");
  });

  it("rule 2: a refused resignation (bad date 400, already resigned 409) writes nothing more", async () => {
    const url = `/api/employee/employees/${liza.id}/resign`;
    const bad = await call("patch", url, rhea, { resignationDate: "soon" });
    expect(bad.status).toBe(400);
    await expectNoEntry();

    const body = { resignationDate: "2026-10-16" };
    expect((await call("patch", url, rhea, body)).status).toBe(200);
    expect((await call("patch", url, rhea, body)).status).toBe(409);
    expect(await ActivityLog.countDocuments()).toBe(1);
  });

  it("reinstate: one entry for the person", async () => {
    await User.updateOne({ _id: liza.id }, { status: "Resigned" });
    const res = await call(
      "patch",
      `/api/employee/employees/${liza.id}/reinstate`,
      rhea,
    );
    expect(res.status).toBe(200);

    await expectOneEntry({
      by: rhea,
      action: "employee.reinstate",
      record: liza.record,
      recordId: liza.id,
    });
  });

  it("rule 9: a deleted employee's entries keep the name and Employee ID they had", async () => {
    const resign = await call(
      "patch",
      `/api/employee/employees/${liza.id}/resign`,
      rhea,
      { resignationDate: "2026-10-16" },
    );
    expect(resign.status).toBe(200);

    const res = await call("delete", "/api/employee/delete-employee/AC-013", boss);
    expect(res.status).toBe(200);
    expect(await User.findById(liza.id)).toBeNull();
    expect(await Employee.findOne({ employeeId: "AC-013" })).toBeNull();

    const entries = await allEntries();
    expect(entries).toHaveLength(2);
    expectEntry(entries[0], {
      by: rhea,
      action: "employee.resign",
      record: "Liza Fernandez (AC-013)",
      recordId: liza.id,
      note: "Last working day 2026-10-16",
    });
    expectEntry(entries[1], {
      by: boss,
      action: "employee.delete",
      record: "Liza Fernandez (AC-013)",
      recordId: liza.id,
    });
  });

  it("rule 2: a delete by an Admin (403) or of nobody (404) writes nothing", async () => {
    const admin403 = await call(
      "delete",
      "/api/employee/delete-employee/AC-013",
      rhea,
    );
    expect(admin403.status).toBe(403);
    const none = await call("delete", "/api/employee/delete-employee/AC-999", boss);
    expect(none.status).toBe(404);
    await expectNoEntry();
  });

  it("General settings by an Admin for someone else: 'Edited contact details' with the changed fields", async () => {
    const res = await call("put", GENERAL(carlo.id), rhea, {
      employee: { contactNumber: "09175550101", gender: "Male" },
    });
    expect(res.status).toBe(200);

    await expectOneEntry({
      by: rhea,
      action: "employee.details",
      record: carlo.record,
      recordId: carlo.id,
      changed: ["gender", "contact number"],
    });
  });

  it("an Admin's own General changes: 'Edited own details', named as the account is after the save", async () => {
    const res = await call("put", GENERAL(rhea.id), rhea, {
      firstName: "Rhea",
      lastName: "Ruiz",
      email: "hr.rhea@example.com",
    });
    expect(res.status).toBe(200);

    await expectOneEntry({
      by: { id: rhea.id, name: "Rhea Ruiz" },
      action: "account.details",
      record: "Rhea Ruiz",
      recordId: rhea.id,
      changed: ["name"],
    });
  });

  it("decision 2: the Super Admin's own General changes are logged too", async () => {
    const res = await call("put", GENERAL(boss.id), boss, {
      email: "owner@example.com",
    });
    expect(res.status).toBe(200);

    await expectOneEntry({
      by: boss,
      action: "account.details",
      record: "admin",
      recordId: boss.id,
      changed: ["email"],
    });
  });

  it("rule 3: an Employee's own General save writes nothing", async () => {
    const res = await call("put", GENERAL(angelica.id), angelica, {
      employee: { contactNumber: "09175550101" },
    });
    expect(res.status).toBe(200);
    expect(
      (await Employee.findOne({ userId: angelica.id }).lean()).contactNumber,
    ).toBe("09175550101");
    await expectNoEntry();
  });

  it("rule 2: an Employee aiming General settings at someone else (403) writes nothing", async () => {
    const res = await call("put", GENERAL(carlo.id), angelica, {
      employee: { contactNumber: "09175550101" },
    });
    expect(res.status).toBe(403);
    await expectNoEntry();
  });

  it("photos: 'Changed photo' and 'Removed photo' for the person", async () => {
    const set = await request(app)
      .put(`/api/settings/users/${carlo.id}/profile-photo`)
      .set(as(rhea.token))
      .attach("profilePhoto", png, image);
    expect(set.status).toBe(200);
    trackUpload(set.body.profilePhoto);
    await expectOneEntry({
      by: rhea,
      action: "photo.set",
      record: carlo.record,
      recordId: carlo.id,
    });

    const removed = await call(
      "delete",
      `/api/settings/remove-profile-photo/${carlo.id}`,
      rhea,
    );
    expect(removed.status).toBe(200);
    await expectLatestEntry(2, {
      by: rhea,
      action: "photo.remove",
      record: carlo.record,
      recordId: carlo.id,
    });
  });

  it("an Admin's own photo is logged against its own account", async () => {
    const set = await request(app)
      .put(`/api/settings/users/${rhea.id}/profile-photo`)
      .set(as(rhea.token))
      .attach("profilePhoto", png, image);
    expect(set.status).toBe(200);
    trackUpload(set.body.profilePhoto);

    await expectOneEntry({
      by: rhea,
      action: "photo.set",
      record: "Rhea Cruz",
      recordId: rhea.id,
    });
  });

  it("rule 3: an Employee's own photo, set and removed, writes nothing", async () => {
    const set = await request(app)
      .put(`/api/settings/users/${angelica.id}/profile-photo`)
      .set(as(angelica.token))
      .attach("profilePhoto", png, image);
    expect(set.status).toBe(200);
    trackUpload(set.body.profilePhoto);
    const removed = await call(
      "delete",
      `/api/settings/remove-profile-photo/${angelica.id}`,
      angelica,
    );
    expect(removed.status).toBe(200);
    await expectNoEntry();
  });

  it("rule 2: an upload with no file (400) writes nothing", async () => {
    const res = await call(
      "put",
      `/api/settings/users/${carlo.id}/profile-photo`,
      rhea,
    );
    expect(res.status).toBe(400);
    await expectNoEntry();
  });

  it("rule 2: an Admin can't act on its own linked employee (403), and nothing is written", async () => {
    const carl = await admin("hr.carl", "Carl", "Mercado", {
      linkedEmployeeId: carlo.user._id,
    });
    const res = await call("put", EDIT(carlo.id), carl, { position: "Lead" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("OWN_EMPLOYEE_RECORD");
    await expectNoEntry();
  });
});

describe("Sign-ups", () => {
  it("approving a sign-up writes one entry for the person; a second try (404) writes none", async () => {
    const pia = await employee("pia", "Pia", "Santos", "AC-030", {
      status: "Pending",
    });
    const url = `/api/auth/users/${pia.id}/status`;

    const res = await call("put", url, rhea);
    expect(res.status).toBe(200);
    await expectOneEntry({
      by: rhea,
      action: "signup.approve",
      record: "Pia Santos (AC-030)",
      recordId: pia.id,
    });

    expect((await call("put", url, rhea)).status).toBe(404);
    expect(await ActivityLog.countDocuments()).toBe(1);
  });

  it("rule 2: an Admin without the Employees tick (403) writes nothing", async () => {
    const pia = await employee("pia", "Pia", "Santos", "AC-030", {
      status: "Pending",
    });
    const ned = await admin("hr.ned", "Ned", "Lim", {
      pageAccess: ["admin-dashboard", "admin-settings"],
    });
    const res = await call("put", `/api/auth/users/${pia.id}/status`, ned);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(DENIED);
    await expectNoEntry();
  });
});

describe("Page access", () => {
  const url = () => `/api/access/users/${carlo.id}`;

  it("custom ticks, then back to the default: one entry each", async () => {
    const custom = await call("put", url(), rhea, {
      pages: ["payroll", "filing"],
    });
    expect(custom.status).toBe(200);
    await expectOneEntry({
      by: rhea,
      action: "access.set",
      record: carlo.record,
      recordId: carlo.id,
      note: "Custom ticks",
    });

    const reset = await call("put", url(), rhea, { reset: true });
    expect(reset.status).toBe(200);
    await expectLatestEntry(2, {
      by: rhea,
      action: "access.set",
      record: carlo.record,
      note: "Back to the default",
    });
  });

  it("rule 2: a page that doesn't exist (400) writes nothing", async () => {
    const res = await call("put", url(), rhea, { pages: ["not-a-page"] });
    expect(res.status).toBe(400);
    await expectNoEntry();
  });
});

describe("Attendance", () => {
  const url = () => `/api/attendance/edit-attendance/${carlo.id}`;
  const day = { date: "2026-11-12", timeIn: "08:00:00", timeOut: "17:00:00" };

  it("an edit names the person, the day and which times changed", async () => {
    const first = await call("put", url(), rhea, day);
    expect(first.status).toBe(201);
    await expectOneEntry({
      by: rhea,
      action: "attendance.edit",
      record: carlo.record,
      recordId: carlo.id,
      note: "2026-11-12",
      changed: ["time in", "time out"],
    });

    const later = await call("put", url(), rhea, { ...day, timeOut: "18:30:00" });
    expect(later.status).toBe(200);
    await expectLatestEntry(2, {
      by: rhea,
      action: "attendance.edit",
      record: carlo.record,
      note: "2026-11-12",
      changed: ["time out"],
    });

    // Rule 8: the same times saved again change nothing
    const same = await call("put", url(), rhea, { ...day, timeOut: "18:30:00" });
    expect(same.status).toBe(200);
    await expectLatestEntry(3, {
      by: rhea,
      action: "attendance.edit",
      record: carlo.record,
      note: "2026-11-12",
      changed: [],
    });
  });

  it("rule 2: a time out before the time in (400) writes nothing", async () => {
    const res = await call("put", url(), rhea, { ...day, timeOut: "07:00:00" });
    expect(res.status).toBe(400);
    await expectNoEntry();
  });

  it("an import from the device says how many records came in", async () => {
    mockPunches = [
      { userId: "AC-012", timestamp: "2026-11-12T08:00:00Z", time: "08:00:00" },
      { userId: "AC-404", timestamp: "2026-11-12T08:05:00Z", time: "08:05:00" },
    ];
    const res = await call("post", "/api/attendance/import-biometric", rhea, {
      deviceIp: "10.0.0.5",
    });
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);

    await expectOneEntry({
      by: rhea,
      action: "attendance.import",
      record: "Biometric device",
      note: "1 record imported",
    });
  });

  it("rule 2: an import with no device address (400), or a device that doesn't answer (500), writes nothing", async () => {
    quietLog();
    const noIp = await call("post", "/api/attendance/import-biometric", rhea, {});
    expect(noIp.status).toBe(400);

    mockDeviceConnects = false;
    const down = await call("post", "/api/attendance/import-biometric", rhea, {
      deviceIp: "10.0.0.5",
    });
    expect(down.status).toBe(500);
    await expectNoEntry();
  });

  it("a blank attendance day names the day and how many records were added", async () => {
    const res = await call("post", "/api/attendance/create-blank.today", rhea);
    expect(res.status).toBe(200);
    // Angelica, Carlo and Liza
    expect(res.body.created).toBe(3);

    await expectOneEntry({
      by: rhea,
      action: "attendance.blankDay",
      record: res.body.date,
      note: "3 records added",
    });
  });
});

describe("Filing", () => {
  const fileLeave = (person, extra = {}) =>
    LeaveApplication.create({
      userId: person.user._id,
      leaveType: "Study Leave",
      leaveDetails: "Family matter",
      startDate: "2026-11-16",
      endDate: "2026-11-18",
      ...extra,
    });
  const fileOvertime = (person) =>
    OvertimeApplication.create({
      userId: person.user._id,
      selectedOvertime: "2026-11-12",
      end: "20:00",
      overtimeDetails: "Concrete pour",
    });
  const decideLeave = (who, id, status) =>
    call("patch", `/api/filing/leave/${id}/status`, who, { status });
  const decideOvertime = (who, id, status) =>
    call("patch", `/api/filing/overtime/${id}/status`, who, { status });

  it("an approved leave names the person who filed, the type and the dates", async () => {
    const leave = await fileLeave(carlo);
    const res = await decideLeave(rhea, leave._id, "Approved");
    expect(res.status).toBe(200);

    const entry = await expectOneEntry({
      by: rhea,
      action: "leave.approve",
      record: carlo.record,
      recordId: carlo.id,
      note: "Study Leave, 2026-11-16 to 2026-11-18",
    });
    expect(wordsOf(entry)).not.toContain("Family matter");
  });

  it("a disapproved leave is its own action", async () => {
    const leave = await fileLeave(carlo, { endDate: "2026-11-16" });
    const res = await decideLeave(boss, leave._id, "Disapproved");
    expect(res.status).toBe(200);

    await expectOneEntry({
      by: boss,
      action: "leave.disapprove",
      record: carlo.record,
      recordId: carlo.id,
      note: "Study Leave, 2026-11-16",
    });
  });

  it("rule 2: a bad status (400), a missing leave (404) and one already decided (409) write nothing more", async () => {
    const leave = await fileLeave(carlo);
    expect((await decideLeave(rhea, leave._id, "Pending")).status).toBe(400);
    expect((await decideLeave(rhea, missingId(), "Approved")).status).toBe(404);
    await expectNoEntry();

    expect((await decideLeave(rhea, leave._id, "Approved")).status).toBe(200);
    expect((await decideLeave(rhea, leave._id, "Disapproved")).status).toBe(409);
    expect(await ActivityLog.countDocuments()).toBe(1);
  });

  it("rule 2: an Admin deciding its own linked employee's leave (403) writes nothing", async () => {
    const carl = await admin("hr.carl", "Carl", "Mercado", {
      linkedEmployeeId: carlo.user._id,
    });
    const leave = await fileLeave(carlo);
    const res = await decideLeave(carl, leave._id, "Approved");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("OWN_EMPLOYEE_RECORD");
    await expectNoEntry();
  });

  it("overtime decisions name the person and the day", async () => {
    const first = await fileOvertime(carlo);
    const approved = await decideOvertime(rhea, first._id, "Approved");
    expect(approved.status).toBe(200);
    await expectOneEntry({
      by: rhea,
      action: "overtime.approve",
      record: carlo.record,
      recordId: carlo.id,
      note: "2026-11-12",
    });

    const second = await fileOvertime(angelica);
    const refused = await decideOvertime(rhea, second._id, "Disapproved");
    expect(refused.status).toBe(200);
    await expectLatestEntry(2, {
      by: rhea,
      action: "overtime.disapprove",
      record: angelica.record,
      recordId: angelica.id,
      note: "2026-11-12",
    });

    // Already decided
    expect((await decideOvertime(rhea, first._id, "Disapproved")).status).toBe(
      409,
    );
    expect(await ActivityLog.countDocuments()).toBe(2);
  });

  it("rule 3: filing one's own leave writes nothing, for an Employee and on the same self-service route for an admin account", async () => {
    for (const who of [carlo, rhea]) {
      const res = await call("post", "/api/filing/apply-leave", who, {
        leaveType: "Study Leave",
        leaveDetails: "Family matter",
        startDate: "2026-12-01",
        endDate: "2026-12-01",
      });
      expect(res.status).toBe(201);
    }
    await expectNoEntry();
  });
});

describe("Company", () => {
  it("an edit lists the details that changed; the same details again list none", async () => {
    const body = { name: "ACESER Corporation", timeFormat: "24 Hour" };
    const res = await call("put", "/api/settings/company", rhea, body);
    expect(res.status).toBe(200);
    await expectOneEntry({
      by: rhea,
      action: "company.edit",
      record: "Company",
      changed: ["name", "time format"],
    });

    const again = await call("put", "/api/settings/company", rhea, {
      ...body,
      contact: "8-123-4567",
      dateFormat: "MM-DD-YYYY",
    });
    expect(again.status).toBe(200);
    await expectLatestEntry(2, {
      by: rhea,
      action: "company.edit",
      record: "Company",
      changed: ["contact"],
    });

    const same = await call("put", "/api/settings/company", rhea, body);
    expect(same.status).toBe(200);
    await expectLatestEntry(3, {
      by: rhea,
      action: "company.edit",
      record: "Company",
      changed: [],
    });
  });

  it("the logo: 'Changed company logo', then 'Removed company logo'", async () => {
    const set = await request(app)
      .put("/api/settings/company/logo")
      .set(as(boss.token))
      .attach("logo", png, image);
    expect(set.status).toBe(200);
    trackUpload(set.body.logo);
    await expectOneEntry({ by: boss, action: "company.logo", record: "Company" });

    const removed = await call("delete", "/api/settings/company/logo", boss);
    expect(removed.status).toBe(200);
    await expectLatestEntry(2, {
      by: boss,
      action: "company.logoRemove",
      record: "Company",
    });
  });

  it("rule 2: a bad format (400), a missing tick (403) and an upload with no file (400) write nothing", async () => {
    const bad = await call("put", "/api/settings/company", rhea, {
      dateFormat: "YY/MM/DD",
    });
    expect(bad.status).toBe(400);

    const ned = await admin("hr.ned", "Ned", "Lim", {
      pageAccess: ["admin-dashboard", "admin-settings"],
    });
    const noTick = await call("put", "/api/settings/company", ned, {
      name: "Mine",
    });
    expect(noTick.status).toBe(403);
    expect(noTick.body).toEqual(DENIED);

    const noFile = await call("put", "/api/settings/company/logo", rhea);
    expect(noFile.status).toBe(400);
    await expectNoEntry();
  });
});

describe("Lists", () => {
  const LIST = "/api/dropdownOption";

  it("adding, renaming and removing an item, on a list and on a department's positions", async () => {
    const steps = [
      ["post", `${LIST}/departments/add`, { option: " Marketing " }],
      [
        "put",
        `${LIST}/departments/edit`,
        { oldOption: "Marketing", newOption: "Sales" },
      ],
      ["post", `${LIST}/positions/Sales/add`, { option: "Analyst" }],
      [
        "put",
        `${LIST}/positions/Sales/edit`,
        { oldOption: "Analyst", newOption: "Senior Analyst" },
      ],
      ["delete", `${LIST}/positions/Sales/delete`, { option: "Senior Analyst" }],
      ["delete", `${LIST}/departments/delete`, { option: "Sales" }],
      ["post", `${LIST}/itemCategories/add`, { option: "Scaffolding" }],
    ];
    for (const [method, url, body] of steps) {
      const res = await call(method, url, rhea, body);
      expect([url, res.status]).toEqual([url, 200]);
    }

    const entries = await allEntries();
    expect(
      entries.map(({ action, targetName, note }) => [action, targetName, note]),
    ).toEqual([
      ["list.add", "Departments list", "Marketing"],
      ["list.rename", "Departments list", "Marketing to Sales"],
      ["list.add", "Positions in Sales", "Analyst"],
      ["list.rename", "Positions in Sales", "Analyst to Senior Analyst"],
      ["list.remove", "Positions in Sales", "Senior Analyst"],
      ["list.remove", "Departments list", "Sales"],
      ["list.add", "Item categories list", "Scaffolding"],
    ]);
    for (const entry of entries) {
      expectEntry(entry, {
        by: rhea,
        action: entry.action,
        record: entry.targetName,
        note: entry.note,
      });
      expect(entry.group).toBe("lists");
      expect(entry.targetId).toBeUndefined();
    }
  });

  it("a very long item is cut at 200 characters in the entry (the list keeps it whole)", async () => {
    const long = "Item ".repeat(100).trim();
    const res = await call("post", `${LIST}/designations/add`, rhea, {
      option: long,
    });
    expect(res.status).toBe(200);
    expect(res.body.designations).toEqual([long]);

    await expectOneEntry({
      by: rhea,
      action: "list.add",
      record: "Designations list",
      note: long.slice(0, 200),
    });
  });

  it("rule 2: an item already there (409), a list that doesn't exist (400) and a reserved item (409) write nothing more", async () => {
    const url = `${LIST}/departments/add`;
    expect((await call("post", url, rhea, { option: "Accounting" })).status).toBe(
      200,
    );
    expect((await call("post", url, rhea, { option: "accounting" })).status).toBe(
      409,
    );
    expect(
      (await call("post", `${LIST}/colors/add`, rhea, { option: "Red" })).status,
    ).toBe(400);
    expect(
      (
        await call("delete", `${LIST}/departments/delete`, rhea, {
          option: "Accounting",
        })
      ).status,
    ).toBe(409);
    expect(await ActivityLog.countDocuments()).toBe(1);
  });

  it("rule 2: an Admin without the Manage tick (403) writes nothing", async () => {
    const ned = await admin("hr.ned", "Ned", "Lim", {
      pageAccess: ["admin-dashboard", "admin-settings"],
    });
    const res = await call("post", `${LIST}/departments/add`, ned, {
      option: "Marketing",
    });
    expect(res.status).toBe(403);
    await expectNoEntry();
  });
});

describe("Admin accounts", () => {
  const NEW_ADMIN = {
    firstName: "Mara",
    lastName: "Diaz",
    username: "hr.mara",
    email: "mara@example.com",
  };

  it("creating an Admin names it and holds no temporary password", async () => {
    const res = await call("post", "/api/admins", boss, NEW_ADMIN);
    expect(res.status).toBe(201);
    expect(res.body.temporaryPassword).toEqual(expect.any(String));

    const entry = await expectOneEntry({
      by: boss,
      action: "admin.create",
      record: "Mara Diaz",
      recordId: res.body.admin.id,
    });
    expect(JSON.stringify(entry)).not.toContain(res.body.temporaryPassword);
  });

  it("editing an Admin lists name, email, ticks, pay list and linked employee, and nothing when nothing changed", async () => {
    const body = {
      lastName: "Ruiz",
      email: "rhea.ruiz@example.com",
      pages: ["employees"],
      payAccess: [carlo.id],
      linkedEmployeeId: carlo.id,
    };
    const res = await call("patch", `/api/admins/${rhea.id}`, boss, body);
    expect(res.status).toBe(200);
    const entry = await expectOneEntry({
      by: boss,
      action: "admin.edit",
      record: "Rhea Ruiz",
      recordId: rhea.id,
      changed: ["name", "email", "ticks", "pay list", "linked employee"],
    });
    // Field names only: not which pages, and not who is on the pay list
    expect(wordsOf(entry)).not.toContain("Carlo");
    expect(wordsOf(entry)).not.toContain("employees");

    const again = await call("patch", `/api/admins/${rhea.id}`, boss, body);
    expect(again.status).toBe(200);
    await expectLatestEntry(2, {
      by: boss,
      action: "admin.edit",
      record: "Rhea Ruiz",
      changed: [],
    });
  });

  it("disable, enable and reset password: one entry each, and no temporary password", async () => {
    const disabled = await call("post", `/api/admins/${rhea.id}/disable`, boss);
    expect(disabled.status).toBe(200);
    await expectOneEntry({
      by: boss,
      action: "admin.disable",
      record: "Rhea Cruz",
      recordId: rhea.id,
    });

    const enabled = await call("post", `/api/admins/${rhea.id}/enable`, boss);
    expect(enabled.status).toBe(200);
    await expectLatestEntry(2, {
      by: boss,
      action: "admin.enable",
      record: "Rhea Cruz",
    });

    const reset = await call(
      "post",
      `/api/admins/${rhea.id}/reset-password`,
      boss,
    );
    expect(reset.status).toBe(200);
    const entry = await expectLatestEntry(3, {
      by: boss,
      action: "admin.resetPassword",
      record: "Rhea Cruz",
      recordId: rhea.id,
    });
    expect(JSON.stringify(entry)).not.toContain(reset.body.temporaryPassword);
    const stored = await User.findById(rhea.id).lean();
    expect(JSON.stringify(entry)).not.toContain(stored.password);
  });

  it("rule 2: a role in the body (400), missing details (400), an unknown Admin (404) and an Admin calling (403) write nothing", async () => {
    const role = await call("patch", `/api/admins/${rhea.id}`, boss, {
      role: "Super Admin",
    });
    expect(role.status).toBe(400);
    const blank = await call("post", "/api/admins", boss, { firstName: "Mara" });
    expect(blank.status).toBe(400);
    const gone = await call("post", `/api/admins/${missingId()}/disable`, boss);
    expect(gone.status).toBe(404);
    const notAllowed = await call("post", "/api/admins", rhea, NEW_ADMIN);
    expect(notAllowed.status).toBe(403);
    await expectNoEntry();
  });

  it("an account's own password change is not logged", async () => {
    // A real password here: this account signs in with it
    const nadia = await User.create({
      username: "hr.nadia",
      password: PASSWORD,
      email: "nadia@example.com",
      role: "Admin",
      status: "Active",
      firstName: "Nadia",
      lastName: "Yu",
    });
    const res = await request(app)
      .post("/api/auth/change-password")
      .set(as(tokenFor(nadia)))
      .send({ currentPassword: PASSWORD, newPassword: "AnotherOne456" });
    expect(res.status).toBe(200);
    await expectNoEntry();
  });
});

describe("Holidays", () => {
  const CHRISTMAS = { date: "2026-12-25", name: "Christmas Day", type: "Regular" };

  it("adding and removing a holiday name it with its date", async () => {
    const added = await call("post", "/api/holidays", rhea, CHRISTMAS);
    expect(added.status).toBe(201);
    await expectOneEntry({
      by: rhea,
      action: "holiday.add",
      record: "Christmas Day, 2026-12-25",
      recordId: added.body.holiday.id,
    });

    const removed = await call(
      "delete",
      `/api/holidays/${added.body.holiday.id}`,
      rhea,
    );
    expect(removed.status).toBe(200);
    await expectLatestEntry(2, {
      by: rhea,
      action: "holiday.remove",
      record: "Christmas Day, 2026-12-25",
      recordId: added.body.holiday.id,
    });
  });

  it("an import names the year and says how many were saved and skipped, not each name", async () => {
    const year = Number(manilaToday().slice(0, 4)) + 1;
    await Holiday.create({
      date: new Date(`${year}-01-01T00:00:00Z`),
      name: "New Year's Day",
      type: "Regular",
    });
    const res = await call("post", "/api/holidays/import", rhea, {
      year,
      holidays: [
        { date: `${year}-01-01`, name: "New Year's Day", type: "Regular" },
        { date: `${year}-06-12`, name: "Independence Day", type: "Regular" },
        { date: `${year}-12-25`, name: "Christmas Day", type: "Regular" },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.saved).toHaveLength(2);

    const entry = await expectOneEntry({
      by: rhea,
      action: "holiday.import",
      record: `Holidays ${year}`,
      note: "2 holidays imported, 1 skipped",
    });
    expect(entry.targetId).toBeUndefined();
    expect(wordsOf(entry)).not.toContain("Independence");
  });

  it("rule 2: a date that already has a holiday (409), an import where every date is taken (409), a bad holiday (400) and a missing tick (403) write nothing more", async () => {
    expect((await call("post", "/api/holidays", rhea, CHRISTMAS)).status).toBe(
      201,
    );
    expect((await call("post", "/api/holidays", rhea, CHRISTMAS)).status).toBe(
      409,
    );
    expect(
      (await call("post", "/api/holidays", rhea, { ...CHRISTMAS, name: "" }))
        .status,
    ).toBe(400);
    expect(
      (await call("delete", `/api/holidays/${missingId()}`, rhea)).status,
    ).toBe(404);

    const year = Number(manilaToday().slice(0, 4)) + 1;
    await Holiday.create({
      date: new Date(`${year}-01-01T00:00:00Z`),
      name: "New Year's Day",
      type: "Regular",
    });
    const taken = await call("post", "/api/holidays/import", rhea, {
      year,
      holidays: [
        { date: `${year}-01-01`, name: "New Year's Day", type: "Regular" },
      ],
    });
    expect(taken.status).toBe(409);

    const ned = await admin("hr.ned", "Ned", "Lim", {
      pageAccess: ["admin-dashboard", "admin-settings"],
    });
    const noTick = await call("post", "/api/holidays", ned, {
      ...CHRISTMAS,
      date: "2026-12-30",
    });
    expect(noTick.status).toBe(403);

    expect(await ActivityLog.countDocuments()).toBe(1);
  });

  it("rule 2: a server error (500) writes nothing", async () => {
    quietLog();
    jest.spyOn(Holiday, "create").mockRejectedValueOnce(new Error("disk full"));
    const res = await call("post", "/api/holidays", rhea, CHRISTMAS);
    expect(res.status).toBe(500);
    await expectNoEntry();
  });
});

// The statutory deduction tables (DED-3): only the Super Admin writes them. EVERY FIGURE
// HERE IS MADE UP FOR THE TEST (not an official rate or bracket), and chosen so that none
// of them can be mistaken for part of a date: no entry may hold one.
describe("Deductions", () => {
  const TABLES = "/api/deductions/tables";
  const OFF = "/api/deductions/statutory-off";
  const ROWS = [
    { over: 0, upTo: 5300, employeeFixed: 412.35, employerFixed: 837.65 },
    {
      over: 5300,
      employeeFixed: 412.35,
      employeeRate: 7.25,
      employerFixed: 837.65,
      employerRate: 9.75,
      excessOver: 5300,
    },
  ];
  const NEW_ROWS = [
    { over: 0, upTo: 6400, employeeFixed: 433.85, employerFixed: 866.15 },
    { over: 6400, employeeFixed: 433.85, employeeRate: 8.45, employerFixed: 866.15 },
  ];
  // Every figure a table of these tests holds, as it could be written in an entry
  const FIGURES =
    /5300|5,300|6400|6,400|412|837|433|866|7\.25|9\.75|8\.45/;
  const table = (extra = {}) => ({
    kind: "sss",
    effectiveFrom: "2027-01-01",
    source: "Test issuance A",
    rows: ROWS,
    ...extra,
  });
  const expectNoFigures = async () => {
    for (const entry of await allEntries()) {
      expect(wordsOf(entry)).not.toMatch(FIGURES);
    }
  };

  it("adding, editing, confirming and marking a table as checked each write one entry, named by kind and date, with no amount and no rate", async () => {
    const added = await call("post", TABLES, boss, table());
    expect(added.status).toBe(201);
    const { id } = added.body.table;
    await expectOneEntry({
      by: boss,
      action: "table.add",
      record: "SSS table from 2027-01-01",
      recordId: id,
    });

    // New figures and a new source: the field names only
    const edited = await call(
      "put",
      `${TABLES}/${id}`,
      boss,
      table({ source: "Test issuance B", rows: NEW_ROWS }),
    );
    expect(edited.status).toBe(200);
    await expectLatestEntry(2, {
      by: boss,
      action: "table.edit",
      record: "SSS table from 2027-01-01",
      recordId: id,
      changed: ["source", "rows"],
    });

    const confirmed = await call("post", `${TABLES}/${id}/confirm`, boss, {
      checkedWith: "Maria Santos",
    });
    expect(confirmed.status).toBe(200);
    await expectLatestEntry(3, {
      by: boss,
      action: "table.confirm",
      record: "SSS table from 2027-01-01",
      recordId: id,
      note: "Checked with Maria Santos",
    });

    const checked = await call("post", `${TABLES}/${id}/checked`, boss);
    expect(checked.status).toBe(200);
    await expectLatestEntry(4, {
      by: boss,
      action: "table.checked",
      record: "SSS table from 2027-01-01",
      recordId: id,
    });

    await expectNoFigures();
    // The figures themselves are saved on the table, not in the log
    expect((await DeductionTable.findById(id).lean()).rows[1]).toMatchObject({
      over: 6400,
      employeeFixed: 433.85,
      employeeRate: 8.45,
    });
  });

  it("an edit names the table as it is after the edit and lists every changed field; the same draft again lists none", async () => {
    const added = await call("post", TABLES, boss, table());
    const { id } = added.body.table;

    const moved = await call(
      "put",
      `${TABLES}/${id}`,
      boss,
      table({
        kind: "tax",
        effectiveFrom: "2027-07-01",
        base: "cutoffGross",
        deductOn: "2nd",
      }),
    );
    expect(moved.status).toBe(200);
    await expectLatestEntry(2, {
      by: boss,
      action: "table.edit",
      record: "Withholding tax table from 2027-07-01",
      recordId: id,
      changed: ["kind", "effective date", "base", "cut-off taken on"],
    });

    const same = await call("put", `${TABLES}/${id}`, boss, moved.body.table);
    expect(same.status).toBe(200);
    await expectLatestEntry(3, {
      by: boss,
      action: "table.edit",
      record: "Withholding tax table from 2027-07-01",
      recordId: id,
      changed: [],
    });
    await expectNoFigures();
  });

  it("deleting a draft names the table that was deleted", async () => {
    const added = await call(
      "post",
      TABLES,
      boss,
      table({ kind: "pagibig", effectiveFrom: "2027-03-01" }),
    );
    const removed = await call("delete", `${TABLES}/${added.body.table.id}`, boss);
    expect(removed.status).toBe(200);

    await expectLatestEntry(2, {
      by: boss,
      action: "table.delete",
      record: "Pag-IBIG table from 2027-03-01",
      recordId: added.body.table.id,
    });
    await expectNoFigures();
  });

  it("switching deductions off names the kinds that are off, or that none is", async () => {
    const off = await call("put", OFF, boss, { kinds: ["tax", "sss"] });
    expect(off.status).toBe(200);
    const entry = await expectOneEntry({
      by: boss,
      action: "statutory.off",
      record: "Statutory deductions",
      note: "Switched off: SSS, Withholding tax",
    });
    expect(entry.targetId).toBeUndefined();

    const on = await call("put", OFF, boss, { kinds: [] });
    expect(on.status).toBe(200);
    await expectLatestEntry(2, {
      by: boss,
      action: "statutory.off",
      record: "Statutory deductions",
      note: "None switched off",
    });
  });

  it("rule 2: a refused request writes nothing more: a bad table (400), a taken date (409), a missing table (404), a confirmed table (409), no checker (400), a draft marked as checked (409), a bad kind to switch off (400)", async () => {
    const draft = await call("post", TABLES, boss, table());
    const locked = await call(
      "post",
      TABLES,
      boss,
      table({ effectiveFrom: "2026-01-01" }),
    );
    const lockedId = locked.body.table.id;
    expect(
      (
        await call("post", `${TABLES}/${lockedId}/confirm`, boss, {
          checkedWith: "Maria Santos",
        })
      ).status,
    ).toBe(200);
    // Three good requests so far
    expect(await ActivityLog.countDocuments()).toBe(3);

    const refusals = [
      ["post", TABLES, table({ effectiveFrom: "2027-02-01", source: "" }), 400],
      ["post", TABLES, table({ effectiveFrom: "2027-02-01", rows: [{ over: 0, employeeFixed: -412.35 }] }), 400],
      ["post", TABLES, table(), 409],
      ["put", `${TABLES}/${missingId()}`, table(), 404],
      ["put", `${TABLES}/${draft.body.table.id}`, table({ kind: "loan" }), 400],
      ["put", `${TABLES}/${lockedId}`, table({ effectiveFrom: "2026-01-01" }), 409],
      ["delete", `${TABLES}/${lockedId}`, undefined, 409],
      ["delete", `${TABLES}/${missingId()}`, undefined, 404],
      ["post", `${TABLES}/${draft.body.table.id}/confirm`, { checkedWith: " " }, 400],
      ["post", `${TABLES}/${lockedId}/confirm`, { checkedWith: "Maria Santos" }, 409],
      ["post", `${TABLES}/${draft.body.table.id}/checked`, undefined, 409],
      ["post", `${TABLES}/${missingId()}/checked`, undefined, 404],
      ["put", OFF, { kinds: ["loan"] }, 400],
    ];
    for (const [method, url, sent, status] of refusals) {
      const res = await call(method, url, boss, sent);
      expect([method, url, res.status]).toEqual([method, url, status]);
    }

    expect(await ActivityLog.countDocuments()).toBe(3);
  });

  it("rule 2: an Admin with every tick is refused each write (403), and nothing is written", async () => {
    const seeded = await DeductionTable.create({
      kind: "sss",
      effectiveFrom: new Date("2027-01-01T00:00:00Z"),
      source: "Test issuance A",
      rows: ROWS,
    });
    const writes = [
      ["post", TABLES, table({ kind: "tax" })],
      ["put", `${TABLES}/${seeded._id}`, table({ source: "Test issuance B" })],
      ["post", `${TABLES}/${seeded._id}/confirm`, { checkedWith: "Maria Santos" }],
      ["post", `${TABLES}/${seeded._id}/checked`, undefined],
      ["delete", `${TABLES}/${seeded._id}`, undefined],
      ["put", OFF, { kinds: ["sss"] }],
    ];
    for (const [method, url, sent] of writes) {
      const res = await call(method, url, rhea, sent);
      expect([method, url, res.status]).toEqual([method, url, 403]);
      expect(res.body).toEqual(DENIED);
    }

    await expectNoEntry();
    expect(await DeductionTable.countDocuments({ status: "Draft" })).toBe(1);
  });

  it("rule 2: a server error (500) writes nothing", async () => {
    quietLog();
    jest
      .spyOn(DeductionTable, "create")
      .mockRejectedValueOnce(new Error("disk full"));
    const res = await call("post", TABLES, boss, table());
    expect(res.status).toBe(500);
    await expectNoEntry();
  });
});

describe("who is named as the one who acted (rule 5)", () => {
  it("an account with an employee record is named by that name, without the Employee ID", async () => {
    await Employee.create({
      userId: boss.user._id,
      firstName: "Ayber",
      lastName: "Santos",
      employeeId: "ADM-001",
      email: boss.user.email,
      role: "Super Admin",
    });
    const res = await call("put", "/api/settings/company", boss, { name: "ACESER" });
    expect(res.status).toBe(200);

    await expectOneEntry({
      by: { id: boss.id, name: "Ayber Santos" },
      action: "company.edit",
      record: "Company",
      changed: ["name"],
    });
  });

  it("a renamed Admin's earlier entries keep the name it had", async () => {
    await call("put", "/api/settings/company", rhea, { name: "ACESER" });
    const renamed = await call("patch", `/api/admins/${rhea.id}`, boss, {
      lastName: "Ruiz",
    });
    expect(renamed.status).toBe(200);
    await call("put", "/api/settings/company", rhea, { name: "ACESER Corp" });

    const entries = await allEntries();
    expect(entries.map((entry) => entry.actorName)).toEqual([
      "Rhea Cruz",
      "admin",
      "Rhea Ruiz",
    ]);
  });
});

describe("rule 4: reading writes nothing", () => {
  it("no GET request writes an entry, the log's own included", async () => {
    const urls = [
      "/api/employee/employees",
      `/api/employee/employees/${angelica.id}`,
      "/api/employee/latest-employeeId",
      "/api/auth/me",
      "/api/auth/pending-users",
      `/api/access/users/${carlo.id}`,
      "/api/attendance/attendance",
      "/api/filing",
      "/api/filing/overtime",
      "/api/settings/company",
      "/api/dropdownOption",
      "/api/admins",
      "/api/admins/activity",
      "/api/holidays",
      "/api/deductions/tables",
    ];
    for (const who of [boss, rhea]) {
      for (const url of urls) {
        const res = await call("get", url, who);
        // Rhea may not open Settings > Admins; everything else answers both
        const expected = who === rhea && url.startsWith("/api/admins") ? 403 : 200;
        expect([url, res.status]).toEqual([url, expected]);
      }
    }
    // A look-up sent by POST is a read too
    const lookup = await call("post", "/api/employee/check-user-exists", boss, {
      username: "angelica",
    });
    expect(lookup.status).toBe(200);

    await expectNoEntry();
  });
});

describe("rule 16: a log fault never changes the action's reply", () => {
  it("a failed log write: the action stands, the reply is the same, and the fault is printed on the server", async () => {
    const log = quietLog();
    jest
      .spyOn(ActivityLog, "create")
      .mockRejectedValueOnce(new Error("the log is down"));

    const res = await call("put", "/api/settings/company", rhea, {
      name: "ACESER Corporation",
    });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("ACESER Corporation");
    expect(JSON.stringify(res.body)).not.toContain("the log is down");
    expect((await CompanySettings.findOne().lean()).name).toBe(
      "ACESER Corporation",
    );
    await expectNoEntry();
    expect(
      log.mock.calls.some(
        ([label, err]) =>
          label === "Activity log error:" && err?.message === "the log is down",
      ),
    ).toBe(true);
  });

  it("the reply is the same with and without the fault", async () => {
    const good = await call("post", "/api/holidays", rhea, {
      date: "2026-12-25",
      name: "Christmas Day",
      type: "Regular",
    });
    await Holiday.deleteMany({});

    quietLog();
    jest
      .spyOn(ActivityLog, "create")
      .mockRejectedValueOnce(new Error("the log is down"));
    const faulty = await call("post", "/api/holidays", rhea, {
      date: "2026-12-25",
      name: "Christmas Day",
      type: "Regular",
    });

    expect(faulty.status).toBe(good.status);
    expect({ ...faulty.body.holiday, id: "" }).toEqual({
      ...good.body.holiday,
      id: "",
    });
    expect(faulty.body.message).toBe(good.body.message);
  });

  it("a record that can't be read for the log: the action stands and its entry lists no fields", async () => {
    const log = quietLog();
    // The first read is the log's look at the company before the save
    jest.spyOn(CompanySettings, "findOne").mockImplementationOnce(() => {
      throw new Error("read failed");
    });

    const res = await call("put", "/api/settings/company", rhea, {
      name: "ACESER Corporation",
    });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("ACESER Corporation");
    await expectOneEntry({
      by: rhea,
      action: "company.edit",
      record: "Company",
      changed: [],
    });
    expect(log).toHaveBeenCalledWith(
      "Activity log error:",
      expect.objectContaining({ message: "read failed" }),
    );
  });

  it("a log write that never answers holds the reply for 2 seconds at most", async () => {
    const log = quietLog();
    jest
      .spyOn(ActivityLog, "create")
      .mockImplementationOnce(() => new Promise(() => {}));

    const started = Date.now();
    const res = await call("put", "/api/settings/company", rhea, {
      name: "ACESER Corporation",
    });
    const waited = Date.now() - started;

    expect(LOG_WAIT_MS).toBe(2000);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("ACESER Corporation");
    expect(waited).toBeGreaterThanOrEqual(LOG_WAIT_MS - 100);
    expect(waited).toBeLessThan(LOG_WAIT_MS + 3000);
    expect(log).toHaveBeenCalledWith("Activity log error:", expect.any(Error));
  });

  it("rule 1: the entry is written before the reply goes out, even when the write is slow", async () => {
    const realCreate = ActivityLog.create.bind(ActivityLog);
    jest.spyOn(ActivityLog, "create").mockImplementationOnce(async (doc) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return realCreate(doc);
    });

    const res = await call("put", "/api/settings/company", rhea, {
      name: "ACESER Corporation",
    });

    expect(res.status).toBe(200);
    // Already there when the reply arrives
    expect(await ActivityLog.countDocuments()).toBe(1);
  });

  it("a route can't be given an action that is not in the table", () => {
    expect(() => logActivity("employee.promote")).toThrow(
      "Not a logged action: employee.promote",
    );
  });
});

describe("GET /api/admins/activity", () => {
  const readLog = (who, query = {}) => {
    const req = request(app).get("/api/admins/activity").query(query);
    return who ? req.set(as(who.token)) : req;
  };
  // An entry put straight into the log, at a set time
  const seed = (by, at, extra = {}) =>
    ActivityLog.create({
      at: new Date(at),
      actorId: by.user._id,
      actorName: by.name,
      action: "employee.edit",
      group: "employees",
      targetName: "Angelica Ramos (AC-008)",
      ...extra,
    });
  const records = (res) => res.body.entries.map((entry) => entry.targetName);

  describe("rule 11: only the Super Admin reads the log", () => {
    it("refuses an Admin, even one with every tick, with the 403 of a page it can't open", async () => {
      await seed(rhea, "2026-11-16T01:00:00Z");
      const res = await readLog(rhea);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(DENIED);
    });

    it("refuses an Employee the same way", async () => {
      const res = await readLog(angelica);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(DENIED);
    });

    it("refuses a request without a token with 401", async () => {
      await seed(boss, "2026-11-16T01:00:00Z");
      const res = await readLog(null);
      expect(res.status).toBe(401);
      expect(res.body.entries).toBeUndefined();
    });

    it("answers the Super Admin, with an empty list when nothing is recorded yet", async () => {
      const res = await readLog(boss);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ entries: [], total: 0, page: 1, pageSize: 50 });
    });
  });

  describe("rule 15: the reply", () => {
    it("gives each entry as id, at, by, action, label, group, targetName, changed and note; own entries with you: true; no role anywhere", async () => {
      const mine = await seed(boss, "2026-11-16T01:00:00Z", {
        changed: ["basic pay"],
      });
      const hers = await seed(rhea, "2026-11-16T01:10:00Z", {
        action: "employee.resign",
        targetName: "Liza Fernandez (AC-013)",
        note: "Last working day 2026-10-16",
      });

      const res = await readLog(boss);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        entries: [
          {
            id: String(hers._id),
            at: "2026-11-16T01:10:00.000Z",
            by: { id: rhea.id, name: "Rhea Cruz", you: false },
            action: "employee.resign",
            label: "Marked as resigned",
            group: "employees",
            targetName: "Liza Fernandez (AC-013)",
            changed: [],
            note: "Last working day 2026-10-16",
          },
          {
            id: String(mine._id),
            at: "2026-11-16T01:00:00.000Z",
            by: { id: boss.id, name: "admin", you: true },
            action: "employee.edit",
            label: "Edited employee",
            group: "employees",
            targetName: "Angelica Ramos (AC-008)",
            changed: ["basic pay"],
            note: "",
          },
        ],
        total: 2,
        page: 1,
        pageSize: 50,
      });
      expect(res.text).not.toContain("Super Admin");
      expect(res.text.toLowerCase()).not.toContain("role");
    });

    it("says no role for entries written through the routes either", async () => {
      await call("put", EDIT(angelica.id), boss, { basicPay: 23000 });
      await call("put", EDIT(carlo.id), rhea, { contactNumber: "09175550101" });
      await call("post", "/api/admins", boss, {
        firstName: "Mara",
        lastName: "Diaz",
        username: "hr.mara",
        email: "mara@example.com",
      });

      const res = await readLog(boss);

      expect(res.body.total).toBe(3);
      expect(res.text).not.toContain("Super Admin");
      expect(res.text.toLowerCase()).not.toContain("role");
      expect(res.text).not.toMatch(/23000|22000/);
      expect(res.body.entries.map((entry) => entry.by.you)).toEqual([
        true,
        false,
        true,
      ]);
    });
  });

  describe("rule 12: newest first, 50 entries a page", () => {
    const sixty = () =>
      ActivityLog.insertMany(
        Array.from({ length: 60 }, (unused, index) => ({
          at: new Date(Date.UTC(2026, 10, 1, 0, index)),
          actorId: boss.user._id,
          actorName: "admin",
          action: "employee.edit",
          group: "employees",
          targetName: `Entry ${index + 1}`,
        })),
      );

    it("60 entries give 50, then 10, then an empty page, each with the total", async () => {
      await sixty();

      const first = await readLog(boss);
      expect(first.status).toBe(200);
      expect(first.body).toMatchObject({ total: 60, page: 1, pageSize: 50 });
      expect(first.body.entries).toHaveLength(50);
      expect(records(first)[0]).toBe("Entry 60");
      expect(records(first)[49]).toBe("Entry 11");
      const times = first.body.entries.map((entry) => entry.at);
      expect(times).toEqual([...times].sort().reverse());

      const second = await readLog(boss, { page: 2 });
      expect(second.body).toMatchObject({ total: 60, page: 2, pageSize: 50 });
      expect(records(second)).toEqual(
        Array.from({ length: 10 }, (unused, index) => `Entry ${10 - index}`),
      );

      const past = await readLog(boss, { page: 3 });
      expect(past.status).toBe(200);
      expect(past.body).toEqual({ entries: [], total: 60, page: 3, pageSize: 50 });
    });

    it.each(["0", "-2", "abc", "1.5", ""])(
      "a bad page (%p) reads as page 1",
      async (page) => {
        await sixty();
        const res = await readLog(boss, { page });
        expect(res.status).toBe(200);
        expect(res.body.page).toBe(1);
        expect(res.body.entries).toHaveLength(50);
      },
    );

    it("entries of the same moment keep one order across pages", async () => {
      const at = new Date("2026-11-16T01:00:00Z");
      await ActivityLog.insertMany(
        Array.from({ length: 55 }, (unused, index) => ({
          at,
          actorId: boss.user._id,
          actorName: "admin",
          action: "employee.edit",
          group: "employees",
          targetName: `Entry ${index + 1}`,
        })),
      );
      const first = await readLog(boss);
      const second = await readLog(boss, { page: 2 });
      const seen = [...records(first), ...records(second)];
      expect(new Set(seen).size).toBe(55);
    });
  });

  describe("rule 13: the filters", () => {
    // A: Nov 15, 11:59 PM in Manila. B: the first moment of Nov 16. C: the last moment of
    // Nov 16. D: the first moment of Nov 17.
    beforeEach(async () => {
      await seed(boss, "2026-11-15T15:59:59.999Z", { targetName: "A Angelica Ramos (AC-008)" });
      await seed(rhea, "2026-11-15T16:00:00.000Z", {
        targetName: "B Carlo Mercado (AC-012)",
      });
      await seed(rhea, "2026-11-16T15:59:59.999Z", {
        action: "leave.approve",
        group: "filing",
        targetName: "C Liza Fernandez (AC-013)",
      });
      await seed(boss, "2026-11-16T16:00:00.000Z", {
        action: "holiday.add",
        group: "holidays",
        targetName: "D Christmas Day, 2026-12-25",
      });
    });
    const letters = (res) => {
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(res.body.entries.length);
      return records(res)
        .map((name) => name[0])
        .join("");
    };

    it("no filter: everything, newest first", async () => {
      expect(letters(await readLog(boss))).toBe("DCBA");
    });

    it("by=me is the caller's own entries; by=<an Admin's id> is that Admin's", async () => {
      expect(letters(await readLog(boss, { by: "me" }))).toBe("DA");
      expect(letters(await readLog(boss, { by: rhea.id }))).toBe("CB");
    });

    it("an Admin that is disabled can still be picked", async () => {
      await User.updateOne({ _id: rhea.id }, { status: "Inactive" });
      expect(letters(await readLog(boss, { by: rhea.id }))).toBe("CB");
    });

    it("group keeps one kind of action", async () => {
      expect(letters(await readLog(boss, { group: "employees" }))).toBe("BA");
      expect(letters(await readLog(boss, { group: "filing" }))).toBe("C");
      expect(letters(await readLog(boss, { group: "lists" }))).toBe("");
    });

    it("from and to are Manila days, both included", async () => {
      expect(
        letters(await readLog(boss, { from: "2026-11-16", to: "2026-11-16" })),
      ).toBe("CB");
      expect(letters(await readLog(boss, { from: "2026-11-17" }))).toBe("D");
      expect(letters(await readLog(boss, { to: "2026-11-15" }))).toBe("A");
      expect(
        letters(await readLog(boss, { from: "2026-11-15", to: "2026-11-17" })),
      ).toBe("DCBA");
      expect(
        letters(await readLog(boss, { from: "2026-11-18", to: "2026-11-30" })),
      ).toBe("");
    });

    it("q matches part of the record's name, in any case, as plain text", async () => {
      expect(letters(await readLog(boss, { q: "LIZA" }))).toBe("C");
      expect(letters(await readLog(boss, { q: "mercado (ac-012)" }))).toBe("B");
      expect(letters(await readLog(boss, { q: "(ac-0" }))).toBe("CBA");
      expect(letters(await readLog(boss, { q: ".*" }))).toBe("");
    });

    it("the filters combine", async () => {
      expect(
        letters(
          await readLog(boss, {
            by: rhea.id,
            group: "employees",
            from: "2026-11-16",
            to: "2026-11-16",
            q: "carlo",
          }),
        ),
      ).toBe("B");
      expect(letters(await readLog(boss, { by: rhea.id, group: "filing" }))).toBe(
        "C",
      );
      expect(letters(await readLog(boss, { by: "me", q: "christmas" }))).toBe("D");
      expect(
        letters(await readLog(boss, { by: "me", from: "2026-11-16", to: "2026-11-16" })),
      ).toBe("");
    });

    it("blank filters are the same as none", async () => {
      expect(
        letters(await readLog(boss, { by: "", group: "", from: "", to: "", q: "" })),
      ).toBe("DCBA");
    });
  });

  describe("rule 14: bad filters are refused with 400", () => {
    const refused = async (query, message) => {
      const res = await readLog(boss, query);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message });
    };

    it.each([{ from: "16-11-2026" }, { to: "2026/11/16" }, { from: "2026-02-30" }])(
      "a date not in YYYY-MM-DD form: %p",
      async (query) => {
        await refused(query, "Dates must be in YYYY-MM-DD form.");
      },
    );

    it("a start after the end", async () => {
      await refused(
        { from: "2026-11-20", to: "2026-11-01" },
        "The start date is after the end date.",
      );
    });

    it("by that is not me or an Admin account: a word, an Employee, a missing account, the caller's own id", async () => {
      for (const by of ["everyone", angelica.id, missingId(), boss.id]) {
        await refused({ by }, "Not an Admin account.");
      }
    });

    it("an unknown group, named in the message", async () => {
      await refused({ group: "payroll" }, "Not a kind of action: payroll.");
    });
  });

  describe("rule 10: the log is read-only", () => {
    it("PUT, PATCH and DELETE on the log and on one entry answer 404, and the entry stays as it was", async () => {
      const entry = await seed(rhea, "2026-11-16T01:00:00Z", {
        changed: ["basic pay"],
      });
      const before = await ActivityLog.findById(entry._id).lean();

      for (const url of [
        "/api/admins/activity",
        `/api/admins/activity/${entry._id}`,
      ]) {
        for (const method of ["put", "patch", "delete"]) {
          const res = await call(method, url, boss, {
            actorName: "Somebody Else",
            changed: [],
          });
          expect([method, url, res.status]).toEqual([method, url, 404]);
        }
      }

      expect(await ActivityLog.findById(entry._id).lean()).toEqual(before);
      // And the tries left no entry of their own
      expect(await ActivityLog.countDocuments()).toBe(1);
    });

    it("an Admin trying the same is refused before that (403)", async () => {
      const entry = await seed(rhea, "2026-11-16T01:00:00Z");
      for (const method of ["put", "patch", "delete"]) {
        const res = await call(
          method,
          `/api/admins/activity/${entry._id}`,
          rhea,
          {},
        );
        expect(res.status).toBe(403);
      }
      expect(await ActivityLog.countDocuments()).toBe(1);
    });
  });

  describe("the plan's worked example (section 10)", () => {
    it("four entries from five actions, read back by the Super Admin and filtered", async () => {
      // 9:00 You: Angelica's basic pay
      const pay = await call("put", EDIT(angelica.id), boss, { basicPay: 23000 });
      expect(pay.status).toBe(200);
      // 9:10 Rhea: Carlo's contact number (he is not on her pay list)
      const contact = await call("put", EDIT(carlo.id), rhea, {
        contactNumber: "09175550101",
      });
      expect(contact.status).toBe(200);
      // 9:15 Rhea: Liza resigns
      const resign = await call(
        "patch",
        `/api/employee/employees/${liza.id}/resign`,
        rhea,
        { resignationDate: "2026-10-16" },
      );
      expect(resign.status).toBe(200);
      // 9:20 Rhea: tries something she may not do (refused, no entry)
      const refusedTry = await call(
        "delete",
        "/api/employee/delete-employee/AC-013",
        rhea,
      );
      expect(refusedTry.status).toBe(403);
      // 9:30 You: delete Liza
      const removed = await call(
        "delete",
        "/api/employee/delete-employee/AC-013",
        boss,
      );
      expect(removed.status).toBe(200);

      const res = await readLog(boss);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(4);
      expect(
        res.body.entries.map(({ by, label, targetName, changed, note }) => [
          by.you ? "You" : by.name,
          label,
          targetName,
          changed.join(", "),
          note,
        ]),
      ).toEqual([
        ["You", "Deleted employee", "Liza Fernandez (AC-013)", "", ""],
        [
          "Rhea Cruz",
          "Marked as resigned",
          "Liza Fernandez (AC-013)",
          "",
          "Last working day 2026-10-16",
        ],
        ["Rhea Cruz", "Edited employee", "Carlo Mercado (AC-012)", "contact number", ""],
        ["You", "Edited employee", "Angelica Ramos (AC-008)", "basic pay", ""],
      ]);
      expect(res.text).not.toMatch(/23000|22000/);

      // Person = Rhea Cruz: 2. Kind = Employees: 4. Today to today: 4. Search "liza": 2.
      const today = manilaToday();
      expect((await readLog(boss, { by: rhea.id })).body.total).toBe(2);
      expect((await readLog(boss, { group: "employees" })).body.total).toBe(4);
      expect((await readLog(boss, { from: today, to: today })).body.total).toBe(4);
      expect((await readLog(boss, { q: "liza" })).body.total).toBe(2);
    });
  });
});
