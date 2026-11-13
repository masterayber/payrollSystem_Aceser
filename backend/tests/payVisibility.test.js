jest.mock("../utils/nodemailer", () => jest.fn().mockResolvedValue());

// "Today" is the day of the worked examples in the roles plan, section 3.4: Friday
// 2026-11-06. Only manilaToday() is replaced; the rest of the module stays real.
jest.mock("../utils/leaveCredits", () => ({
  ...jest.requireActual("../utils/leaveCredits"),
  manilaToday: jest.fn(() => "2026-11-06"),
}));

// The pay list (roles plan, rules 18 to 23, with Ayber's PR C review of 2026-11-10):
// the helper in utils/payVisibility.js and every reply that carries pay; the
// "thirteenth-month" tick; basic pay required on Add Employee; a self sign-up's
// starting basic pay of 0; the "Pay not set" flag.
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const CompanySettings = require("../models/companySettings");
const BasicPayChange = require("../models/basicPayChange");
const { toDateKey } = require("../utils/leaveCredits");
const {
  PAY_NOT_SHARED,
  EMPLOYEE_NOT_FOUND,
  THIRTEENTH_MONTH_KEY,
  payScope,
  canSeePay,
  canSeeThirteenthMonth,
  withPayFlag,
  redactJob,
  jobFor,
  settingsFor,
  ownSettings,
  visibleThirteenthRows,
  sendsBasicPay,
} = require("../utils/payVisibility");

const id = () => new mongoose.Types.ObjectId();

// ---- The helper ----

describe("payScope and canSeePay", () => {
  const [a, b, c] = [id(), id(), id()];

  it("lets the Super Admin see all pay, whatever its stored list", () => {
    const scope = payScope({ _id: id(), role: "Super Admin", payAccess: [a] });
    expect(scope.all).toBe(true);
    expect(canSeePay(scope, a)).toBe(true);
    expect(canSeePay(scope, c)).toBe(true);
  });

  it("lets an Admin see only the ids on its list, ObjectIds and strings alike", () => {
    const scope = payScope({ _id: id(), role: "Admin", payAccess: [a, String(b)] });
    expect(scope.all).toBe(false);
    expect(canSeePay(scope, a)).toBe(true);
    expect(canSeePay(scope, String(a))).toBe(true);
    expect(canSeePay(scope, b)).toBe(true);
    expect(canSeePay(scope, c)).toBe(false);
  });

  it("gives an Admin with an empty or missing list no pay at all", () => {
    for (const admin of [
      { _id: id(), role: "Admin", payAccess: [] },
      { _id: id(), role: "Admin" },
      { _id: id(), role: "Admin", payAccess: null },
    ]) {
      const scope = payScope(admin);
      expect(canSeePay(scope, a)).toBe(false);
      expect(canSeePay(scope, admin._id)).toBe(false);
    }
  });

  it("lets an Employee see only its own pay", () => {
    const me = id();
    const scope = payScope({ _id: me, role: "Employee", payAccess: [a] });
    expect(canSeePay(scope, me)).toBe(true);
    expect(canSeePay(scope, String(me))).toBe(true);
    expect(canSeePay(scope, a)).toBe(false);
  });

  it("sees nothing without a caller, a scope or an id", () => {
    expect(canSeePay(payScope(null), a)).toBe(false);
    expect(canSeePay(undefined, a)).toBe(false);
    expect(canSeePay(payScope({ role: "Admin", payAccess: [a] }), null)).toBe(false);
    expect(canSeePay(payScope({ role: "Admin", payAccess: [null] }), null)).toBe(false);
  });
});

describe("redactJob, jobFor and settingsFor", () => {
  const job = { department: "HR", basicPay: 22000, schedule: { timeIn: "08:00" } };

  it("redactJob keeps the other fields, hides the pay and leaves the input alone", () => {
    expect(redactJob(job)).toEqual({
      department: "HR",
      basicPay: null,
      payHidden: true,
      schedule: { timeIn: "08:00" },
    });
    expect(job.basicPay).toBe(22000);
    expect(redactJob(undefined)).toEqual({ basicPay: null, payHidden: true });
  });

  it("redactJob never leaks the Pay not set flag, true or false", () => {
    for (const payNotSet of [true, false]) {
      const flagged = { ...job, payNotSet };
      expect(redactJob(flagged)).not.toHaveProperty("payNotSet");
      expect(flagged.payNotSet).toBe(payNotSet);
    }
    expect(redactJob({ basicPay: null })).not.toHaveProperty("payNotSet");
  });

  it("jobFor gives the job (with its flag) when visible and redacted otherwise", () => {
    const who = id();
    const scope = payScope({ role: "Admin", payAccess: [who] });
    expect(jobFor(scope, who, job)).toEqual(job);
    expect(jobFor(scope, who, { ...job, payNotSet: true })).toEqual({
      ...job,
      payNotSet: true,
    });
    expect(jobFor(scope, id(), job)).toEqual(redactJob(job));
    expect(jobFor(scope, id(), { ...job, payNotSet: true })).toEqual(redactJob(job));
  });

  it("settingsFor redacts only general.jobDescription of a hidden record", () => {
    const who = id();
    const settings = { userId: who, general: { jobDescription: job, other: 1 } };
    const none = payScope({ role: "Admin", payAccess: [] });

    expect(settingsFor(payScope({ role: "Super Admin" }), who, settings)).toEqual(
      settings,
    );
    expect(settingsFor(none, who, settings)).toEqual({
      userId: who,
      general: { jobDescription: redactJob(job), other: 1 },
    });
    expect(settings.general.jobDescription.basicPay).toBe(22000);
    expect(settingsFor(none, who, {})).toEqual({});
  });
});

describe("withPayFlag and ownSettings (the Pay not set flag)", () => {
  it("shows payNotSet: true for a stored flag, a null or a missing pay", () => {
    expect(withPayFlag({ basicPay: 0, payNotSet: true })).toEqual({
      basicPay: 0,
      payNotSet: true,
    });
    expect(withPayFlag({ basicPay: null })).toEqual({ basicPay: null, payNotSet: true });
    expect(withPayFlag({ department: "HR" })).toEqual({
      department: "HR",
      payNotSet: true,
    });
    expect(withPayFlag(undefined)).toEqual({ payNotSet: true });
  });

  it("leaves the key out for a set pay, also when the stored flag is false", () => {
    expect(withPayFlag({ basicPay: 22000 })).toEqual({ basicPay: 22000 });
    expect(withPayFlag({ basicPay: 22000, payNotSet: false })).toEqual({
      basicPay: 22000,
    });
    expect(withPayFlag({ basicPay: 0 })).toEqual({ basicPay: 0 });
  });

  it("leaves its input alone", () => {
    const stored = { basicPay: 22000, payNotSet: false };
    withPayFlag(stored);
    expect(stored).toEqual({ basicPay: 22000, payNotSet: false });
  });

  it("ownSettings keeps the pay and adds the flag", () => {
    const settings = {
      userId: id(),
      general: { jobDescription: { basicPay: 0, payNotSet: true } },
    };
    expect(ownSettings(settings).general.jobDescription).toEqual({
      basicPay: 0,
      payNotSet: true,
    });
    expect(ownSettings({})).toEqual({});
  });
});

describe("canSeeThirteenthMonth", () => {
  const who = id();

  it("is the thirteenth-month key", () => {
    expect(THIRTEENTH_MONTH_KEY).toBe("thirteenth-month");
  });

  it("lets the Super Admin see anyone's, whatever is stored", () => {
    expect(canSeeThirteenthMonth({ role: "Super Admin", pageAccess: [] }, who)).toBe(
      true,
    );
  });

  it("needs both the tick and the pay list from an Admin", () => {
    const admin = (pageAccess, payAccess) => ({ role: "Admin", pageAccess, payAccess });
    expect(canSeeThirteenthMonth(admin(["thirteenth-month"], [who]), who)).toBe(true);
    expect(canSeeThirteenthMonth(admin(["thirteenth-month"], []), who)).toBe(false);
    expect(canSeeThirteenthMonth(admin(["employees", "reports"], [who]), who)).toBe(
      false,
    );
  });

  it("is never true for an Employee, not even its own", () => {
    const me = id();
    expect(
      canSeeThirteenthMonth(
        { _id: me, role: "Employee", pageAccess: ["thirteenth-month"] },
        me,
      ),
    ).toBe(false);
    expect(canSeeThirteenthMonth(null, who)).toBe(false);
  });
});

describe("visibleThirteenthRows", () => {
  const [a, b, c] = [id(), id(), id()];
  const rows = [{ userId: a }, { userId: b }, { userId: c }];

  it("keeps the visible rows in order and leaves the rest out", () => {
    const scope = payScope({ role: "Admin", payAccess: [c, a] });
    expect(visibleThirteenthRows(rows, scope)).toEqual([rows[0], rows[2]]);
  });

  it("keeps every row for the Super Admin and none for an empty list", () => {
    expect(visibleThirteenthRows(rows, payScope({ role: "Super Admin" }))).toEqual(
      rows,
    );
    expect(visibleThirteenthRows(rows, payScope({ role: "Admin" }))).toEqual([]);
    expect(visibleThirteenthRows(undefined, payScope({ role: "Super Admin" }))).toEqual(
      [],
    );
  });
});

describe("sendsBasicPay", () => {
  it.each([[{}], [{ basicPay: undefined }], [{ basicPay: null }], [{ basicPay: "" }], [{ basicPay: "  " }], [undefined]])(
    "treats %p as not sent",
    (body) => {
      expect(sendsBasicPay(body)).toBe(false);
    },
  );

  it.each([0, "0", 25000, "25000", -5, "abc"])("treats %p as sent", (basicPay) => {
    expect(sendsBasicPay({ basicPay })).toBe(true);
  });
});

// ---- The replies ----

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await BasicPayChange.init();
});

afterEach(async () => {
  await User.deleteMany({});
  await Employee.deleteMany({});
  await Settings.deleteMany({});
  await CompanySettings.deleteMany({});
  await BasicPayChange.deleteMany({});
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

const loginAs = async (username) => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body;
};

// Auth + Employee + Settings for one person; signs in Active accounts
const person = async (
  username,
  { role = "Employee", status = "Active", firstName, lastName, employeeId, job = {} } = {},
) => {
  const user = await User.create({
    username,
    password: PASSWORD,
    email: `${username}@example.com`,
    role,
    status,
  });
  await Employee.create({
    userId: user._id,
    firstName: firstName ?? username,
    lastName: lastName ?? "Test",
    employeeId: employeeId ?? `EMP-${username}`,
    email: `${username}@example.com`,
    role,
  });
  await Settings.create({
    userId: user._id,
    general: { jobDescription: { department: "HR", position: "HR Staff", ...job } },
  });
  const token = status === "Active" ? (await loginAs(username)).token : null;
  return { user, token };
};

// An Admin account as POST /api/admins makes it: Auth record only
const adminAccount = async (username, { pageAccess = [], payAccess, ...extra } = {}) => {
  const user = await User.create({
    username,
    password: PASSWORD,
    email: `${username}@example.com`,
    role: "Admin",
    status: "Active",
    firstName: "Rhea",
    lastName: "Cruz",
    pageAccess,
    ...(payAccess === undefined ? {} : { payAccess }),
    ...extra,
  });
  return { user, token: (await loginAs(username)).token };
};

const superAdmin = () =>
  person("admin", { role: "Super Admin", employeeId: "ADM-001" });

// The three people of section 3.4 (Day 19 sample data)
const angelica = () =>
  person("aramos", {
    firstName: "Angelica",
    lastName: "Ramos",
    employeeId: "AC-008",
    job: {
      employmentType: "Regular",
      startDate: "2025-09-01",
      regularizationDate: "2026-03-01",
      basicPay: 22000,
    },
  });
const carlo = () =>
  person("cmercado", {
    firstName: "Carlo",
    lastName: "Mercado",
    employeeId: "AC-012",
    job: {
      department: "Procurement",
      position: "Procurement Staff",
      employmentType: "Probationary",
      startDate: "2026-08-03",
      basicPay: 24000,
    },
  });
const liza = () =>
  person("lfernandez", {
    status: "Resigned",
    firstName: "Liza",
    lastName: "Fernandez",
    employeeId: "AC-013",
    job: {
      employmentType: "Probationary",
      startDate: "2026-06-01",
      resignationDate: "2026-10-16",
      basicPay: 18000,
    },
  });

// The Super Admin, the three people, and Rhea (HR set plus Reports and the 13th month
// tick) whose pay list is Angelica and Liza, not Carlo
const worked = async () => {
  const sa = await superAdmin();
  const a = await angelica();
  const c = await carlo();
  const l = await liza();
  const rhea = await adminAccount("hr.rhea", {
    pageAccess: [
      "employees",
      "admin-calendar",
      "admin-filing",
      "reports",
      "thirteenth-month",
    ],
    payAccess: [a.user._id, l.user._id],
  });
  return { sa, angelica: a, carlo: c, liza: l, rhea };
};

const as = (token) => ({ Authorization: `Bearer ${token}` });
const get = (url, token) => request(app).get(url).set(as(token));
const send = (method, url, token, body) =>
  request(app)[method](url).set(as(token)).send(body);

const listOf = async (token) => {
  const res = await get("/api/employee/employees?includeResigned=true", token);
  expect(res.status).toBe(200);
  return new Map(res.body.map((row) => [row.employeeId, row.jobDescription]));
};
const storedPay = async (userId) =>
  (await Settings.findOne({ userId }).lean()).general.jobDescription.basicPay;

describe("rules 18 and 19: the employee list", () => {
  it("shows the Super Admin every pay", async () => {
    const { sa } = await worked();
    const jobs = await listOf(sa.token);

    expect(jobs.get("AC-008")).toMatchObject({ basicPay: 22000 });
    expect(jobs.get("AC-012")).toMatchObject({ basicPay: 24000 });
    expect(jobs.get("AC-013")).toMatchObject({ basicPay: 18000 });
    for (const job of jobs.values()) expect(job).not.toHaveProperty("payHidden");
  });

  it("shows an Admin the pay on its list and hides the rest, other job details kept", async () => {
    const { rhea } = await worked();
    const jobs = await listOf(rhea.token);

    expect(jobs.get("AC-008")).toMatchObject({ basicPay: 22000 });
    expect(jobs.get("AC-008")).not.toHaveProperty("payHidden");
    expect(jobs.get("AC-013")).toMatchObject({ basicPay: 18000 });
    expect(jobs.get("AC-012")).toMatchObject({
      basicPay: null,
      payHidden: true,
      department: "Procurement",
      position: "Procurement Staff",
    });
  });

  it("hides every pay from an Admin with an empty or missing list", async () => {
    await worked();
    const empty = await adminAccount("empty", { payAccess: [] });
    const missing = await adminAccount("missing");

    for (const { token } of [empty, missing]) {
      const jobs = await listOf(token);
      expect(jobs.size).toBe(3);
      for (const job of jobs.values()) {
        expect(job).toMatchObject({ basicPay: null, payHidden: true });
      }
    }
  });

  it("applies a change to the list on the next request, without a new sign-in", async () => {
    const { sa, carlo: c, rhea } = await worked();
    expect((await listOf(rhea.token)).get("AC-012").payHidden).toBe(true);

    const patched = await send("patch", `/api/admins/${rhea.user._id}`, sa.token, {
      payAccess: [
        String((await User.findOne({ username: "aramos" }))._id),
        String((await User.findOne({ username: "lfernandez" }))._id),
        String(c.user._id),
      ],
    });
    expect(patched.status).toBe(200);

    expect((await listOf(rhea.token)).get("AC-012")).toMatchObject({
      basicPay: 24000,
    });
    const report = await get("/api/thirteenth-month?year=2026", rhea.token);
    expect(report.body.rows.map((row) => row.employeeId)).toContain("AC-012");

    await User.updateOne({ _id: rhea.user._id }, { $set: { payAccess: [] } });
    expect((await listOf(rhea.token)).get("AC-008").payHidden).toBe(true);
  });

  it("still refuses an employee the list", async () => {
    const { carlo: c } = await worked();
    const res = await get("/api/employee/employees", c.token);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Admin access required");
  });
});

describe("rule 19: the profile", () => {
  it("hides the pay of someone not on the list, other job details kept", async () => {
    const { carlo: c, rhea } = await worked();
    const res = await get(`/api/employee/employees/${c.user._id}`, rhea.token);

    expect(res.status).toBe(200);
    expect(res.body.jobDescription).toMatchObject({
      basicPay: null,
      payHidden: true,
      department: "Procurement",
      employmentType: "Probationary",
      startDate: expect.stringMatching(/^2026-08-03/),
    });
    expect(res.body.employee.employeeId).toBe("AC-012");
  });

  it("shows the pay of someone on the list, and everything to the Super Admin", async () => {
    const { sa, angelica: a, carlo: c, liza: l, rhea } = await worked();

    const ange = await get(`/api/employee/employees/${a.user._id}`, rhea.token);
    expect(ange.body.jobDescription.basicPay).toBe(22000);
    expect(ange.body.jobDescription).not.toHaveProperty("payHidden");
    const resigned = await get(`/api/employee/employees/${l.user._id}`, rhea.token);
    expect(resigned.body.jobDescription.basicPay).toBe(18000);

    const bySuper = await get(`/api/employee/employees/${c.user._id}`, sa.token);
    expect(bySuper.body.jobDescription.basicPay).toBe(24000);
    expect(bySuper.body.jobDescription).not.toHaveProperty("payHidden");
  });

  it("still answers 404 for an admin account", async () => {
    const { sa, rhea } = await worked();
    const res = await get(`/api/employee/employees/${sa.user._id}`, rhea.token);
    expect(res.status).toBe(404);
  });
});

describe("rule 19: the 13th month report (section 3.4 numbers)", () => {
  const REPORT = "/api/thirteenth-month?year=2026";

  it("gives the Super Admin all three rows and their totals", async () => {
    const { sa } = await worked();
    const res = await get(REPORT, sa.token);

    expect(res.status).toBe(200);
    expect(res.body.asOf).toBe("2026-11-06");
    expect(res.body.rows.map((row) => [row.employeeId, row.total])).toEqual([
      ["AC-008", 22000],
      ["AC-012", 9909.09],
      ["AC-013", 6875],
    ]);
    const carloRow = res.body.rows[1];
    expect(carloRow).toMatchObject({ computed: 5545.45, projected: 4363.64 });
    expect(res.body.totals).toMatchObject({
      employees: 3,
      computed: 30420.45,
      projected: 8363.64,
      total: 38784.09,
    });
    expect(res.body.incomplete).toBe(0);
  });

  it("gives Rhea only her two rows, with totals and counts over those rows", async () => {
    const { rhea } = await worked();
    // Someone with no basic pay and not on her list: incomplete for the Super Admin only
    await person("fay", { employeeId: "AC-020", job: { startDate: "2024-01-15" } });

    const res = await get(REPORT, rhea.token);

    expect(res.status).toBe(200);
    expect(res.body.rows.map((row) => row.employeeId)).toEqual(["AC-008", "AC-013"]);
    expect(res.body.rows[0]).toMatchObject({
      monthlyBasic: 22000,
      computed: 18000,
      projected: 4000,
      total: 22000,
    });
    expect(res.body.rows[1]).toMatchObject({
      monthlyBasic: 18000,
      computed: 6875,
      projected: 0,
      total: 6875,
    });
    expect(res.body.totals).toMatchObject({
      employees: 2,
      computed: 24875,
      projected: 4000,
      total: 28875,
    });
    const byCutoff = res.body.rows[0].cutoffs.map(
      (cell, i) =>
        Math.round(((cell.amount || 0) + (res.body.rows[1].cutoffs[i].amount || 0)) * 100) /
        100,
    );
    expect(res.body.totals.byCutoff).toEqual(byCutoff);
    expect(res.body.incomplete).toBe(0);
    expect(JSON.stringify(res.body)).not.toContain("AC-012");
  });

  it("counts an incomplete row only when it is shown", async () => {
    const { sa, rhea } = await worked();
    const fay = await person("fay", {
      employeeId: "AC-020",
      job: { startDate: "2024-01-15" },
    });

    expect((await get(REPORT, sa.token)).body.incomplete).toBe(1);
    expect((await get(REPORT, rhea.token)).body.incomplete).toBe(0);

    await User.updateOne({ _id: rhea.user._id }, { $push: { payAccess: fay.user._id } });
    const after = await get(REPORT, rhea.token);
    expect(after.body.incomplete).toBe(1);
    expect(after.body.totals.employees).toBe(2);
  });

  it("gives an Admin with an empty list an empty report", async () => {
    await worked();
    const empty = await adminAccount("empty", {
      pageAccess: ["reports", "thirteenth-month"],
      payAccess: [],
    });
    const res = await get(REPORT, empty.token);

    expect(res.status).toBe(200);
    expect(res.body.rows).toEqual([]);
    expect(res.body.totals).toMatchObject({ employees: 0, total: 0 });
    expect(res.body.incomplete).toBe(0);
  });

  it("needs both the reports and the thirteenth-month ticks from an Admin", async () => {
    const { angelica: a, liza: l } = await worked();
    const payAccess = [a.user._id, l.user._id];
    const reportsOnly = await adminAccount("reports.only", {
      pageAccess: ["reports"],
      payAccess,
    });
    const tickOnly = await adminAccount("tick.only", {
      pageAccess: ["employees", "thirteenth-month"],
      payAccess,
    });
    const both = await adminAccount("both", {
      pageAccess: ["reports", "thirteenth-month"],
      payAccess,
    });

    for (const { token } of [reportsOnly, tickOnly]) {
      const res = await get(REPORT, token);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(DENIED);
      expect(res.body).not.toHaveProperty("rows");
    }

    const ok = await get(REPORT, both.token);
    expect(ok.status).toBe(200);
    expect(ok.body.rows.map((row) => row.employeeId)).toEqual(["AC-008", "AC-013"]);
  });

  it("applies the 13th month tick on the Admin's next request", async () => {
    const { rhea } = await worked();
    await User.updateOne({ _id: rhea.user._id }, { $pull: { pageAccess: "thirteenth-month" } });
    expect((await get(REPORT, rhea.token)).body).toEqual(DENIED);

    await User.updateOne({ _id: rhea.user._id }, { $push: { pageAccess: "thirteenth-month" } });
    expect((await get(REPORT, rhea.token)).status).toBe(200);
  });
});

describe("rule 19: one employee's 13th month", () => {
  const ONE = (userId, year = 2026) => `/api/thirteenth-month/${userId}?year=${year}`;

  // The five ways of not getting a row, each from a caller with the employees tick
  const fiveRefusals = async () => {
    const people = await worked();
    const { sa, angelica: a, carlo: c, rhea } = people;
    // Resigned in 2025: not listed for 2026, and on Rhea's pay list
    const gone = await person("gone", {
      status: "Resigned",
      employeeId: "AC-030",
      job: { startDate: "2019-06-03", resignationDate: "2025-12-19", basicPay: 1 },
    });
    await User.updateOne({ _id: rhea.user._id }, { $push: { payAccess: gone.user._id } });
    // Angelica on its pay list, but no 13th month tick
    const noTick = await adminAccount("no.tick", {
      pageAccess: ["employees", "reports"],
      payAccess: [a.user._id],
    });
    return {
      ...people,
      cases: [
        ["no such employee", id(), rhea.token],
        ["an admin account", sa.user._id, rhea.token],
        ["not listed for the year", gone.user._id, rhea.token],
        ["no thirteenth-month tick", a.user._id, noTick.token],
        ["not on the pay list", c.user._id, rhea.token],
      ],
    };
  };

  it("answers each of the five refusals with the same 404, byte for byte", async () => {
    const { cases } = await fiveRefusals();
    const replies = [];
    for (const [, target, token] of cases) {
      replies.push(await get(ONE(target), token));
    }

    for (const res of replies) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: "Employee not found." });
      expect(res.body).toEqual(EMPLOYEE_NOT_FOUND);
      expect(res.body).not.toHaveProperty("code");
      expect(res.text).toBe(replies[0].text);
      expect(res.headers["content-type"]).toBe(replies[0].headers["content-type"]);
    }
    expect(replies[0].text).toBe('{"message":"Employee not found."}');
  });

  it("no longer answers 403 PAY_NOT_SHARED for someone not on the list", async () => {
    const { carlo: c, rhea } = await worked();
    const res = await get(ONE(c.user._id), rhea.token);
    expect(res.status).toBe(404);
    expect(res.body).not.toEqual(PAY_NOT_SHARED);
  });

  it("gives the row once the tick is added, for someone on the list", async () => {
    const { angelica: a } = await worked();
    const admin = await adminAccount("later", {
      pageAccess: ["employees"],
      payAccess: [a.user._id],
    });
    expect((await get(ONE(a.user._id), admin.token)).status).toBe(404);

    await User.updateOne({ _id: admin.user._id }, { $push: { pageAccess: "thirteenth-month" } });
    const res = await get(ONE(a.user._id), admin.token);
    expect(res.status).toBe(200);
    expect(res.body.row.total).toBe(22000);
  });

  it("keeps the employees guard first: 403 PAGE_ACCESS_DENIED before any lookup", async () => {
    const { angelica: a } = await worked();
    const noEmployees = await adminAccount("no.employees", {
      pageAccess: ["reports", "thirteenth-month"],
      payAccess: [a.user._id],
    });
    for (const target of [a.user._id, id(), "abc"]) {
      const res = await get(ONE(target), noEmployees.token);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(DENIED);
    }
  });

  it("answers a bad id or year with 400 before the 404, even without the tick", async () => {
    const { carlo: c } = await worked();
    const noTick = await adminAccount("no.tick", { pageAccess: ["employees"] });
    expect((await get(ONE("abc"), noTick.token)).status).toBe(400);
    const badYear = await get(ONE(c.user._id, 1999), noTick.token);
    expect(badYear.status).toBe(400);
  });

  it("gives the row of someone on the list, and every row to the Super Admin", async () => {
    const { sa, angelica: a, carlo: c, liza: l, rhea } = await worked();

    const ange = await get(ONE(a.user._id), rhea.token);
    expect(ange.status).toBe(200);
    expect(ange.body.row.total).toBe(22000);
    expect((await get(ONE(l.user._id), rhea.token)).body.row.total).toBe(6875);

    const bySuper = await get(ONE(c.user._id), sa.token);
    expect(bySuper.status).toBe(200);
    expect(bySuper.body.row.total).toBe(9909.09);
  });

  it("answers 400 and the same 404 for every other target", async () => {
    const { sa, carlo: c, rhea } = await worked();
    const other = await adminAccount("other.admin", { payAccess: [] });
    const pending = await person("pend", { status: "Pending", job: { basicPay: 1 } });

    expect((await get(ONE("abc"), rhea.token)).status).toBe(400);
    const badYear = await get(ONE(c.user._id, 1999), rhea.token);
    expect(badYear.status).toBe(400);

    for (const target of [sa.user._id, other.user._id, pending.user._id, id()]) {
      const res = await get(ONE(target), rhea.token);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Employee not found.");
    }
  });
});

describe("rule 19: Settings > General edits of someone else", () => {
  const UPDATE = (userId) => `/api/settings/updateGeneralSettings/${userId}`;

  it("saves an Admin's contact edit and hides the pay in the reply; the pay is unchanged", async () => {
    const { carlo: c, rhea } = await worked();
    const res = await send("put", UPDATE(c.user._id), rhea.token, {
      employee: { contactNumber: "09170000012" },
    });

    expect(res.status).toBe(200);
    expect(res.body.employee.contactNumber).toBe("09170000012");
    expect(res.body.settings.general.jobDescription).toMatchObject({
      basicPay: null,
      payHidden: true,
      department: "Procurement",
    });
    expect(await storedPay(c.user._id)).toBe(24000);
  });

  it("shows the pay of someone on the list, to the Super Admin, and to the employee itself", async () => {
    const { sa, angelica: a, carlo: c, rhea } = await worked();
    const body = { employee: { contactNumber: "0917" } };

    const ange = await send("put", UPDATE(a.user._id), rhea.token, body);
    expect(ange.body.settings.general.jobDescription.basicPay).toBe(22000);
    expect(ange.body.settings.general.jobDescription).not.toHaveProperty("payHidden");

    const bySuper = await send("put", UPDATE(c.user._id), sa.token, body);
    expect(bySuper.body.settings.general.jobDescription.basicPay).toBe(24000);

    const own = await send("put", UPDATE(c.user._id), c.token, body);
    expect(own.status).toBe(200);
    expect(own.body.settings.general.jobDescription.basicPay).toBe(24000);
    expect(own.body.settings.general.jobDescription).not.toHaveProperty("payHidden");
  });

  it("still refuses an employee editing someone else", async () => {
    const { angelica: a, carlo: c } = await worked();
    const res = await send("put", UPDATE(a.user._id), c.token, {
      employee: { contactNumber: "0917" },
    });
    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty("settings");
  });
});

describe("an employee still gets its own pay", () => {
  it("at login and from /me", async () => {
    await worked();
    const login = await loginAs("cmercado");
    expect(login.user.settings.general.jobDescription.basicPay).toBe(24000);

    const me = await get("/api/auth/me", login.token);
    expect(me.status).toBe(200);
    expect(me.body.user.settings.general.jobDescription.basicPay).toBe(24000);
  });
});

describe("rule 20: Edit Employee", () => {
  const EDIT = (userId) => `/api/employee/edit-employee-via-admin/${userId}`;

  it("refuses an Admin's edit carrying basicPay for someone not on its list, and saves nothing", async () => {
    const { carlo: c, rhea } = await worked();
    const res = await send("put", EDIT(c.user._id), rhea.token, {
      firstName: "Changed",
      username: "renamed",
      basicPay: 30000,
    });

    expect(res.status).toBe(403);
    expect(res.body).toEqual(PAY_NOT_SHARED);
    expect((await Employee.findOne({ userId: c.user._id })).firstName).toBe("Carlo");
    expect((await User.findById(c.user._id)).username).toBe("cmercado");
    expect(await storedPay(c.user._id)).toBe(24000);
    expect(await BasicPayChange.countDocuments()).toBe(0);
  });

  it("refuses it before the pay amount is checked", async () => {
    const { carlo: c, rhea } = await worked();
    const res = await send("put", EDIT(c.user._id), rhea.token, { basicPay: -5 });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PAY_NOT_SHARED");
  });

  it("refuses it before the password rule and before a taken username; nothing saved", async () => {
    const { carlo: c, rhea } = await worked();
    const before = await User.findById(c.user._id).lean();
    const edit = (body) => send("put", EDIT(c.user._id), rhea.token, body);

    // Each body alone trips its own rule: the same edit without the pay is a 400
    const shortPassword = { firstName: "Changed", password: "x" };
    const takenUsername = { firstName: "Changed", username: "aramos" };
    const password = await edit(shortPassword);
    expect(password.status).toBe(400);
    expect(password.body.message).toBe("Password must be at least 8 characters.");
    const taken = await edit(takenUsername);
    expect(taken.status).toBe(400);
    expect(taken.body.message).toBe("Username is already taken.");

    // With a basic pay the 403 answers first, alone and with both together
    for (const body of [
      { ...shortPassword, basicPay: 30000 },
      { ...takenUsername, basicPay: 30000 },
      { ...shortPassword, ...takenUsername, basicPay: "30000" },
    ]) {
      const res = await edit(body);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(PAY_NOT_SHARED);
    }

    const after = await User.findById(c.user._id).lean();
    expect(after.username).toBe("cmercado");
    expect(after.password).toBe(before.password);
    expect(after.mustChangePassword).toBe(before.mustChangePassword);
    expect((await Employee.findOne({ userId: c.user._id })).firstName).toBe("Carlo");
    expect(await storedPay(c.user._id)).toBe(24000);
    expect(await BasicPayChange.countDocuments()).toBe(0);
    expect((await loginAs("cmercado")).user.username).toBe("cmercado");
  });

  it.each([-5, "abc"])(
    "answers an Admin's invalid basic pay %p for someone on its list with the 400 amount message, not the 403",
    async (basicPay) => {
      const { angelica: a, rhea } = await worked();
      const res = await send("put", EDIT(a.user._id), rhea.token, {
        firstName: "Changed",
        basicPay,
      });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "Basic pay must be an amount of 0 or more." });
      expect(res.body).not.toHaveProperty("code");
      expect((await Employee.findOne({ userId: a.user._id })).firstName).toBe("Angelica");
      expect(await storedPay(a.user._id)).toBe(22000);
      expect(await BasicPayChange.countDocuments()).toBe(0);
    },
  );

  it.each([
    ["without basicPay", {}],
    ["with a blank basicPay", { basicPay: "" }],
    ["with a null basicPay", { basicPay: null }],
  ])("saves an edit %s and leaves the hidden pay and its history alone", async (_, extra) => {
    const { carlo: c, rhea } = await worked();
    const res = await send("put", EDIT(c.user._id), rhea.token, {
      firstName: "Carlos",
      position: "Senior Procurement Staff",
      ...extra,
    });

    expect(res.status).toBe(200);
    expect((await Employee.findOne({ userId: c.user._id })).firstName).toBe("Carlos");
    const job = (await Settings.findOne({ userId: c.user._id }).lean()).general
      .jobDescription;
    expect(job.position).toBe("Senior Procurement Staff");
    expect(job.basicPay).toBe(24000);
    expect(await BasicPayChange.countDocuments()).toBe(0);
  });

  it("lets an Admin change the pay of someone on its list", async () => {
    const { angelica: a, rhea } = await worked();
    const res = await send("put", EDIT(a.user._id), rhea.token, { basicPay: 23000 });

    expect(res.status).toBe(200);
    expect(await storedPay(a.user._id)).toBe(23000);
    expect(await BasicPayChange.countDocuments({ userId: a.user._id })).toBe(2);
  });

  it("lets the Super Admin change anyone's pay", async () => {
    const { sa, carlo: c } = await worked();
    const res = await send("put", EDIT(c.user._id), sa.token, { basicPay: 25000 });

    expect(res.status).toBe(200);
    expect(await storedPay(c.user._id)).toBe(25000);
  });

  it("keeps the earlier refusals first: page, own record, bad id, not found", async () => {
    const { sa, carlo: c, rhea } = await worked();
    const pay = { basicPay: 1 };

    const noTick = await adminAccount("no.tick", { payAccess: [] });
    const page = await send("put", EDIT(c.user._id), noTick.token, pay);
    expect(page.status).toBe(403);
    expect(page.body).toEqual(DENIED);

    const linked = await adminAccount("linked", {
      pageAccess: ["employees"],
      linkedEmployeeId: c.user._id,
    });
    const own = await send("put", EDIT(c.user._id), linked.token, pay);
    expect(own.status).toBe(403);
    expect(own.body.code).toBe("OWN_EMPLOYEE_RECORD");

    expect((await send("put", EDIT("abc"), rhea.token, pay)).status).toBe(400);
    expect((await send("put", EDIT(sa.user._id), rhea.token, pay)).status).toBe(404);
    expect((await send("put", EDIT(id()), rhea.token, pay)).status).toBe(404);
    expect(await storedPay(c.user._id)).toBe(24000);
  });
});

describe("rule 21: resigned, reinstated and deleted employees on the list", () => {
  it("keeps a resigned and then reinstated employee on the list", async () => {
    const { angelica: a, rhea } = await worked();

    const resigned = await send(
      "patch",
      `/api/employee/employees/${a.user._id}/resign`,
      rhea.token,
      { resignationDate: "2026-11-05" },
    );
    expect(resigned.status).toBe(200);
    expect((await User.findById(rhea.user._id)).payAccess.map(String)).toContain(
      String(a.user._id),
    );
    expect((await listOf(rhea.token)).get("AC-008").basicPay).toBe(22000);

    const back = await send(
      "patch",
      `/api/employee/employees/${a.user._id}/reinstate`,
      rhea.token,
      {},
    );
    expect(back.status).toBe(200);
    expect((await User.findById(rhea.user._id)).payAccess.map(String)).toContain(
      String(a.user._id),
    );
    expect((await listOf(rhea.token)).get("AC-008").basicPay).toBe(22000);
  });

  it("takes a deleted employee off every Admin's list, the others kept", async () => {
    const { sa, angelica: a, liza: l, rhea } = await worked();
    const other = await adminAccount("other.admin", { payAccess: [a.user._id] });

    const res = await request(app)
      .delete("/api/employee/delete-employee/AC-008")
      .set(as(sa.token));
    expect(res.status).toBe(200);

    expect((await User.findById(rhea.user._id)).payAccess.map(String)).toEqual([
      String(l.user._id),
    ]);
    expect((await User.findById(other.user._id)).payAccess).toEqual([]);
  });

  it("refuses an id that is not an Employee-role account", async () => {
    const { sa, rhea } = await worked();
    const res = await send("patch", `/api/admins/${rhea.user._id}`, sa.token, {
      payAccess: [String(sa.user._id)],
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(`Not an employee: ${sa.user._id}`);
  });
});

// Replaces rule 22 (Ayber's PR C review): basic pay is required from the Super Admin
// and any Admin, and an Admin's new employee joins its own pay list
describe("Add Employee: basic pay required, and the adding Admin's pay list", () => {
  const ADD = "/api/employee/add-employee-via-admin";
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
  const REQUIRED = { message: "Basic pay is required." };
  const nothingCreated = async () => {
    expect(await User.findOne({ username: "nina" })).toBeNull();
    expect(await Employee.findOne({ employeeId: "AC-050" })).toBeNull();
    expect(await Settings.countDocuments()).toBe(4);
  };
  const payListOf = async (user) =>
    ((await User.findById(user._id).lean()).payAccess || []).map(String);

  const withoutPay = [
    ["missing", { basicPay: undefined }],
    ["null", { basicPay: null }],
    ["blank", { basicPay: "" }],
    ["spaces only", { basicPay: "   " }],
  ];

  it.each(withoutPay)(
    "refuses a %s basic pay from the Super Admin and an Admin; nothing created",
    async (_, extra) => {
      const { sa, angelica: a, liza: l, rhea } = await worked();
      for (const { token } of [sa, rhea]) {
        const res = await send("post", ADD, token, { ...NEW_EMPLOYEE, ...extra });
        expect(res.status).toBe(400);
        expect(res.body).toEqual(REQUIRED);
      }
      await nothingCreated();
      expect(await payListOf(rhea.user)).toEqual([String(a.user._id), String(l.user._id)]);
    },
  );

  it.each([-1, "abc"])(
    "refuses an invalid basic pay %p with the job details message, from both roles",
    async (basicPay) => {
      const { sa, rhea } = await worked();
      for (const { token } of [sa, rhea]) {
        const res = await send("post", ADD, token, { ...NEW_EMPLOYEE, basicPay });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: "Basic pay must be an amount of 0 or more." });
      }
      await nothingCreated();
    },
  );

  it("refuses in order: password, basic pay required, job details, taken", async () => {
    const { rhea } = await worked();
    const post = (body) => send("post", ADD, rhea.token, { ...NEW_EMPLOYEE, ...body });

    const password = await post({ password: "x", basicPay: "" });
    expect(password.body.message).toBe("Password must be at least 8 characters.");

    const pay = await post({
      basicPay: "",
      employmentType: "Regular",
      username: "aramos",
    });
    expect(pay.body).toEqual(REQUIRED);

    const job = await post({ basicPay: -1, username: "aramos" });
    expect(job.body.message).toBe("Basic pay must be an amount of 0 or more.");

    const taken = await post({ username: "aramos" });
    expect(taken.status).toBe(400);
    expect(taken.body.message).toBe("Username is already taken.");
    await nothingCreated();
  });

  it("puts an Admin's new employee on its own pay list and shows the pay it entered", async () => {
    const { angelica: a, liza: l, rhea } = await worked();
    const res = await send("post", ADD, rhea.token, NEW_EMPLOYEE);

    expect(res.status).toBe(201);
    const job = res.body.settings.general.jobDescription;
    expect(job).toMatchObject({ basicPay: 20000, position: "Clerk" });
    expect(job).not.toHaveProperty("payHidden");
    expect(job).not.toHaveProperty("payNotSet");
    expect(res.body.user).not.toHaveProperty("password");

    const nina = res.body.user._id;
    expect(await storedPay(nina)).toBe(20000);
    const stored = (await Settings.findOne({ userId: nina }).lean()).general.jobDescription;
    expect(stored.payNotSet).toBe(false);
    expect(await payListOf(rhea.user)).toEqual([
      String(a.user._id),
      String(l.user._id),
      nina,
    ]);

    // Its next list and report show the pay too
    expect((await listOf(rhea.token)).get("AC-050")).toMatchObject({ basicPay: 20000 });
    const report = await get("/api/thirteenth-month?year=2026", rhea.token);
    expect(report.body.rows.map((row) => row.employeeId)).toContain("AC-050");
  });

  it("puts it on that Admin's list only, once", async () => {
    const { rhea } = await worked();
    const other = await adminAccount("other.admin", {
      pageAccess: ["employees"],
      payAccess: [],
    });
    const res = await send("post", ADD, other.token, NEW_EMPLOYEE);
    expect(res.status).toBe(201);

    expect(await payListOf(other.user)).toEqual([res.body.user._id]);
    expect(await payListOf(rhea.user)).not.toContain(res.body.user._id);
    expect((await listOf(rhea.token)).get("AC-050")).toMatchObject({
      basicPay: null,
      payHidden: true,
    });
  });

  it("accepts 0 as an entered basic pay", async () => {
    const { rhea } = await worked();
    const res = await send("post", ADD, rhea.token, { ...NEW_EMPLOYEE, basicPay: 0 });
    expect(res.status).toBe(201);
    expect(res.body.settings.general.jobDescription.basicPay).toBe(0);
    expect(res.body.settings.general.jobDescription).not.toHaveProperty("payNotSet");
    expect(await storedPay(res.body.user._id)).toBe(0);
  });

  it("lets the Super Admin add with pay, and changes no pay list", async () => {
    const { sa, rhea } = await worked();
    const before = await payListOf(rhea.user);
    const res = await send("post", ADD, sa.token, { ...NEW_EMPLOYEE, basicPay: "15000" });

    expect(res.status).toBe(201);
    expect(res.body.settings.general.jobDescription.basicPay).toBe(15000);
    expect(res.body.settings.general.jobDescription).not.toHaveProperty("payHidden");
    expect(res.body.settings.general.jobDescription).not.toHaveProperty("payNotSet");
    expect(await storedPay(res.body.user._id)).toBe(15000);
    expect((await User.findById(sa.user._id).lean()).payAccess || []).toEqual([]);
    expect(await payListOf(rhea.user)).toEqual(before);
    expect(await User.countDocuments({ payAccess: res.body.user._id })).toBe(0);
  });

  it("still refuses an Employee and an Admin without the employees tick", async () => {
    const { carlo: c } = await worked();
    const noTick = await adminAccount("no.tick", { pageAccess: ["reports"], payAccess: [] });

    const byEmployee = await send("post", ADD, c.token, NEW_EMPLOYEE);
    expect(byEmployee.status).toBe(403);
    expect(byEmployee.body.message).toBe("Admin access required");

    const byAdmin = await send("post", ADD, noTick.token, NEW_EMPLOYEE);
    expect(byAdmin.status).toBe(403);
    expect(byAdmin.body).toEqual(DENIED);
    await nothingCreated();
    expect(await payListOf(noTick.user)).toEqual([]);
  });
});

describe("rule 23: the pay list opens no page", () => {
  it("still refuses the report, profile and 13th month card without their ticks", async () => {
    const { angelica: a, carlo: c, liza: l } = await worked();
    const listOnly = await adminAccount("list.only", {
      pageAccess: [],
      payAccess: [a.user._id, c.user._id, l.user._id],
    });
    const noReports = await adminAccount("no.reports", {
      pageAccess: ["employees"],
      payAccess: [a.user._id, c.user._id, l.user._id],
    });

    const report = await get("/api/thirteenth-month?year=2026", noReports.token);
    expect(report.status).toBe(403);
    expect(report.body).toEqual(DENIED);

    for (const url of [
      `/api/employee/employees/${a.user._id}`,
      `/api/thirteenth-month/${a.user._id}?year=2026`,
      "/api/thirteenth-month?year=2026",
    ]) {
      const res = await get(url, listOnly.token);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(DENIED);
    }

    // The list itself is open to any Admin (pickers need it) and follows the pay list
    expect((await listOf(listOnly.token)).get("AC-012").basicPay).toBe(24000);
  });
});

// ---- Company settings, self sign-up and the "Pay not set" flag ----

const COMPANY = "/api/settings/company";
// The company record as MongoDB holds it, with no Mongoose schema in between
const rawCompany = () => CompanySettings.collection.findOne({ key: "company" });
const storedJob = async (userId) =>
  (await Settings.findOne({ userId }).lean()).general.jobDescription;

// There is no company default basic pay: `defaultBasicPay` is a field like any other
// the company record doesn't have.
describe("company settings: a body carrying defaultBasicPay is ignored like any unknown field", () => {
  it("saves the other field for the Super Admin and an Admin with the tick; nothing is stored or sent under that name", async () => {
    const { sa, carlo: c } = await worked();
    const company = await adminAccount("company.admin", {
      pageAccess: ["settings-company"],
      payAccess: [],
    });

    for (const [caller, who] of [
      [sa, "Super Admin"],
      [company, "Admin"],
    ]) {
      for (const [n, value] of [15000, "abc", null, {}].entries()) {
        const name = `${who} ${n}`;
        const res = await send("put", COMPANY, caller.token, {
          name,
          defaultBasicPay: value,
        });
        expect(res.status).toBe(200);
        expect(res.body.name).toBe(name);
        expect(res.body).not.toHaveProperty("defaultBasicPay");

        const stored = await rawCompany();
        expect(stored.name).toBe(name);
        expect(stored).not.toHaveProperty("defaultBasicPay");

        for (const { token } of [caller, c]) {
          const read = await get(COMPANY, token);
          expect(read.status).toBe(200);
          expect(read.body.name).toBe(name);
          expect(read.body).not.toHaveProperty("defaultBasicPay");
        }
      }

      const logo = await send("delete", `${COMPANY}/logo`, caller.token);
      expect(logo.status).toBe(200);
      expect(logo.body).not.toHaveProperty("defaultBasicPay");
    }
    expect(await CompanySettings.countDocuments()).toBe(1);
  });

  it("keeps the guards: no settings-company tick, or an Employee; nothing saved", async () => {
    const { carlo: c, rhea } = await worked();
    const noTick = await send("put", COMPANY, rhea.token, { name: "Changed" });
    expect(noTick.status).toBe(403);
    expect(noTick.body).toEqual(DENIED);

    const byEmployee = await send("put", COMPANY, c.token, { name: "Changed" });
    expect(byEmployee.status).toBe(403);
    expect(byEmployee.body.message).toBe("Admin access required");
    expect(await CompanySettings.countDocuments({ name: "Changed" })).toBe(0);
  });
});

describe("self sign-up: starts on a basic pay of 0, marked Pay not set", () => {
  const signup = (other = {}) =>
    request(app).post("/api/auth/signup").send({
      firstName: "Sol",
      lastName: "Reyes",
      email: "sol@example.com",
      username: "sol",
      password: "Password123!",
      gender: "Male",
      ...other,
    });
  const solId = async () => (await User.findOne({ username: "sol" }).lean())._id;
  const APPROVE = (userId) => `/api/auth/users/${userId}/status`;
  const payListOf = async (user) =>
    ((await User.findById(user._id).lean()).payAccess || []).map(String);
  const STARTED = { basicPay: 0, payNotSet: true };

  it("starts on basicPay 0, marked Pay not set; the reply carries no pay", async () => {
    await worked();
    const res = await signup();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: "User created successfully",
      email: "sol@example.com",
      signupToken: expect.any(String),
    });
    expect(await storedJob(await solId())).toMatchObject(STARTED);
    expect(await BasicPayChange.countDocuments()).toBe(0);
  });

  it("starts on 0 whatever the sign-up body or the company record carries", async () => {
    await worked();
    // A company record still holding the removed field, written past the schema
    await CompanySettings.collection.insertOne({ key: "company", defaultBasicPay: 15000 });

    const res = await signup({ basicPay: 50000, payNotSet: false });
    expect(res.status).toBe(200);
    expect(await storedJob(await solId())).toMatchObject(STARTED);
  });

  it("shows Pay not set after approval to whoever may see the pay, and to no one else", async () => {
    const { sa, rhea } = await worked();
    await signup();
    const id = await solId();
    const approved = await send("put", `/api/auth/users/${id}/status`, sa.token);
    expect(approved.status).toBe(200);
    const { employeeId } = await Employee.findOne({ userId: id }).lean();

    expect((await listOf(sa.token)).get(employeeId)).toMatchObject(STARTED);
    const hidden = (await listOf(rhea.token)).get(employeeId);
    expect(hidden).toMatchObject({ basicPay: null, payHidden: true });
    expect(hidden).not.toHaveProperty("payNotSet");

    await User.updateOne({ _id: rhea.user._id }, { $push: { payAccess: id } });
    expect((await listOf(rhea.token)).get(employeeId)).toMatchObject(STARTED);
  });

  it("adds nobody to the pay list of the Admin who approves it", async () => {
    const { angelica: a, liza: l, rhea } = await worked();
    const empty = await adminAccount("empty", { pageAccess: ["employees"], payAccess: [] });
    await signup();
    const sol = await solId();
    await signup({ email: "sam@example.com", username: "sam" });
    const sam = (await User.findOne({ username: "sam" }).lean())._id;

    const byRhea = await send("put", APPROVE(sol), rhea.token);
    expect(byRhea.status).toBe(200);
    expect(byRhea.body.user.status).toBe("Active");
    const byEmpty = await send("put", APPROVE(sam), empty.token);
    expect(byEmpty.status).toBe(200);

    expect(await payListOf(rhea.user)).toEqual([String(a.user._id), String(l.user._id)]);
    expect(await payListOf(empty.user)).toEqual([]);
    expect(await User.countDocuments({ payAccess: { $in: [sol, sam] } })).toBe(0);

    // So the approving Admin still can't see the pay, and the flag with it
    for (const userId of [sol, sam]) {
      const { employeeId } = await Employee.findOne({ userId }).lean();
      for (const { token } of [rhea, empty]) {
        const hidden = (await listOf(token)).get(employeeId);
        expect(hidden).toMatchObject({ basicPay: null, payHidden: true });
        expect(hidden).not.toHaveProperty("payNotSet");
      }
      expect(await storedJob(userId)).toMatchObject(STARTED);
    }
  });

  // Login and /me send the caller's own Settings record through ownSettings, like
  // Settings > General: `payNotSet: true` for the stored flag or no pay, otherwise the
  // key is left out (Friday batch, Group 1; before, they sent the stored flag as is).
  describe("login and /me for the sign-up's own account", () => {
    const jobAtLoginAndMe = async (username) => {
      const login = await loginAs(username);
      const me = await get("/api/auth/me", login.token);
      expect(me.status).toBe(200);
      const jobs = [login, me.body].map((body) => body.user.settings.general.jobDescription);
      expect(jobs[1]).toEqual(jobs[0]);
      return jobs[0];
    };

    it("carry the 0 it started on with the stored flag payNotSet: true", async () => {
      const { sa } = await worked();
      await signup();
      await send("put", APPROVE(await solId()), sa.token);

      const job = await jobAtLoginAndMe("sol");
      expect(job).toMatchObject(STARTED);
      expect(job).not.toHaveProperty("payHidden");
    });

    it("leave payNotSet out once its pay is saved, like the other replies", async () => {
      const { sa } = await worked();
      await signup();
      const sol = await solId();
      await send("put", APPROVE(sol), sa.token);
      const saved = await send(
        "put",
        `/api/employee/edit-employee-via-admin/${sol}`,
        sa.token,
        { basicPay: 18000 },
      );
      expect(saved.status).toBe(200);

      const job = await jobAtLoginAndMe("sol");
      expect(job.basicPay).toBe(18000);
      expect(job).not.toHaveProperty("payNotSet");
      expect((await storedJob(sol)).payNotSet).toBe(false);

      // The other replies leave the key out for a set pay too (withPayFlag)
      const { employeeId } = await Employee.findOne({ userId: sol }).lean();
      expect((await listOf(sa.token)).get(employeeId)).not.toHaveProperty("payNotSet");
    });

    it("mark an employee with no pay payNotSet: true, the same as Settings > General", async () => {
      await worked();
      const fay = await person("fay", {
        employeeId: "AC-020",
        job: { startDate: "2024-01-15" },
      });

      expect(await jobAtLoginAndMe("fay")).toMatchObject({
        basicPay: null,
        payNotSet: true,
      });
      // Worked out for the reply; the stored flag stays false
      expect((await storedJob(fay.user._id)).payNotSet).toBe(false);

      // Its own Settings > General reply works the flag out from the missing pay
      const own = await send(
        "put",
        `/api/settings/updateGeneralSettings/${fay.user._id}`,
        fay.token,
        { employee: { contactNumber: "0917" } },
      );
      expect(own.body.settings.general.jobDescription).toMatchObject({
        basicPay: null,
        payNotSet: true,
      });
    });
  });
});

describe("Pay not set in the replies", () => {
  // Fran: the starting 0 with the stored flag (a self sign-up); Fay: no pay and no flag;
  // Angelica: a set pay
  const flagged = async () => {
    const people = await worked();
    const fran = await person("fran", {
      employeeId: "AC-021",
      job: { startDate: "2026-01-05", basicPay: 0, payNotSet: true },
    });
    const fay = await person("fay", {
      employeeId: "AC-020",
      job: { startDate: "2024-01-15" },
    });
    await User.updateOne(
      { _id: people.rhea.user._id },
      { $push: { payAccess: fran.user._id } },
    );
    return { ...people, fran, fay };
  };

  it("in the list: true for a stored flag or no pay, absent for a set pay or a hidden one", async () => {
    const { sa, rhea } = await flagged();

    const bySuper = await listOf(sa.token);
    expect(bySuper.get("AC-021")).toMatchObject({ basicPay: 0, payNotSet: true });
    expect(bySuper.get("AC-020")).toMatchObject({ basicPay: null, payNotSet: true });
    expect(bySuper.get("AC-008")).not.toHaveProperty("payNotSet");
    expect(bySuper.get("AC-012")).not.toHaveProperty("payNotSet");

    const byRhea = await listOf(rhea.token);
    expect(byRhea.get("AC-021")).toMatchObject({ basicPay: 0, payNotSet: true });
    expect(byRhea.get("AC-008")).not.toHaveProperty("payNotSet");
    for (const hidden of ["AC-020", "AC-012"]) {
      expect(byRhea.get(hidden)).toMatchObject({ basicPay: null, payHidden: true });
      expect(byRhea.get(hidden)).not.toHaveProperty("payNotSet");
    }
  });

  it("in the profile, the same way", async () => {
    const { sa, angelica: a, fran, fay, rhea } = await flagged();
    const profile = async (userId, token) =>
      (await get(`/api/employee/employees/${userId}`, token)).body.jobDescription;

    expect(await profile(fran.user._id, sa.token)).toMatchObject({
      basicPay: 0,
      payNotSet: true,
    });
    expect(await profile(fay.user._id, sa.token)).toMatchObject({
      basicPay: null,
      payNotSet: true,
    });
    expect(await profile(a.user._id, sa.token)).not.toHaveProperty("payNotSet");
    expect(await profile(fran.user._id, rhea.token)).toMatchObject({
      basicPay: 0,
      payNotSet: true,
    });

    const hidden = await profile(fay.user._id, rhea.token);
    expect(hidden).toMatchObject({ basicPay: null, payHidden: true });
    expect(hidden).not.toHaveProperty("payNotSet");
  });

  it("in the Settings > General reply, for others and for the employee itself", async () => {
    const { sa, angelica: a, fran, fay, rhea } = await flagged();
    const UPDATE = (userId) => `/api/settings/updateGeneralSettings/${userId}`;
    const body = { employee: { contactNumber: "0917" } };
    const jobOf = (res) => res.body.settings.general.jobDescription;

    expect(jobOf(await send("put", UPDATE(fran.user._id), sa.token, body))).toMatchObject({
      basicPay: 0,
      payNotSet: true,
    });
    expect(jobOf(await send("put", UPDATE(fran.user._id), rhea.token, body))).toMatchObject({
      basicPay: 0,
      payNotSet: true,
    });
    const hidden = jobOf(await send("put", UPDATE(fay.user._id), rhea.token, body));
    expect(hidden).toMatchObject({ basicPay: null, payHidden: true });
    expect(hidden).not.toHaveProperty("payNotSet");

    expect(jobOf(await send("put", UPDATE(fran.user._id), fran.token, body))).toMatchObject({
      basicPay: 0,
      payNotSet: true,
    });
    expect(jobOf(await send("put", UPDATE(fay.user._id), fay.token, body))).toMatchObject({
      payNotSet: true,
    });
    expect(jobOf(await send("put", UPDATE(a.user._id), a.token, body))).not.toHaveProperty(
      "payNotSet",
    );
    // Showing it changed nothing
    expect((await storedJob(fran.user._id)).payNotSet).toBe(true);
  });
});

describe("Pay not set is cleared only by a saved basic pay", () => {
  const EDIT = (userId) => `/api/employee/edit-employee-via-admin/${userId}`;

  const flaggedFran = async () => {
    const people = await worked();
    const fran = await person("fran", {
      employeeId: "AC-021",
      job: { startDate: "2026-01-05", basicPay: 0, payNotSet: true },
    });
    return { ...people, fran };
  };
  const flagOf = async (fran) => (await storedJob(fran.user._id)).payNotSet;
  // The pay history as [amount, "YYYY-MM-DD"], oldest first
  const payHistory = async (fran) =>
    (await BasicPayChange.find({ userId: fran.user._id }).sort({ effectiveFrom: 1 }).lean()).map(
      (change) => [change.amount, toDateKey(change.effectiveFrom)],
    );

  it("clears it when the Super Admin saves the same amount", async () => {
    const { sa, fran } = await flaggedFran();
    const res = await send("put", EDIT(fran.user._id), sa.token, { basicPay: 0 });

    expect(res.status).toBe(200);
    expect(await flagOf(fran)).toBe(false);
    expect(await storedPay(fran.user._id)).toBe(0);
    const shown = (await listOf(sa.token)).get("AC-021");
    expect(shown.basicPay).toBe(0);
    expect(shown).not.toHaveProperty("payNotSet");
    // The starting 0 is not recorded as an old pay; the saved 0 is, from today
    expect(await payHistory(fran)).toEqual([[0, "2026-11-06"]]);
  });

  it("clears it when an Admin with the person on its list saves a new amount", async () => {
    const { fran, rhea } = await flaggedFran();
    await User.updateOne({ _id: rhea.user._id }, { $push: { payAccess: fran.user._id } });

    const res = await send("put", EDIT(fran.user._id), rhea.token, { basicPay: "16000" });
    expect(res.status).toBe(200);
    expect(await flagOf(fran)).toBe(false);
    expect(await storedPay(fran.user._id)).toBe(16000);
    // Only the new pay, from today: no P0 from the Jan 5 start date
    expect(await payHistory(fran)).toEqual([[16000, "2026-11-06"]]);
  });

  it("shows the flagged row in the 13th month only to whoever may see the pay", async () => {
    const { sa, fran, rhea } = await flaggedFran();
    const REPORT = "/api/thirteenth-month?year=2026";
    const ONE = `/api/thirteenth-month/${fran.user._id}?year=2026`;
    const blocked = { total: null, computed: null, projected: null, flags: ["NO_BASIC_PAY"] };

    const bySuper = await get(REPORT, sa.token);
    expect(bySuper.body.rows.find((row) => row.employeeId === "AC-021")).toMatchObject(
      blocked,
    );
    expect(bySuper.body.incomplete).toBe(1);
    expect(bySuper.body.totals.employees).toBe(3);

    // Not on Rhea's list: no row, not counted, and the one-employee route finds no one
    const byRhea = await get(REPORT, rhea.token);
    expect(byRhea.body.rows.map((row) => row.employeeId)).not.toContain("AC-021");
    expect(byRhea.body.incomplete).toBe(0);
    expect((await get(ONE, rhea.token)).status).toBe(404);

    await User.updateOne({ _id: rhea.user._id }, { $push: { payAccess: fran.user._id } });
    expect((await get(REPORT, rhea.token)).body.incomplete).toBe(1);
    expect((await get(ONE, rhea.token)).body.row).toMatchObject(blocked);
  });

  it.each([
    ["without basicPay", {}],
    ["with a blank basicPay", { basicPay: "" }],
    ["with a null basicPay", { basicPay: null }],
  ])("keeps it on an edit %s", async (_, extra) => {
    const { sa, fran } = await flaggedFran();
    const res = await send("put", EDIT(fran.user._id), sa.token, {
      firstName: "Francine",
      ...extra,
    });
    expect(res.status).toBe(200);
    expect(await flagOf(fran)).toBe(true);
  });

  it("keeps it on a refused edit: an invalid pay, or a hidden pay sent", async () => {
    const { sa, fran, rhea } = await flaggedFran();

    const invalid = await send("put", EDIT(fran.user._id), sa.token, { basicPay: -5 });
    expect(invalid.status).toBe(400);
    expect(await flagOf(fran)).toBe(true);

    const hidden = await send("put", EDIT(fran.user._id), rhea.token, { basicPay: 16000 });
    expect(hidden.status).toBe(403);
    expect(hidden.body).toEqual(PAY_NOT_SHARED);
    expect(await flagOf(fran)).toBe(true);

    const other = await send("put", EDIT(fran.user._id), rhea.token, { firstName: "F" });
    expect(other.status).toBe(200);
    expect(await flagOf(fran)).toBe(true);
    expect(await BasicPayChange.countDocuments()).toBe(0);
  });

  it("keeps it through a contact edit, a resignation and a reinstatement", async () => {
    const { sa, fran } = await flaggedFran();
    await send("put", `/api/settings/updateGeneralSettings/${fran.user._id}`, sa.token, {
      employee: { contactNumber: "0917" },
    });
    await send("patch", `/api/employee/employees/${fran.user._id}/resign`, sa.token, {
      resignationDate: "2026-11-05",
    });
    await send("patch", `/api/employee/employees/${fran.user._id}/reinstate`, sa.token, {});
    expect(await flagOf(fran)).toBe(true);
  });
});
