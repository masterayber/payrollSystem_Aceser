// Pay items through the API (DED-4, routes/deductions.js): the Employee Deduction Log
// (GET /api/deductions/log), the item list and its filters, adding, changing, pausing,
// resuming, stopping and deleting an item, and an employee's own items
// (GET /api/deductions/items/mine). Who may call what: the Deductions tick, the pay
// list (rule 22: the same 404 for anyone the caller may not see), the own-record 403
// (rule 23), and what each write leaves in the activity log. The pure rules (when an
// item lands, balances, Completed, the 409 for an item on an issued payslip) are in
// payItems.test.js: there are no payslips until DED-6, so nothing is paid on any item
// here.
//
// Every amount in this file is made up for the tests, and chosen so it can't be taken
// for part of a date or an Employee ID in an activity log entry.
jest.mock("../utils/nodemailer", () => jest.fn().mockResolvedValue());

const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const ActivityLog = require("../models/activityLog");
const PayItem = require("../models/payItem");

const DENIED = {
  message: "You do not have access to this page",
  code: "PAGE_ACCESS_DENIED",
};
const ADMIN_ONLY = { message: "Admin access required" };
const EMPLOYEE_NOT_FOUND = { message: "Employee not found." };
const ITEM_NOT_FOUND = { message: "Item not found." };
const OWN_RECORD = {
  message: "You can't act on your own employee record.",
  code: "OWN_EMPLOYEE_RECORD",
};

const LOG = "/api/deductions/log";
const ITEMS = "/api/deductions/items";
const MINE = "/api/deductions/items/mine";

// The made-up amounts, and every way an entry could write them
const LOAN_TOTAL = 6543.21;
const LOAN_AMOUNT = 1234.56;
const NEW_AMOUNT = 1357.91;
const FIGURES = /6543|6,543|1234|1,234|1357|1,357/;

let mongo;
let boss;
let rhea;
let ned;
let angelica;
let carlo;
let liza;
let rheaSelf;
let pete;
let ivan;
let rose;
let mia;

// A token as sign-in issues it (the tests here are not about signing in)
const tokenFor = (user) =>
  jwt.sign({ userId: String(user._id), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

// An account, signed in. insertMany skips the password hashing.
const account = async (fields) => {
  const [user] = await User.insertMany([
    {
      password: "not-used-to-sign-in",
      email: `${fields.username}@example.com`,
      status: "Active",
      ...fields,
    },
  ]);
  return { user, id: String(user._id), token: tokenFor(user) };
};

// An Employee account with its employee record and job details
const employee = async (
  username,
  firstName,
  lastName,
  employeeId,
  { status = "Active", resignationDate = null, pageAccess } = {},
) => {
  const person = await account({
    username,
    role: "Employee",
    status,
    ...(pageAccess ? { pageAccess } : {}),
  });
  await Employee.create({
    userId: person.user._id,
    firstName,
    lastName,
    employeeId,
    email: person.user.email,
    role: "Employee",
  });
  await Settings.create({
    userId: person.user._id,
    general: {
      jobDescription: {
        employmentType: "Regular",
        startDate: new Date("2024-07-01T00:00:00Z"),
        basicPay: 22000,
        resignationDate: resignationDate
          ? new Date(`${resignationDate}T00:00:00Z`)
          : null,
      },
    },
  });
  return {
    ...person,
    firstName,
    lastName,
    employeeId,
    record: `${firstName} ${lastName} (${employeeId})`,
  };
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

beforeEach(async () => {
  // The Super Admin (no employee record: named by its username)
  boss = await account({ username: "admin", role: "Super Admin" });
  angelica = await employee("angelica", "Angelica", "Ramos", "AC-008");
  carlo = await employee("carlo", "Carlo", "Mercado", "AC-012");
  liza = await employee("liza", "Liza", "Fernandez", "AC-013", {
    status: "Resigned",
    resignationDate: "2026-10-16",
  });
  // Rhea's own employee record, as an Employee-role account linked to her Admin account
  rheaSelf = await employee("rhea.cruz", "Rhea", "Cruz", "AC-020");
  // Never on payroll: Pending, Inactive, and Resigned with no last working day
  pete = await employee("pete", "Pete", "Lopez", "AC-030", { status: "Pending" });
  ivan = await employee("ivan", "Ivan", "Reyes", "AC-031", { status: "Inactive" });
  rose = await employee("rose", "Rose", "Tan", "AC-032", { status: "Resigned" });
  // Rhea: an Admin with the Deductions tick; Angelica, Liza, her own record and the
  // three people not on payroll on her pay list, not Carlo
  rhea = await account({
    username: "hr.rhea",
    role: "Admin",
    firstName: "Rhea",
    lastName: "Cruz",
    pageAccess: ["deductions"],
    payAccess: [angelica, liza, rheaSelf, pete, ivan, rose].map((one) => one.user._id),
    linkedEmployeeId: rheaSelf.user._id,
  });
  // Ned: an Admin with every everyday tick but Deductions, and everyone on his pay list
  ned = await account({
    username: "hr.ned",
    role: "Admin",
    firstName: "Ned",
    lastName: "Lim",
    pageAccess: ["employees", "admin-payslips", "admin-filing", "reports"],
    payAccess: [angelica, carlo, liza].map((one) => one.user._id),
  });
  // Another Admin account: hidden, never an employee
  mia = await account({ username: "hr.mia", role: "Admin", pageAccess: ["deductions"] });
});

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all(
    [User, Employee, Settings, ActivityLog, PayItem].map((Model) => Model.deleteMany({})),
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const call = (method, url, who, sent) => {
  let req = request(app)[method](url);
  if (who) req = req.set({ Authorization: `Bearer ${who.token}` });
  return sent === undefined ? req : req.send(sent);
};
const readLog = (who) => call("get", LOG, who);
const list = (who, query = "") => call("get", `${ITEMS}${query}`, who);
const add = (who, sent) => call("post", ITEMS, who, sent);
const change = (who, id, sent) => call("patch", `${ITEMS}/${id}`, who, sent);
const stop = (who, id) => call("post", `${ITEMS}/${id}/stop`, who);
const remove = (who, id) => call("delete", `${ITEMS}/${id}`, who);
const mine = (who) => call("get", MINE, who);
const missingId = () => String(new mongoose.Types.ObjectId());
const quietLog = () => jest.spyOn(console, "error").mockImplementation(() => {});

// A Company Loan as the form sends it
const loan = (who, extra = {}) => ({
  userId: who.id,
  kind: "deduction",
  type: "Company Loan",
  amountPerCutoff: LOAN_AMOUNT,
  total: LOAN_TOTAL,
  repeat: "instalments",
  schedule: "every",
  startCutoff: "2026-12-1st",
  ...extra,
});

// Saved straight to the model, as an item that is already there
const seedItem = (who, extra = {}) =>
  PayItem.create({
    userId: who.user._id,
    kind: "deduction",
    type: "Company Loan",
    amountPerCutoff: LOAN_AMOUNT,
    total: LOAN_TOTAL,
    repeat: "instalments",
    schedule: "every",
    startCutoff: "2026-12-1st",
    taxable: false,
    createdBy: boss.user._id,
    ...extra,
  });

// Every stored item as text, to prove a refused request changed nothing
const storedItems = async () => JSON.stringify(await PayItem.find().sort({ _id: 1 }).lean());
const allEntries = () => ActivityLog.find().sort({ at: 1, _id: 1 }).lean();

describe("GET /api/deductions/log", () => {
  it("the Super Admin: every payroll employee, Active first then by last name, Resigned with the last working day", async () => {
    const res = await readLog(boss);

    expect(res.status).toBe(200);
    expect(res.body.map((row) => [row.lastName, row.status])).toEqual([
      ["Cruz", "Active"],
      ["Mercado", "Active"],
      ["Ramos", "Active"],
      ["Fernandez", "Resigned"],
    ]);
    expect(res.body[3]).toStrictEqual({
      userId: liza.id,
      employeeId: "AC-013",
      firstName: "Liza",
      lastName: "Fernandez",
      status: "Resigned",
      resignationDate: "2026-10-16",
      withholdingTax: null,
      deductions: null,
      loans: 0,
      itemCount: 0,
      ownRecord: false,
    });
    expect(res.body[2]).toMatchObject({ employeeId: "AC-008", resignationDate: null });
    // Never a Pending, Inactive or undated Resigned employee, nor an admin account
    for (const hidden of [pete, ivan, rose, mia, rhea, boss]) {
      expect(res.text).not.toContain(hidden.id);
    }
  });

  it("an Admin: only the payroll employees on its pay list, with its own record marked", async () => {
    const res = await readLog(rhea);

    expect(res.status).toBe(200);
    expect(res.body.map((row) => [row.firstName, row.ownRecord])).toEqual([
      ["Rhea", true],
      ["Angelica", false],
      ["Liza", false],
    ]);
    expect(res.text).not.toContain(carlo.id);
  });

  it("loans add up the open instalment deductions; itemCount counts every item", async () => {
    await seedItem(angelica);
    await seedItem(angelica, { type: "SSS Loan", total: 2468.02, amountPerCutoff: 500, status: "Paused" });
    await seedItem(angelica, { type: "Pag-IBIG Loan", status: "Stopped" });
    await seedItem(angelica, { type: "Cash Advance", repeat: "once", total: null });
    await seedItem(angelica, {
      kind: "earning",
      type: "Allowance",
      repeat: "untilStopped",
      total: null,
      taxable: true,
    });
    await seedItem(carlo);

    const res = await readLog(boss);
    const row = (who) => res.body.find((one) => one.userId === who.id);

    expect(row(angelica)).toMatchObject({ loans: 9011.23, itemCount: 5 });
    expect(row(carlo)).toMatchObject({ loans: LOAN_TOTAL, itemCount: 1 });
    expect(row(liza)).toMatchObject({ loans: 0, itemCount: 0 });
  });

  it("refuses an Admin without the Deductions tick, an Employee, and a request with no token", async () => {
    const byNed = await readLog(ned);
    expect([byNed.status, byNed.body]).toEqual([403, DENIED]);

    const byEmployee = await readLog(angelica);
    expect([byEmployee.status, byEmployee.body]).toEqual([403, ADMIN_ONLY]);

    expect((await readLog(null)).status).toBe(401);
  });

  it("answers 500 with a message when the log can't be read", async () => {
    quietLog();
    jest.spyOn(PayItem, "find").mockImplementationOnce(() => {
      throw new Error("database down");
    });

    const res = await readLog(boss);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Error reading the deduction log" });
  });
});

describe("GET /api/deductions/items", () => {
  it("the Super Admin: every payroll employee's items, oldest first, in the screen's shape", async () => {
    const first = await seedItem(angelica, { label: "Car loan", note: "Agreed with HR" });
    const second = await seedItem(carlo, { type: "Cash Advance", repeat: "once", total: null });
    // Items of people not on payroll are never listed
    await seedItem(pete);
    await seedItem(ivan);

    const res = await list(boss);

    expect(res.status).toBe(200);
    expect(res.body.map((item) => item.id)).toEqual([String(first._id), String(second._id)]);
    expect(res.body[0]).toStrictEqual({
      id: String(first._id),
      userId: angelica.id,
      employeeId: "AC-008",
      name: "Angelica Ramos",
      kind: "deduction",
      type: "Company Loan",
      label: "Car loan",
      note: "Agreed with HR",
      amountPerCutoff: LOAN_AMOUNT,
      total: LOAN_TOTAL,
      paid: 0,
      balance: LOAN_TOTAL,
      repeat: "instalments",
      schedule: "every",
      startCutoff: "2026-12-1st",
      taxable: false,
      status: "Active",
      createdAt: first.createdAt.toISOString(),
      stoppedAt: null,
    });
    expect(res.body[1]).toMatchObject({ name: "Carlo Mercado", total: null, balance: null });
  });

  it("an Admin: never the items of anyone off its pay list", async () => {
    await seedItem(angelica);
    await seedItem(liza, { type: "Cash Advance", repeat: "once", total: null });
    await seedItem(carlo);

    const res = await list(rhea);

    expect(res.status).toBe(200);
    expect(res.body.map((item) => item.name)).toEqual(["Angelica Ramos", "Liza Fernandez"]);
    expect(res.text).not.toContain(carlo.id);
  });

  it("?userId= keeps one employee's items", async () => {
    await seedItem(angelica);
    const lizas = await seedItem(liza, { type: "Cash Advance", repeat: "once", total: null });

    const res = await list(rhea, `?userId=${liza.id}`);

    expect(res.status).toBe(200);
    expect(res.body.map((item) => item.id)).toEqual([String(lizas._id)]);
  });

  it("?userId= for anyone the caller may not see: the same 404 as a missing employee", async () => {
    await seedItem(carlo);
    const cases = [
      [rhea, carlo.id],
      [rhea, mia.id],
      [rhea, pete.id],
      [rhea, ivan.id],
      [rhea, rose.id],
      [rhea, missingId()],
      [rhea, "not-an-id"],
      [boss, mia.id],
      [boss, boss.id],
      [boss, pete.id],
      [boss, missingId()],
    ];
    for (const [who, userId] of cases) {
      const res = await list(who, `?userId=${userId}`);
      expect([userId, res.status, res.body]).toEqual([userId, 404, EMPLOYEE_NOT_FOUND]);
    }
  });

  it("?status= keeps the items with that worked-out status", async () => {
    await seedItem(angelica);
    const paused = await seedItem(angelica, { status: "Paused" });
    const stopped = await seedItem(carlo, { status: "Stopped" });

    const byStatus = async (status) =>
      (await list(boss, `?status=${status}`)).body.map((item) => item.id);

    expect(await byStatus("Paused")).toEqual([String(paused._id)]);
    expect(await byStatus("Stopped")).toEqual([String(stopped._id)]);
    expect(await byStatus("Completed")).toEqual([]);
    expect((await byStatus("Active")).length).toBe(1);
  });

  it("refuses a status that is not one with 400", async () => {
    const res = await list(boss, "?status=Open");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Choose a status from the list." });
  });

  it("refuses an Admin without the Deductions tick, and an Employee", async () => {
    const byNed = await list(ned);
    expect([byNed.status, byNed.body]).toEqual([403, DENIED]);

    const byEmployee = await list(angelica);
    expect([byEmployee.status, byEmployee.body]).toEqual([403, ADMIN_ONLY]);
  });
});

describe("POST /api/deductions/items", () => {
  it("adds a deduction and answers it", async () => {
    const res = await add(rhea, loan(angelica, { label: " Car loan ", note: "Agreed with HR" }));

    expect(res.status).toBe(201);
    expect(res.body).toStrictEqual({
      message: "Deduction saved.",
      item: {
        id: expect.any(String),
        userId: angelica.id,
        employeeId: "AC-008",
        name: "Angelica Ramos",
        kind: "deduction",
        type: "Company Loan",
        label: "Car loan",
        note: "Agreed with HR",
        amountPerCutoff: LOAN_AMOUNT,
        total: LOAN_TOTAL,
        paid: 0,
        balance: LOAN_TOTAL,
        repeat: "instalments",
        schedule: "every",
        startCutoff: "2026-12-1st",
        taxable: false,
        status: "Active",
        createdAt: expect.any(String),
        stoppedAt: null,
      },
    });

    const stored = await PayItem.findById(res.body.item.id).lean();
    expect(stored).toMatchObject({
      kind: "deduction",
      type: "Company Loan",
      amountPerCutoff: LOAN_AMOUNT,
      total: LOAN_TOTAL,
      status: "Active",
      stoppedBy: null,
      stoppedAt: null,
    });
    expect(String(stored.userId)).toBe(angelica.id);
    expect(String(stored.createdBy)).toBe(rhea.id);
  });

  it("adds an earning: 'Earning saved.', taxable unless told otherwise", async () => {
    const res = await add(boss, {
      userId: carlo.id,
      kind: "earning",
      type: "Allowance",
      amountPerCutoff: "750.50",
      repeat: "untilStopped",
      schedule: "2nd",
      startCutoff: "2027-01-1st",
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Earning saved.");
    expect(res.body.item).toMatchObject({
      kind: "earning",
      amountPerCutoff: 750.5,
      total: null,
      balance: null,
      taxable: true,
      schedule: "2nd",
    });
  });

  it("a Resigned employee with a last working day can get an item (final pay takes it later)", async () => {
    const res = await add(rhea, {
      userId: liza.id,
      kind: "deduction",
      type: "Cash Advance",
      amountPerCutoff: 2000,
      repeat: "once",
      schedule: "every",
      startCutoff: "2026-10-1st",
    });

    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ name: "Liza Fernandez", repeat: "once", status: "Active" });
  });

  it("takes only the form's fields: a body can't stop, pause or sign its own item", async () => {
    const res = await add(
      boss,
      loan(angelica, {
        status: "Stopped",
        stoppedAt: "2026-01-01",
        stoppedBy: rhea.id,
        createdBy: rhea.id,
      }),
    );

    expect(res.status).toBe(201);
    const stored = await PayItem.findById(res.body.item.id).lean();
    expect(stored).toMatchObject({ status: "Active", stoppedAt: null, stoppedBy: null });
    expect(String(stored.createdBy)).toBe(boss.id);
  });

  it("404 for anyone the caller may not see, checked before the body: the same answer as a missing employee", async () => {
    const cases = [
      [rhea, carlo.id],
      [rhea, mia.id],
      [rhea, pete.id],
      [rhea, ivan.id],
      [rhea, rose.id],
      [rhea, missingId()],
      [rhea, "not-an-id"],
      [rhea, undefined],
      [rhea, { $ne: null }],
      [boss, mia.id],
      [boss, boss.id],
      [boss, pete.id],
    ];
    for (const [who, userId] of cases) {
      for (const body of [loan(angelica, { userId }), { userId, amountPerCutoff: 0 }]) {
        const res = await add(who, body);
        expect([userId, res.status, res.body]).toEqual([userId, 404, EMPLOYEE_NOT_FOUND]);
      }
    }
    expect(await PayItem.countDocuments()).toBe(0);
  });

  it("403 for an Admin's own linked employee, whatever the body; nothing saved", async () => {
    for (const body of [loan(rheaSelf), { userId: rheaSelf.id, amountPerCutoff: 0 }]) {
      const res = await add(rhea, body);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(OWN_RECORD);
    }
    expect(await PayItem.countDocuments()).toBe(0);

    // The Super Admin may add one for that person
    expect((await add(boss, loan(rheaSelf))).status).toBe(201);
  });

  it.each([
    ["a type that is not on the list", { type: "Car Loan" }, "Choose a type from the list."],
    ["an amount of 0", { amountPerCutoff: 0 }, "Enter an amount more than 0."],
    ["a total less than one instalment", { total: 1000 }, "The total can't be less than one instalment."],
    ["instalments with no total", { total: undefined }, "Enter the total to be paid in instalments."],
    ["no start cut-off", { startCutoff: "" }, "Choose the cut-off it starts on."],
    ["a schedule that is not one", { schedule: "weekly" }, "Choose which cut-offs it lands on: every cut-off, the 1st or the 2nd."],
  ])("refuses %s with 400 and saves nothing", async (label, extra, message) => {
    const res = await add(rhea, loan(angelica, extra));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message });
    expect(await PayItem.countDocuments()).toBe(0);
  });

  it("refuses an Admin without the Deductions tick, and an Employee for itself; nothing saved", async () => {
    const byNed = await add(ned, loan(angelica));
    expect([byNed.status, byNed.body]).toEqual([403, DENIED]);

    const byEmployee = await add(angelica, loan(angelica));
    expect([byEmployee.status, byEmployee.body]).toEqual([403, ADMIN_ONLY]);

    expect(await PayItem.countDocuments()).toBe(0);
  });
});

describe("PATCH /api/deductions/items/:id", () => {
  it("changes the amount and the note", async () => {
    const item = await seedItem(angelica);

    const res = await change(rhea, item._id, { amountPerCutoff: NEW_AMOUNT, note: "Raised" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Item updated.");
    expect(res.body.item).toMatchObject({
      id: String(item._id),
      amountPerCutoff: NEW_AMOUNT,
      note: "Raised",
      status: "Active",
    });
    expect(await PayItem.findById(item._id).lean()).toMatchObject({
      amountPerCutoff: NEW_AMOUNT,
      note: "Raised",
      total: LOAN_TOTAL,
    });
  });

  it("pauses and resumes an item", async () => {
    const item = await seedItem(angelica);

    const paused = await change(rhea, item._id, { status: "Paused" });
    expect(paused.status).toBe(200);
    expect(paused.body.message).toBe("Paused.");
    expect(paused.body.item.status).toBe("Paused");

    const again = await change(rhea, item._id, { status: "Paused" });
    expect([again.status, again.body]).toEqual([409, { message: "This item is already paused." }]);

    const resumed = await change(rhea, item._id, { status: "Active" });
    expect(resumed.status).toBe(200);
    expect(resumed.body.message).toBe("Resumed.");
    expect((await PayItem.findById(item._id).lean()).status).toBe("Active");
  });

  it("refuses a stopped item with 409 and changes nothing", async () => {
    const item = await seedItem(angelica, { status: "Stopped" });
    const before = await storedItems();

    for (const body of [{ amountPerCutoff: NEW_AMOUNT }, { status: "Active" }]) {
      const res = await change(rhea, item._id, body);
      expect([res.status, res.body]).toEqual([409, { message: "A stopped item can't be changed." }]);
    }
    expect(await storedItems()).toBe(before);
  });

  it.each([
    ["an amount of 0", { amountPerCutoff: 0 }, "Enter an amount more than 0."],
    ["another type", { type: "SSS Loan" }, "Only the amount, total, schedule, label and note can be changed. Stop this item and add a new one instead."],
    ["a total less than one instalment", { total: 100 }, "The total can't be less than one instalment."],
    ["a pause with another change", { status: "Paused", note: "x" }, "Pause or resume an item on its own, with no other change."],
    ["nothing that changes", { note: "" }, "Nothing was changed."],
  ])("refuses %s with 400 and leaves the item as it was", async (label, body, message) => {
    const item = await seedItem(angelica);
    const before = await storedItems();

    const res = await change(rhea, item._id, body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message });
    expect(await storedItems()).toBe(before);
  });
});

describe("POST /api/deductions/items/:id/stop", () => {
  it("stops an item, stamping who and when; it stays on record", async () => {
    const item = await seedItem(angelica, { status: "Paused" });
    const before = Date.now();

    const res = await stop(rhea, item._id);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Stopped.");
    expect(res.body.item).toMatchObject({ id: String(item._id), status: "Stopped", stoppedAt: expect.any(String) });
    expect(res.body.item).not.toHaveProperty("stoppedBy");

    const stored = await PayItem.findById(item._id).lean();
    expect(stored.status).toBe("Stopped");
    expect(String(stored.stoppedBy)).toBe(rhea.id);
    expect(stored.stoppedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(stored.stoppedAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);

    const again = await stop(rhea, item._id);
    expect([again.status, again.body]).toEqual([409, { message: "This item is already stopped." }]);
  });
});

describe("DELETE /api/deductions/items/:id", () => {
  it("deletes an item on no issued payslip, Stopped ones too", async () => {
    const item = await seedItem(angelica);
    const stopped = await seedItem(angelica, { status: "Stopped" });
    const kept = await seedItem(liza);

    for (const one of [item, stopped]) {
      const res = await remove(rhea, one._id);
      expect([res.status, res.body]).toEqual([200, { message: "Deleted." }]);
    }
    expect((await PayItem.find().lean()).map((one) => String(one._id))).toEqual([String(kept._id)]);
  });
});

describe("change, stop and delete: who may act on which item", () => {
  const ACTIONS = [
    ["PATCH", (who, id) => change(who, id, { amountPerCutoff: NEW_AMOUNT })],
    ["pause", (who, id) => change(who, id, { status: "Paused" })],
    ["stop", stop],
    ["DELETE", remove],
  ];

  it.each(ACTIONS)(
    "%s: 404 'Item not found.' for an item the caller may not see, a missing one or an id that isn't one",
    async (label, act) => {
      const carlos = await seedItem(carlo);
      // An item of someone off payroll, even for the Super Admin
      const petes = await seedItem(pete);
      const before = await storedItems();

      for (const [who, id] of [
        [rhea, carlos._id],
        [rhea, petes._id],
        [boss, petes._id],
        [rhea, missingId()],
        [rhea, "not-an-id"],
      ]) {
        const res = await act(who, id);
        expect([String(id), res.status, res.body]).toEqual([String(id), 404, ITEM_NOT_FOUND]);
      }
      expect(await storedItems()).toBe(before);
      expect(await ActivityLog.countDocuments()).toBe(0);
    },
  );

  it.each(ACTIONS)(
    "%s: 403 for an Admin's own linked employee; the Super Admin may",
    async (label, act) => {
      const item = await seedItem(rheaSelf);
      const before = await storedItems();

      const res = await act(rhea, item._id);

      expect([res.status, res.body]).toEqual([403, OWN_RECORD]);
      expect(await storedItems()).toBe(before);
      expect(await ActivityLog.countDocuments()).toBe(0);

      expect((await act(boss, item._id)).status).toBe(200);
    },
  );

  it.each(ACTIONS)(
    "%s: refused for an Admin without the Deductions tick and an Employee",
    async (label, act) => {
      const item = await seedItem(angelica);
      const before = await storedItems();

      const byNed = await act(ned, item._id);
      expect([byNed.status, byNed.body]).toEqual([403, DENIED]);
      const byEmployee = await act(angelica, item._id);
      expect([byEmployee.status, byEmployee.body]).toEqual([403, ADMIN_ONLY]);

      expect(await storedItems()).toBe(before);
    },
  );
});

describe("GET /api/deductions/items/mine", () => {
  it("an employee gets only its own items, in the same shape", async () => {
    const own = await seedItem(angelica);
    await seedItem(carlo);

    const res = await mine(angelica);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: String(own._id),
      userId: angelica.id,
      employeeId: "AC-008",
      name: "Angelica Ramos",
      balance: LOAN_TOTAL,
      status: "Active",
    });
    expect(res.text).not.toContain(carlo.id);
  });

  it("an employee with no items gets an empty list", async () => {
    await seedItem(angelica);

    const res = await mine(carlo);

    expect([res.status, res.body]).toEqual([200, []]);
  });

  it("needs the Payroll page: an employee without it is refused", async () => {
    const noPayroll = await employee("noel", "Noel", "Sy", "AC-040", {
      pageAccess: ["dashboard", "attendance", "settings"],
    });
    await seedItem(noPayroll);

    const res = await mine(noPayroll);

    expect([res.status, res.body]).toEqual([403, DENIED]);
  });

  it("an admin account passes the page check but has no items of its own", async () => {
    await seedItem(rheaSelf);

    for (const who of [rhea, boss]) {
      const res = await mine(who);
      expect([res.status, res.body]).toEqual([200, []]);
    }
  });

  it("refuses a request with no token", async () => {
    expect((await mine(null)).status).toBe(401);
  });
});

describe("the activity log", () => {
  const RECORD = "Company Loan for Angelica Ramos (AC-008)";

  it("each write leaves one entry, named by type and employee, with no amount", async () => {
    const added = await add(rhea, loan(angelica, { label: "Car loan 1234" }));
    expect(added.status).toBe(201);
    const { id } = added.body.item;

    expect((await change(rhea, id, { amountPerCutoff: NEW_AMOUNT, note: "Raised" })).status).toBe(200);
    expect((await change(rhea, id, { status: "Paused" })).status).toBe(200);
    expect((await change(rhea, id, { status: "Active" })).status).toBe(200);
    expect((await stop(rhea, id)).status).toBe(200);
    expect((await remove(rhea, id)).status).toBe(200);

    const entries = await allEntries();
    expect(
      entries.map((entry) => [entry.action, entry.group, entry.targetName, entry.changed]),
    ).toEqual([
      ["payItem.add", "deductions", RECORD, []],
      ["payItem.edit", "deductions", RECORD, ["amount per cut-off", "note"]],
      ["payItem.pause", "deductions", RECORD, []],
      ["payItem.resume", "deductions", RECORD, []],
      ["payItem.stop", "deductions", RECORD, []],
      ["payItem.delete", "deductions", RECORD, []],
    ]);
    for (const entry of entries) {
      expect(String(entry.actorId)).toBe(rhea.id);
      expect(entry.actorName).toBe("Rhea Cruz");
      expect(String(entry.targetId)).toBe(id);
      expect(entry.note).toBe("");
      expect(JSON.stringify(entry)).not.toMatch(FIGURES);
      expect(JSON.stringify(entry)).not.toContain("Car loan");
    }
  });

  it("a refused write and a read leave no entry", async () => {
    const item = await seedItem(angelica);

    await add(rhea, loan(carlo));
    await add(rhea, loan(rheaSelf));
    await add(rhea, loan(angelica, { amountPerCutoff: 0 }));
    await change(rhea, item._id, { note: "" });
    await change(ned, item._id, { note: "x" });
    await readLog(rhea);
    await list(rhea);
    await mine(angelica);

    expect(await allEntries()).toEqual([]);
  });
});
