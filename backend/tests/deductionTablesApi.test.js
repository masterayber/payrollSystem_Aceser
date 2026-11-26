// The statutory deduction tables through the API (DED-3, routes/deductions.js):
// GET /api/deductions/tables for an admin with the Deductions tick, and the Super Admin's
// writes: a new version as a Draft, editing and deleting a Draft, confirming it, marking
// it as checked, and switching a kind off. The pure rules are in deductionTables.test.js;
// what each write leaves in the activity log is in activityLogApi.test.js.
//
// EVERY FIGURE IN THIS FILE IS MADE UP FOR THE TESTS. None is an official SSS,
// PhilHealth, Pag-IBIG or withholding tax rate or bracket.
jest.mock("../utils/nodemailer", () => jest.fn().mockResolvedValue());

const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const CompanySettings = require("../models/companySettings");
const ActivityLog = require("../models/activityLog");
const DeductionTable = require("../models/deductionTable");
const { pagesForRole } = require("../config/pages");
const { manilaToday } = require("../utils/leaveCredits");

const DENIED = {
  message: "You do not have access to this page",
  code: "PAGE_ACCESS_DENIED",
};
const ADMIN_ONLY = { message: "Admin access required" };
const NOT_FOUND = { message: "Table not found." };
const LOCKED = {
  message:
    "A confirmed table can't be changed. Add a new version with a later date.",
};
const BAD_KIND = "Choose SSS, PhilHealth, Pag-IBIG or Withholding tax.";
const BAD_DATE = "Enter the date the table takes effect as a valid date.";
const NO_SOURCE = "Name the official issuance this table was copied from.";
const NEGATIVE = "Amounts and rates can't be negative.";
const NO_CHECKER = "Enter who checked this table against the official one.";
const edges = (row) => `Row ${row} overlaps the row before it or leaves a gap.`;

const TABLES = "/api/deductions/tables";
const OFF = "/api/deductions/statutory-off";
const COMPANY = "/api/settings/company";

// The plan's test table (section 7), made up, flat for everyone: the employee's amount
// per kind, and a made-up employer amount to go with it. NOT official rates.
const FLAT = { sss: 400, philhealth: 300, pagibig: 100, tax: 200 };
const FLAT_EMPLOYER = { sss: 810, philhealth: 320, pagibig: 130, tax: 0 };
const LABELS = {
  sss: "SSS",
  philhealth: "PhilHealth",
  pagibig: "Pag-IBIG",
  tax: "Withholding tax",
};
const KINDS = Object.keys(LABELS);

// One flat row as the form sends it, and as it is stored and sent back
const flatRow = (kind) => ({
  over: 0,
  employeeFixed: FLAT[kind],
  employerFixed: FLAT_EMPLOYER[kind],
});
const storedFlatRow = (kind) => ({
  over: 0,
  upTo: null,
  employeeFixed: FLAT[kind],
  employeeRate: 0,
  employerFixed: FLAT_EMPLOYER[kind],
  employerRate: 0,
  excessOver: 0,
});

// Made-up bracket rows (NOT official): flat, then fixed + a rate on the excess, then open
const BRACKETS = [
  { over: 0, upTo: 1000, employeeFixed: 11, employeeRate: 0, employerFixed: 22, employerRate: 0, excessOver: 0 },
  { over: 1000, upTo: 2500, employeeFixed: 11, employeeRate: 7, employerFixed: 22, employerRate: 9, excessOver: 1000 },
  { over: 2500, upTo: null, employeeFixed: 123.45, employeeRate: 0, employerFixed: 234.56, employerRate: 0, excessOver: 0 },
];

// Far from today on purpose, so no test depends on the day it runs
const PAST = "2020-01-01";
const FUTURE = "2099-01-01";

const day = (key) => new Date(`${key}T00:00:00Z`);
const SOURCE = "Test issuance (made up)";

// A new table as the form sends it
const body = (kind = "sss", effectiveFrom = FUTURE, extra = {}) => ({
  kind,
  effectiveFrom,
  source: SOURCE,
  rows: [flatRow(kind)],
  ...extra,
});

let mongo;
let boss;
let rhea;
let ned;
let ana;

// A token as sign-in issues it (the tests here are not about signing in)
const tokenFor = (user) =>
  jwt.sign({ userId: String(user._id), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

// An Active account, signed in. insertMany skips the password hashing.
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

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  // The unique index on kind + date has to exist before the test that relies on it
  await DeductionTable.init();
});

beforeEach(async () => {
  // The Super Admin (no employee record: named by its username)
  boss = await account({ username: "admin", role: "Super Admin" });
  // An Admin with the Deductions tick, and one with every everyday tick but that one
  rhea = await account({
    username: "hr.rhea",
    role: "Admin",
    firstName: "Rhea",
    lastName: "Cruz",
    pageAccess: ["deductions"],
  });
  ned = await account({
    username: "hr.ned",
    role: "Admin",
    firstName: "Ned",
    lastName: "Lim",
    pageAccess: ["employees", "admin-payslips", "admin-filing", "reports"],
  });
  ana = await account({ username: "ana", role: "Employee" });
});

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all(
    [User, Employee, CompanySettings, ActivityLog, DeductionTable].map((Model) =>
      Model.deleteMany({}),
    ),
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
const read = (who) => call("get", TABLES, who);
const add = (who, sent) => call("post", TABLES, who, sent);
const edit = (who, id, sent) => call("put", `${TABLES}/${id}`, who, sent);
const remove = (who, id) => call("delete", `${TABLES}/${id}`, who);
const confirm = (who, id, sent) =>
  call("post", `${TABLES}/${id}/confirm`, who, sent);
const markChecked = (who, id) => call("post", `${TABLES}/${id}/checked`, who);
const switchOff = (who, sent) => call("put", OFF, who, sent);
const missingId = () => String(new mongoose.Types.ObjectId());
const quietLog = () => jest.spyOn(console, "error").mockImplementation(() => {});

// Saved straight to the model, as a table that is already there
const seedDraft = (kind, from, extra = {}) =>
  DeductionTable.create({
    kind,
    effectiveFrom: day(from),
    source: `Test issuance ${from} (made up)`,
    rows: [flatRow(kind)],
    createdBy: boss.user._id,
    ...extra,
  });
const seedConfirmed = (kind, from, extra = {}) =>
  seedDraft(kind, from, {
    status: "Confirmed",
    confirmedBy: boss.user._id,
    confirmedAt: new Date("2026-01-05T02:00:00Z"),
    checkedWith: "Maria Santos",
    lastCheckedOn: day(manilaToday()),
    lastCheckedBy: boss.user._id,
    ...extra,
  });

// Every stored table as text, to prove a refused request changed nothing
const storedTables = async () =>
  JSON.stringify(await DeductionTable.find().sort({ _id: 1 }).lean());
const storedOne = (id) => DeductionTable.findById(id).lean();
// The company record as MongoDB holds it, with no Mongoose schema in between
const rawCompany = () => CompanySettings.collection.findOne({ key: "company" });

const kindOf = (res, kind) => res.body.find((one) => one.kind === kind);
const datesOf = (list) => list.map((table) => table.effectiveFrom);

const NOTHING = {
  off: false,
  current: null,
  drafts: [],
  upcoming: [],
  history: [],
  lastCheckedOn: null,
  checkOverdue: false,
  blocksPayslips: true,
};

describe("GET /api/deductions/tables", () => {
  it("with no table at all: the four kinds in order, each with nothing and each blocking payslips", async () => {
    const res = await read(boss);

    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual([
      { kind: "sss", label: "SSS", ...NOTHING },
      { kind: "philhealth", label: "PhilHealth", ...NOTHING },
      { kind: "pagibig", label: "Pag-IBIG", ...NOTHING },
      { kind: "tax", label: "Withholding tax", ...NOTHING },
    ]);
  });

  it("a kind with a draft only: the whole draft is listed, nothing is in force", async () => {
    const draft = await seedDraft("philhealth", PAST);

    const res = await read(boss);

    expect(res.status).toBe(200);
    expect(kindOf(res, "philhealth")).toStrictEqual({
      kind: "philhealth",
      label: "PhilHealth",
      ...NOTHING,
      drafts: [
        {
          id: String(draft._id),
          kind: "philhealth",
          label: "PhilHealth",
          effectiveFrom: PAST,
          source: `Test issuance ${PAST} (made up)`,
          base: "monthlyBasic",
          deductOn: "both",
          rows: [storedFlatRow("philhealth")],
          status: "Draft",
          confirmedBy: "",
          confirmedAt: null,
          checkedWith: "",
          lastCheckedOn: null,
          lastCheckedBy: "",
          createdBy: "admin",
          createdAt: draft.createdAt.toISOString(),
        },
      ],
    });
    for (const kind of ["sss", "pagibig", "tax"]) {
      expect(kindOf(res, kind)).toStrictEqual({ kind, label: LABELS[kind], ...NOTHING });
    }
  });

  it("a current version, an upcoming one, history and a draft, each in its list", async () => {
    const today = manilaToday();
    // Saved out of order
    const upcoming = await seedConfirmed("sss", FUTURE);
    const oldest = await seedConfirmed("sss", PAST);
    const draft = await seedDraft("sss", "2098-01-01");
    const current = await seedConfirmed("sss", "2024-01-01", {
      base: "cutoffGross",
      deductOn: "2nd",
      rows: BRACKETS,
    });
    const older = await seedConfirmed("sss", "2022-01-01");

    const res = await read(boss);

    expect(res.status).toBe(200);
    const sss = kindOf(res, "sss");
    expect(Object.keys(sss)).toEqual([
      "kind",
      "label",
      "off",
      "current",
      "drafts",
      "upcoming",
      "history",
      "lastCheckedOn",
      "checkOverdue",
      "blocksPayslips",
    ]);
    expect(sss.current).toStrictEqual({
      id: String(current._id),
      kind: "sss",
      label: "SSS",
      effectiveFrom: "2024-01-01",
      source: "Test issuance 2024-01-01 (made up)",
      base: "cutoffGross",
      deductOn: "2nd",
      rows: BRACKETS,
      status: "Confirmed",
      confirmedBy: "admin",
      confirmedAt: "2026-01-05T02:00:00.000Z",
      checkedWith: "Maria Santos",
      lastCheckedOn: today,
      lastCheckedBy: "admin",
      createdBy: "admin",
      createdAt: current.createdAt.toISOString(),
    });
    expect(sss.drafts.map((table) => table.id)).toEqual([String(draft._id)]);
    expect(sss.upcoming.map((table) => table.id)).toEqual([String(upcoming._id)]);
    // Latest first
    expect(sss.history.map((table) => table.id)).toEqual([
      String(older._id),
      String(oldest._id),
    ]);
    expect(sss).toMatchObject({
      off: false,
      lastCheckedOn: today,
      checkOverdue: false,
      blocksPayslips: false,
    });
    // The other kinds have nothing
    for (const kind of ["philhealth", "pagibig", "tax"]) {
      expect(kindOf(res, kind)).toStrictEqual({ kind, label: LABELS[kind], ...NOTHING });
    }
  });

  it("a version that starts today (Manila) is the current one", async () => {
    await seedConfirmed("tax", manilaToday());

    const tax = kindOf(await read(boss), "tax");

    expect(tax.current.effectiveFrom).toBe(manilaToday());
    expect(tax.upcoming).toEqual([]);
    expect(tax.blocksPayslips).toBe(false);
  });

  it("only an upcoming version: payslips stay blocked until it starts", async () => {
    await seedConfirmed("pagibig", FUTURE);

    const pagibig = kindOf(await read(boss), "pagibig");

    expect(pagibig.current).toBeNull();
    expect(datesOf(pagibig.upcoming)).toEqual([FUTURE]);
    expect(pagibig.blocksPayslips).toBe(true);
  });

  it("a current version whose last check is over 6 months old is flagged", async () => {
    await seedConfirmed("sss", PAST, { lastCheckedOn: day("2020-06-01") });

    const sss = kindOf(await read(boss), "sss");

    expect(sss.lastCheckedOn).toBe("2020-06-01");
    expect(sss.checkOverdue).toBe(true);
    expect(sss.blocksPayslips).toBe(false);
  });

  it("names people by their employee record, then their account; never by account id", async () => {
    await Employee.create({
      userId: boss.user._id,
      firstName: "Ayber",
      lastName: "Santos",
      employeeId: "ADM-001",
      email: boss.user.email,
      role: "Super Admin",
    });
    const gone = new mongoose.Types.ObjectId();
    await seedConfirmed("sss", PAST, { createdBy: gone });

    const res = await read(rhea);

    expect(kindOf(res, "sss").current).toMatchObject({
      confirmedBy: "Ayber Santos",
      lastCheckedBy: "Ayber Santos",
      // An account that no longer exists
      createdBy: "Unknown",
    });
    expect(res.text).not.toContain(boss.id);
    expect(res.text).not.toContain(String(gone));
    expect(res.text).not.toContain("ADM-001");
  });

  describe("who may read", () => {
    beforeEach(async () => {
      await seedConfirmed("sss", PAST);
      await seedDraft("tax", FUTURE);
    });

    it("answers the Super Admin and an Admin with the Deductions tick the same", async () => {
      const bySuperAdmin = await read(boss);
      const byAdmin = await read(rhea);

      expect([bySuperAdmin.status, byAdmin.status]).toEqual([200, 200]);
      expect(byAdmin.body).toStrictEqual(bySuperAdmin.body);
      expect(kindOf(byAdmin, "sss").current.rows).toEqual([storedFlatRow("sss")]);
    });

    it("refuses an Admin without the Deductions tick: 403, no table", async () => {
      const res = await read(ned);

      expect(res.status).toBe(403);
      expect(res.body).toEqual(DENIED);
    });

    it("refuses an Employee, whatever pages it has", async () => {
      const ticked = await account({
        username: "eli",
        role: "Employee",
        pageAccess: ["payroll", "payslips", "deductions"],
      });
      for (const who of [ana, ticked]) {
        const res = await read(who);
        expect(res.status).toBe(403);
        expect(res.body).toEqual(ADMIN_ONLY);
      }
    });

    it("refuses a request without a sign-in token", async () => {
      const res = await read(null);

      expect(res.status).toBe(401);
      expect(Array.isArray(res.body)).toBe(false);
    });
  });

  it("answers 500 with a message when the tables can't be read", async () => {
    quietLog();
    jest.spyOn(DeductionTable, "find").mockImplementationOnce(() => {
      throw new Error("database down");
    });

    const res = await read(boss);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Error reading the deduction tables" });
  });
});

describe("POST /api/deductions/tables", () => {
  it("saves a new version as a draft and answers it", async () => {
    const res = await add(boss, body("sss", FUTURE));

    expect(res.status).toBe(201);
    expect(res.body).toStrictEqual({
      message: "Table saved as a draft.",
      table: {
        id: expect.any(String),
        kind: "sss",
        label: "SSS",
        effectiveFrom: FUTURE,
        source: SOURCE,
        base: "monthlyBasic",
        deductOn: "both",
        rows: [storedFlatRow("sss")],
        status: "Draft",
        confirmedBy: "",
        confirmedAt: null,
        checkedWith: "",
        lastCheckedOn: null,
        lastCheckedBy: "",
        createdBy: "admin",
        createdAt: expect.any(String),
      },
    });

    const stored = await storedOne(res.body.table.id);
    expect(stored).toMatchObject({
      kind: "sss",
      source: SOURCE,
      base: "monthlyBasic",
      deductOn: "both",
      rows: [storedFlatRow("sss")],
      status: "Draft",
      confirmedBy: null,
      confirmedAt: null,
      checkedWith: "",
      lastCheckedOn: null,
      lastCheckedBy: null,
    });
    // The Manila day, stored at 00:00 UTC
    expect(stored.effectiveFrom.toISOString()).toBe(`${FUTURE}T00:00:00.000Z`);
    expect(String(stored.createdBy)).toBe(boss.id);
  });

  it("a draft is not in force: the kind still blocks payslips", async () => {
    expect((await add(boss, body("sss", PAST))).status).toBe(201);

    const sss = kindOf(await read(boss), "sss");

    expect(sss.current).toBeNull();
    expect(datesOf(sss.drafts)).toEqual([PAST]);
    expect(sss.blocksPayslips).toBe(true);
  });

  it("saves brackets as typed in the form's boxes, with what it is read against and when it is taken", async () => {
    const res = await add(
      boss,
      body("tax", FUTURE, {
        source: `  ${SOURCE}  `,
        base: "cutoffGross",
        deductOn: "1st",
        rows: [
          { over: "0", upTo: "1000", employeeFixed: "11", employerFixed: "22" },
          { over: 1000, upTo: " 2500 ", employeeFixed: 11, employeeRate: "7", employerFixed: 22, employerRate: "9", excessOver: "1000" },
          { over: "2500", upTo: "", employeeFixed: "123.45", employerFixed: "234.56" },
        ],
      }),
    );

    expect(res.status).toBe(201);
    expect(res.body.table).toMatchObject({
      kind: "tax",
      label: "Withholding tax",
      source: SOURCE,
      base: "cutoffGross",
      deductOn: "1st",
      rows: BRACKETS,
    });
    expect((await storedOne(res.body.table.id)).rows).toEqual(BRACKETS);
  });

  it("takes only the form's fields: a body can't confirm its own table", async () => {
    const res = await add(
      boss,
      body("sss", PAST, {
        status: "Confirmed",
        confirmedBy: rhea.id,
        confirmedAt: "2026-01-01",
        checkedWith: "Nobody",
        lastCheckedOn: "2026-01-01",
        createdBy: rhea.id,
      }),
    );

    expect(res.status).toBe(201);
    const stored = await storedOne(res.body.table.id);
    expect(stored).toMatchObject({
      status: "Draft",
      confirmedBy: null,
      confirmedAt: null,
      checkedWith: "",
      lastCheckedOn: null,
    });
    expect(String(stored.createdBy)).toBe(boss.id);
  });

  it.each([
    ["no kind", { kind: undefined }, BAD_KIND],
    ["a kind that is not one of the four", { kind: "loan" }, BAD_KIND],
    ["a label instead of a kind", { kind: "SSS" }, BAD_KIND],
    ["no date", { effectiveFrom: undefined }, BAD_DATE],
    ["a date in another order", { effectiveFrom: "01-01-2099" }, BAD_DATE],
    ["a day that doesn't exist", { effectiveFrom: "2099-02-30" }, BAD_DATE],
    ["a date with a time", { effectiveFrom: "2099-01-01T00:00:00Z" }, BAD_DATE],
    ["no source", { source: undefined }, NO_SOURCE],
    ["a source of spaces", { source: "   " }, NO_SOURCE],
    [
      "something else to read it against",
      { base: "annualBasic" },
      "Choose what the table is read against: the monthly basic pay or the cut-off's gross pay.",
    ],
    [
      "another cut-off to take it on",
      { deductOn: "3rd" },
      "Choose when it is taken: half on each cut-off, the 1st cut-off or the 2nd cut-off.",
    ],
    ["no rows", { rows: [] }, "Add at least one row."],
    ["rows that are not a list", { rows: "rows" }, "Add at least one row."],
    [
      "a row that overlaps the row before it",
      { rows: [{ over: 0, upTo: 1000 }, { over: 900 }] },
      edges(2),
    ],
    [
      "a row that leaves a gap",
      { rows: [{ over: 0, upTo: 1000 }, { over: 1000, upTo: 2000 }, { over: 2000.01 }] },
      edges(3),
    ],
    [
      "a row after an open row",
      { rows: [{ over: 0 }, { over: 1000 }] },
      edges(2),
    ],
    [
      "a first row that doesn't start at 0",
      { rows: [{ over: 500 }] },
      "Row 1 must start at 0, so every amount has a row.",
    ],
    [
      "a last row with an upper limit",
      { rows: [{ over: 0, upTo: 1000 }] },
      'Leave "up to" empty on the last row, so it covers every higher amount.',
    ],
    [
      "a row that ends where it starts",
      { rows: [{ over: 0, upTo: 0 }, { over: 0 }] },
      'Row 1: "up to" must be more than "over".',
    ],
    ["a negative amount", { rows: [{ over: 0, employeeFixed: -400 }] }, NEGATIVE],
    ["a negative rate", { rows: [{ over: 0, employerRate: "-1.5" }] }, NEGATIVE],
    ["a negative start", { rows: [{ over: -1 }] }, NEGATIVE],
    [
      "a rate over 100",
      { rows: [{ over: 0, employeeRate: 150 }] },
      "Row 1: a rate is a percent and can't be more than 100.",
    ],
    [
      "an excess that starts above the row",
      { rows: [{ over: 0, upTo: 1000 }, { over: 1000, employeeRate: 6, excessOver: 2000 }] },
      'Row 2: the excess can\'t start above the row\'s "over" amount.',
    ],
    [
      "an amount that is not a number",
      { rows: [{ over: 0, employeeFixed: "1,000" }] },
      "Row 1: enter every figure as a number.",
    ],
  ])("refuses %s with 400 and saves nothing", async (label, change, message) => {
    const res = await add(boss, body("sss", FUTURE, change));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message });
    expect(await DeductionTable.countDocuments()).toBe(0);
  });

  it("refuses an empty body", async () => {
    const res = await add(boss, undefined);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: BAD_KIND });
  });

  describe("one version per kind per day", () => {
    it.each([
      ["sss", "An SSS table already starts on 2099-01-01."],
      ["philhealth", "A PhilHealth table already starts on 2099-01-01."],
      ["pagibig", "A Pag-IBIG table already starts on 2099-01-01."],
      ["tax", "A Withholding tax table already starts on 2099-01-01."],
    ])("refuses a second %s table on the same date with 409", async (kind, message) => {
      expect((await add(boss, body(kind, FUTURE))).status).toBe(201);

      const res = await add(boss, body(kind, FUTURE, { source: "Another issuance" }));

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ message });
      expect(await DeductionTable.countDocuments()).toBe(1);
    });

    it("also when the table on that date is confirmed", async () => {
      await seedConfirmed("sss", PAST);

      const res = await add(boss, body("sss", PAST));

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        message: `An SSS table already starts on ${PAST}.`,
      });
    });

    it("accepts another kind on the same date, and the same kind on another date", async () => {
      expect((await add(boss, body("sss", FUTURE))).status).toBe(201);
      expect((await add(boss, body("tax", FUTURE))).status).toBe(201);
      expect((await add(boss, body("sss", "2099-01-02"))).status).toBe(201);
      expect(await DeductionTable.countDocuments()).toBe(3);
    });

    it("two requests at the same moment: the unique index refuses the second with the same 409", async () => {
      await seedDraft("sss", FUTURE);
      // The look-up misses it, as it would for a request that arrived at the same moment
      jest.spyOn(DeductionTable, "exists").mockResolvedValueOnce(null);

      const res = await add(boss, body("sss", FUTURE));

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        message: "An SSS table already starts on 2099-01-01.",
      });
      expect(await DeductionTable.countDocuments()).toBe(1);
    });
  });

  it("answers 500 with a message, and no table, when the save fails", async () => {
    quietLog();
    jest.spyOn(DeductionTable, "create").mockRejectedValueOnce(new Error("disk full"));

    const res = await add(boss, body());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Error saving the table" });
    expect(await DeductionTable.countDocuments()).toBe(0);
  });
});

describe("PUT /api/deductions/tables/:id", () => {
  it("replaces a draft with what the form sends", async () => {
    const draft = await seedDraft("sss", FUTURE);

    const res = await edit(
      boss,
      draft._id,
      body("sss", "2099-06-01", {
        source: "Test issuance B (made up)",
        base: "cutoffGross",
        deductOn: "2nd",
        rows: BRACKETS,
      }),
    );

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Draft updated.");
    expect(res.body.table).toMatchObject({
      id: String(draft._id),
      kind: "sss",
      effectiveFrom: "2099-06-01",
      source: "Test issuance B (made up)",
      base: "cutoffGross",
      deductOn: "2nd",
      rows: BRACKETS,
      status: "Draft",
      createdBy: "admin",
    });
    const stored = await storedOne(draft._id);
    expect(stored.effectiveFrom.toISOString()).toBe("2099-06-01T00:00:00.000Z");
    expect(stored.rows).toEqual(BRACKETS);
    expect(stored.status).toBe("Draft");
    expect(await DeductionTable.countDocuments()).toBe(1);
  });

  it("a draft typed under the wrong kind can be moved to the right one", async () => {
    const draft = await seedDraft("sss", FUTURE);

    const res = await edit(boss, draft._id, body("pagibig", FUTURE));

    expect(res.status).toBe(200);
    expect(res.body.table).toMatchObject({ kind: "pagibig", label: "Pag-IBIG" });
  });

  it("may keep its own date, but can't take the date of another table of its kind", async () => {
    const draft = await seedDraft("sss", FUTURE);
    await seedConfirmed("sss", PAST);
    await seedDraft("tax", "2099-03-01");

    const same = await edit(boss, draft._id, body("sss", FUTURE, { source: "Renamed" }));
    expect(same.status).toBe(200);

    const before = await storedTables();
    const taken = await edit(boss, draft._id, body("sss", PAST));
    expect(taken.status).toBe(409);
    expect(taken.body).toEqual({
      message: `An SSS table already starts on ${PAST}.`,
    });
    const takenKind = await edit(boss, draft._id, body("tax", "2099-03-01"));
    expect(takenKind.status).toBe(409);
    expect(takenKind.body).toEqual({
      message: "A Withholding tax table already starts on 2099-03-01.",
    });
    expect(await storedTables()).toBe(before);
  });

  it("keeps its status and who made it, whatever the body carries", async () => {
    const draft = await seedDraft("sss", FUTURE);

    const res = await edit(
      boss,
      draft._id,
      body("sss", FUTURE, { status: "Confirmed", checkedWith: "Nobody", createdBy: rhea.id }),
    );

    expect(res.status).toBe(200);
    const stored = await storedOne(draft._id);
    expect(stored).toMatchObject({ status: "Draft", checkedWith: "", confirmedBy: null });
    expect(String(stored.createdBy)).toBe(boss.id);
  });

  it("refuses a confirmed table with 409, whatever the body, and changes nothing", async () => {
    const confirmed = await seedConfirmed("sss", PAST);
    const before = await storedTables();

    for (const sent of [
      body("sss", PAST, { source: "Changed" }),
      body("sss", "2099-06-01", { rows: BRACKETS }),
      // Even a body that would be refused on its own
      { kind: "loan" },
      undefined,
    ]) {
      const res = await edit(boss, confirmed._id, sent);
      expect(res.status).toBe(409);
      expect(res.body).toEqual(LOCKED);
    }
    expect(await storedTables()).toBe(before);
  });

  it("refuses an upcoming confirmed table too: confirmed means locked, not only in force", async () => {
    const upcoming = await seedConfirmed("sss", FUTURE);

    const res = await edit(boss, upcoming._id, body("sss", FUTURE, { source: "Changed" }));

    expect(res.status).toBe(409);
    expect(res.body).toEqual(LOCKED);
  });

  it("answers 404 for a table that isn't there, or an id that isn't one", async () => {
    for (const id of [missingId(), "not-an-id", "confirm"]) {
      const res = await edit(boss, id, body());
      expect(res.status).toBe(404);
      expect(res.body).toEqual(NOT_FOUND);
    }
    expect(await DeductionTable.countDocuments()).toBe(0);
  });

  it.each([
    ["a bad kind", { kind: "loan" }, BAD_KIND],
    ["a bad date", { effectiveFrom: "2099-02-30" }, BAD_DATE],
    ["no source", { source: "" }, NO_SOURCE],
    ["a gap", { rows: [{ over: 0, upTo: 1000 }, { over: 1500 }] }, edges(2)],
    ["a negative", { rows: [{ over: 0, employerFixed: -1 }] }, NEGATIVE],
  ])("refuses %s with 400 and leaves the draft as it was", async (label, change, message) => {
    const draft = await seedDraft("sss", FUTURE);
    const before = await storedTables();

    const res = await edit(boss, draft._id, body("sss", FUTURE, change));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message });
    expect(await storedTables()).toBe(before);
  });
});

describe("DELETE /api/deductions/tables/:id", () => {
  it("deletes a draft", async () => {
    const draft = await seedDraft("sss", FUTURE);
    const kept = await seedDraft("tax", FUTURE);

    const res = await remove(boss, draft._id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Draft deleted." });
    expect((await DeductionTable.find().lean()).map((table) => String(table._id))).toEqual([
      String(kept._id),
    ]);
  });

  it("refuses a confirmed table with 409: it stays, in force or upcoming", async () => {
    const current = await seedConfirmed("sss", PAST);
    const upcoming = await seedConfirmed("sss", FUTURE);
    const before = await storedTables();

    for (const table of [current, upcoming]) {
      const res = await remove(boss, table._id);
      expect(res.status).toBe(409);
      expect(res.body).toEqual(LOCKED);
    }
    expect(await storedTables()).toBe(before);
  });

  it("answers 404 for a table that isn't there, or an id that isn't one", async () => {
    await seedDraft("sss", FUTURE);
    for (const id of [missingId(), "not-an-id"]) {
      const res = await remove(boss, id);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(NOT_FOUND);
    }
    expect(await DeductionTable.countDocuments()).toBe(1);
  });
});

describe("POST /api/deductions/tables/:id/confirm", () => {
  it("confirms a draft: who confirmed it, who checked it, and today as its first check", async () => {
    const draft = await seedDraft("sss", PAST);
    const before = Date.now();

    const res = await confirm(boss, draft._id, { checkedWith: "  Maria Santos (Accounting) " });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Table confirmed.");
    expect(res.body.table).toMatchObject({
      id: String(draft._id),
      status: "Confirmed",
      confirmedBy: "admin",
      confirmedAt: expect.any(String),
      checkedWith: "Maria Santos (Accounting)",
      lastCheckedOn: manilaToday(),
      lastCheckedBy: "admin",
      rows: [storedFlatRow("sss")],
    });

    const stored = await storedOne(draft._id);
    expect(stored.status).toBe("Confirmed");
    expect(String(stored.confirmedBy)).toBe(boss.id);
    expect(String(stored.lastCheckedBy)).toBe(boss.id);
    expect(stored.confirmedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(stored.confirmedAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect(stored.lastCheckedOn.toISOString()).toBe(`${manilaToday()}T00:00:00.000Z`);
  });

  it("from then on it is in force, and can't be edited or deleted", async () => {
    const draft = await seedDraft("sss", PAST);
    expect(kindOf(await read(boss), "sss").blocksPayslips).toBe(true);

    expect((await confirm(boss, draft._id, { checkedWith: "Maria Santos" })).status).toBe(200);

    const sss = kindOf(await read(boss), "sss");
    expect(sss.current.id).toBe(String(draft._id));
    expect(sss.drafts).toEqual([]);
    expect(sss).toMatchObject({
      blocksPayslips: false,
      lastCheckedOn: manilaToday(),
      checkOverdue: false,
    });

    const edited = await edit(boss, draft._id, body("sss", PAST, { source: "Changed" }));
    expect([edited.status, edited.body]).toEqual([409, LOCKED]);
    const removed = await remove(boss, draft._id);
    expect([removed.status, removed.body]).toEqual([409, LOCKED]);
    expect(await DeductionTable.countDocuments()).toBe(1);
  });

  it("a draft with a later date becomes an upcoming version, not the current one", async () => {
    await seedConfirmed("sss", PAST);
    const next = await seedDraft("sss", FUTURE);

    expect((await confirm(boss, next._id, { checkedWith: "Maria Santos" })).status).toBe(200);

    const sss = kindOf(await read(boss), "sss");
    expect(sss.current.effectiveFrom).toBe(PAST);
    expect(datesOf(sss.upcoming)).toEqual([FUTURE]);
  });

  it.each([
    ["no body", undefined],
    ["no name", {}],
    ["an empty name", { checkedWith: "" }],
    ["a name of spaces", { checkedWith: "   " }],
    ["a name that is not text", { checkedWith: ["Maria"] }],
  ])("refuses %s with 400: the draft stays a draft", async (label, sent) => {
    const draft = await seedDraft("sss", PAST);
    const before = await storedTables();

    const res = await confirm(boss, draft._id, sent);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: NO_CHECKER });
    expect(await storedTables()).toBe(before);
  });

  it("refuses a table that is already confirmed with 409, and keeps who checked it", async () => {
    const confirmed = await seedConfirmed("sss", PAST);
    const before = await storedTables();

    for (const sent of [{ checkedWith: "Someone Else" }, {}]) {
      const res = await confirm(boss, confirmed._id, sent);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ message: "This table is already confirmed." });
    }
    expect(await storedTables()).toBe(before);
  });

  it("answers 404 for a table that isn't there, or an id that isn't one", async () => {
    for (const id of [missingId(), "not-an-id"]) {
      const res = await confirm(boss, id, { checkedWith: "Maria Santos" });
      expect(res.status).toBe(404);
      expect(res.body).toEqual(NOT_FOUND);
    }
  });
});

describe("POST /api/deductions/tables/:id/checked", () => {
  it("stamps today as the last check, and who made it, and changes nothing else", async () => {
    const other = await account({ username: "old.admin", role: "Super Admin" });
    const confirmed = await seedConfirmed("sss", PAST, {
      lastCheckedOn: day("2020-06-01"),
      lastCheckedBy: other.user._id,
    });
    expect(kindOf(await read(boss), "sss")).toMatchObject({
      lastCheckedOn: "2020-06-01",
      checkOverdue: true,
    });
    // Everything on the record but the check itself (and the record's own "updated" time)
    const rest = (table) =>
      Object.fromEntries(
        Object.entries(table).filter(
          ([key]) => !["lastCheckedOn", "lastCheckedBy", "updatedAt"].includes(key),
        ),
      );
    const before = rest(await storedOne(confirmed._id));

    const res = await markChecked(boss, confirmed._id);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Marked as checked today.");
    expect(res.body.table).toMatchObject({
      id: String(confirmed._id),
      status: "Confirmed",
      lastCheckedOn: manilaToday(),
      lastCheckedBy: "admin",
      checkedWith: "Maria Santos",
    });

    const stored = await storedOne(confirmed._id);
    expect(stored.lastCheckedOn.toISOString()).toBe(`${manilaToday()}T00:00:00.000Z`);
    expect(String(stored.lastCheckedBy)).toBe(boss.id);
    expect(rest(stored)).toEqual(before);

    expect(kindOf(await read(boss), "sss")).toMatchObject({
      lastCheckedOn: manilaToday(),
      checkOverdue: false,
    });
  });

  it("refuses a draft with 409", async () => {
    const draft = await seedDraft("sss", PAST);
    const before = await storedTables();

    const res = await markChecked(boss, draft._id);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      message: "Only a confirmed table can be marked as checked.",
    });
    expect(await storedTables()).toBe(before);
  });

  it("answers 404 for a table that isn't there, or an id that isn't one", async () => {
    for (const id of [missingId(), "not-an-id"]) {
      const res = await markChecked(boss, id);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(NOT_FOUND);
    }
  });
});

describe("PUT /api/deductions/statutory-off", () => {
  it("saves the kinds that are switched off and answers the saved list, each once, in the screen's order", async () => {
    const res = await switchOff(boss, { kinds: ["tax", "sss", "tax"] });

    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({
      message: "Switched-off deductions saved.",
      kinds: ["sss", "tax"],
    });
    expect((await rawCompany()).statutoryOff).toEqual(["sss", "tax"]);
  });

  it("a kind that is off no longer blocks payslips; switching it back on does", async () => {
    await switchOff(boss, { kinds: ["sss", "pagibig"] });

    const off = await read(rhea);
    expect(off.body.map((kind) => [kind.kind, kind.off, kind.blocksPayslips])).toEqual([
      ["sss", true, false],
      ["philhealth", false, true],
      ["pagibig", true, false],
      ["tax", false, true],
    ]);

    const res = await switchOff(boss, { kinds: [] });
    expect(res.status).toBe(200);
    expect(res.body.kinds).toEqual([]);
    const on = await read(rhea);
    expect(on.body.map((kind) => [kind.off, kind.blocksPayslips])).toEqual(
      KINDS.map(() => [false, true]),
    );
  });

  it("replaces the list each time", async () => {
    await switchOff(boss, { kinds: ["sss"] });
    const res = await switchOff(boss, { kinds: ["philhealth"] });

    expect(res.body.kinds).toEqual(["philhealth"]);
    expect((await rawCompany()).statutoryOff).toEqual(["philhealth"]);
  });

  it("keeps a switched-off kind's tables", async () => {
    await seedConfirmed("tax", PAST);
    await switchOff(boss, { kinds: ["tax"] });

    const tax = kindOf(await read(boss), "tax");

    expect(tax).toMatchObject({ off: true, blocksPayslips: false, checkOverdue: false });
    expect(tax.current.effectiveFrom).toBe(PAST);
    expect(await DeductionTable.countDocuments()).toBe(1);
  });

  it.each([
    ["no list", {}],
    ["no body", undefined],
    ["one kind as text", { kinds: "tax" }],
    ["a kind that is not one of the four", { kinds: ["tax", "loan"] }],
    ["a label", { kinds: ["SSS"] }],
    ["an object", { kinds: { tax: true } }],
  ])("refuses %s with 400 and keeps the saved list", async (label, sent) => {
    await switchOff(boss, { kinds: ["pagibig"] });

    const res = await switchOff(boss, sent);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: BAD_KIND });
    expect((await rawCompany()).statutoryOff).toEqual(["pagibig"]);
  });

  it("is saved on the one company record, next to its other details", async () => {
    const named = await call("put", COMPANY, boss, { name: "ACESER Corporation" });
    expect(named.status).toBe(200);

    expect((await switchOff(boss, { kinds: ["tax"] })).status).toBe(200);

    expect(await CompanySettings.countDocuments()).toBe(1);
    expect(await rawCompany()).toMatchObject({
      key: "company",
      name: "ACESER Corporation",
      statutoryOff: ["tax"],
    });
  });

  it("makes the company record when there is none yet, with nothing switched off before it", async () => {
    expect(await rawCompany()).toBeNull();
    expect((await read(boss)).body.map((kind) => kind.off)).toEqual([false, false, false, false]);

    expect((await switchOff(boss, { kinds: ["sss"] })).status).toBe(200);

    expect(await CompanySettings.countDocuments()).toBe(1);
    expect(await rawCompany()).toMatchObject({
      key: "company",
      dateFormat: "MM-DD-YYYY",
      timeFormat: "12 Hour",
      statutoryOff: ["sss"],
    });
  });

  describe("Settings > Company neither sends nor accepts the list", () => {
    it("GET /api/settings/company never carries it, for anyone", async () => {
      await switchOff(boss, { kinds: ["sss", "tax"] });

      for (const who of [ana, rhea, boss]) {
        const res = await call("get", COMPANY, who);
        expect(res.status).toBe(200);
        expect(res.body).not.toHaveProperty("statutoryOff");
      }
    });

    it("a company record made by Settings > Company has nothing switched off", async () => {
      expect((await call("get", COMPANY, ana)).status).toBe(200);

      expect((await read(boss)).body.map((kind) => kind.off)).toEqual([false, false, false, false]);
    });

    it("saving the company details, or its logo, leaves the list as it was", async () => {
      await switchOff(boss, { kinds: ["sss", "tax"] });

      const saved = await call("put", COMPANY, boss, {
        name: "ACESER",
        statutoryOff: [],
      });
      expect(saved.status).toBe(200);
      expect(saved.body.name).toBe("ACESER");
      expect(saved.body).not.toHaveProperty("statutoryOff");
      expect((await rawCompany()).statutoryOff).toEqual(["sss", "tax"]);

      // The logo routes load the record and save it whole
      const logo = await call("delete", `${COMPANY}/logo`, boss);
      expect(logo.status).toBe(200);
      expect(logo.body).not.toHaveProperty("statutoryOff");
      expect((await rawCompany()).statutoryOff).toEqual(["sss", "tax"]);
      expect((await rawCompany()).name).toBe("ACESER");
    });
  });
});

describe("only the Super Admin writes", () => {
  // Each write, against a table it would otherwise succeed on
  const WRITES = [
    ["POST /tables", () => add, async () => [body("tax", FUTURE)]],
    [
      "PUT /tables/:id",
      () => edit,
      async () => [String((await seedDraft("sss", FUTURE))._id), body("sss", FUTURE, { source: "Changed" })],
    ],
    ["DELETE /tables/:id", () => remove, async () => [String((await seedDraft("sss", FUTURE))._id)]],
    [
      "POST /tables/:id/confirm",
      () => confirm,
      async () => [String((await seedDraft("sss", PAST))._id), { checkedWith: "Maria Santos" }],
    ],
    [
      "POST /tables/:id/checked",
      () => markChecked,
      async () => [
        String((await seedConfirmed("sss", PAST, { lastCheckedOn: day("2020-06-01") }))._id),
      ],
    ],
    ["PUT /statutory-off", () => switchOff, async () => [{ kinds: ["sss"] }]],
  ];

  it.each(WRITES)(
    "%s is refused for an Admin with the Deductions tick, an Admin with every tick and an Employee; nothing changes",
    async (label, pick, prepare) => {
      const send = pick();
      const args = await prepare();
      const everyTick = await account({
        username: "hr.all",
        role: "Admin",
        pageAccess: pagesForRole("Admin").map((page) => page.key),
      });
      const before = await storedTables();

      for (const who of [rhea, everyTick, ana]) {
        const res = await send(who, ...args);
        // The same refusal as every other Super-Admin-only route
        expect([who.user.username, res.status]).toEqual([who.user.username, 403]);
        expect(res.body).toEqual(DENIED);
      }
      const noToken = await send(null, ...args);
      expect(noToken.status).toBe(401);

      expect(await storedTables()).toBe(before);
      expect(await rawCompany()).toBeNull();
      expect(await ActivityLog.countDocuments()).toBe(0);
    },
  );

  it.each(WRITES)("%s works for the Super Admin", async (label, pick, prepare) => {
    const res = await pick()(boss, ...(await prepare()));

    expect([200, 201]).toContain(res.status);
    expect(await ActivityLog.countDocuments()).toBe(1);
  });
});

describe("where the tables are kept", () => {
  it("in their own collection; the old 'deductions' collection and model are never used", async () => {
    expect((await add(boss, body("sss", PAST))).status).toBe(201);
    expect((await switchOff(boss, { kinds: ["tax"] })).status).toBe(200);
    expect((await read(boss)).status).toBe(200);

    const names = (await mongoose.connection.db.listCollections().toArray()).map(
      (collection) => collection.name,
    );
    expect(names).toContain("deductionTables");
    expect(names).not.toContain("deductions");
    expect(mongoose.modelNames()).toContain("DeductionTable");
    expect(mongoose.modelNames()).not.toContain("Deductions");
    expect(DeductionTable.collection.name).toBe("deductionTables");
  });

  it("no pay item, payroll or payslip route exists yet (DED-4 onward)", async () => {
    for (const url of [
      "/api/deductions",
      "/api/deductions/items",
      "/api/payroll/preview",
      "/api/payroll/payslips",
    ]) {
      const res = await call("get", url, boss);
      expect([url, res.status]).toEqual([url, 404]);
    }
  });
});
