jest.mock("../utils/nodemailer", () => jest.fn().mockResolvedValue());

// "Today" is fixed so the tests don't depend on the real date: the route reads it from
// manilaToday() in utils/leaveCredits, which is replaced here (everything else in that
// module stays real).
jest.mock("../utils/leaveCredits", () => ({
  ...jest.requireActual("../utils/leaveCredits"),
  manilaToday: jest.fn(() => "2026-11-04"),
}));

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const BasicPayChange = require("../models/basicPayChange");
const { manilaToday, toDateKey } = require("../utils/leaveCredits");
const { PAY_HISTORY_START } = require("../config/payroll");

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await BasicPayChange.init();
});

afterEach(async () => {
  manilaToday.mockReturnValue("2026-11-04");
  await User.deleteMany({});
  await Employee.deleteMany({});
  await Settings.deleteMany({});
  await BasicPayChange.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const loginAs = async (username, password = "Password123!") => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password });
  return res.body.token;
};

// Creates Auth + Employee + Settings for one person; signs in Active accounts
const person = async (
  username,
  {
    role = "Employee",
    status = "Active",
    job = {},
    firstName,
    lastName,
    employeeId,
  } = {},
) => {
  const user = await User.create({
    username,
    password: "Password123!",
    email: `${username}@example.com`,
    role,
    status,
  });
  await Employee.create({
    userId: user._id,
    firstName: firstName ?? username.charAt(0).toUpperCase() + username.slice(1),
    lastName: lastName ?? "Test",
    employeeId: employeeId ?? `EMP-${username}`,
    email: `${username}@example.com`,
    role,
  });
  await Settings.create({
    userId: user._id,
    general: { jobDescription: { employmentType: "Regular", ...job } },
  });
  const token = status === "Active" ? await loginAs(username) : null;
  return { user, token };
};

const as = (token) => ({ Authorization: `Bearer ${token}` });
const admin = () => person("admin", { role: "Admin" });
const longServing = (username, extra = {}) =>
  person(username, {
    job: { basicPay: 25000, startDate: "2023-03-01" },
    ...extra,
  });

const BASE = "/api/thirteenth-month";
const HEADER_KEYS = ["asOf", "cutoffs", "payHistoryStart", "year"];

describe("13th month API: access", () => {
  it("refuses an employee token on both routes", async () => {
    const { user, token } = await longServing("ana");

    const responses = await Promise.all([
      request(app).get(BASE).set(as(token)),
      request(app).get(`${BASE}/${user._id}`).set(as(token)),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Admin access required");
      expect(res.body).not.toHaveProperty("rows");
      expect(res.body).not.toHaveProperty("row");
    }
  });

  it("refuses a request without a token", async () => {
    const res = await request(app).get(BASE);
    expect(res.status).toBe(401);
  });

  it("no longer has the opening amount route", async () => {
    const { token } = await admin();
    const { user } = await longServing("ana");

    const res = await request(app)
      .put(`${BASE}/${user._id}/opening`)
      .set(as(token))
      .send({ year: 2026, amount: 100 });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/thirteenth-month", () => {
  it("lists the year's employees with the header, totals and incomplete count", async () => {
    const { token } = await admin();
    const ana = await longServing("ana", { firstName: "Ana", lastName: "Cruz" });
    await person("ben", {
      firstName: "Ben",
      lastName: "Reyes",
      job: {
        basicPay: 18000,
        startDate: "2026-11-18",
        employmentType: "Probationary",
      },
    });
    await longServing("dan", { firstName: "Dan", lastName: "Lim" });
    await person("carla", {
      status: "Resigned",
      firstName: "Carla",
      lastName: "Santos",
      job: {
        basicPay: 30000,
        startDate: "2019-06-03",
        resignationDate: "2026-12-04",
      },
    });
    await person("fay", {
      firstName: "Fay",
      lastName: "Go",
      job: { startDate: "2024-01-15" }, // no basic pay
    });
    await person("old", {
      status: "Resigned",
      job: {
        basicPay: 30000,
        startDate: "2019-06-03",
        resignationDate: "2025-12-19",
      },
    });
    await longServing("pending", { status: "Pending" });
    await longServing("inactive", { status: "Inactive" });

    const res = await request(app).get(`${BASE}?year=2026`).set(as(token));

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      [...HEADER_KEYS, "incomplete", "rows", "totals"].sort(),
    );
    expect(res.body).toMatchObject({
      year: 2026,
      asOf: "2026-11-04",
      payHistoryStart: "2026-11-04",
      incomplete: 1, // Fay (no basic pay)
    });
    expect(res.body.cutoffs).toHaveLength(25);
    expect(res.body.cutoffs[0]).toEqual({
      cutoff: "2026-01-yearEnd",
      month: "2026-01",
      half: "yearEnd",
      start: "2026-01-01",
      end: "2026-01-10",
      weekdays: 7,
      cutoffWeekdays: 11,
    });
    expect(res.body.cutoffs[21]).toEqual({
      cutoff: "2026-11-1st",
      month: "2026-11",
      half: "1st",
      start: "2026-11-11",
      end: "2026-11-25",
      weekdays: 11,
      cutoffWeekdays: 11,
    });
    expect(res.body.cutoffs[24]).toEqual({
      cutoff: "2026-12-yearEnd",
      month: "2026-12",
      half: "yearEnd",
      start: "2026-12-26",
      end: "2026-12-31",
      weekdays: 4,
      cutoffWeekdays: 11,
    });

    // By Employee ID, Resigned mixed in; admin, Pending, Inactive and the 2025
    // resignation left out
    expect(res.body.rows.map((row) => row.name)).toEqual([
      "Ana Cruz",
      "Ben Reyes",
      "Carla Santos",
      "Dan Lim",
      "Fay Go",
    ]);

    const [anaRow, benRow, carlaRow, danRow, fayRow] = res.body.rows;
    expect(Object.keys(anaRow).sort()).toEqual(
      [
        "computed",
        "cutoffs",
        "employeeId",
        "employmentType",
        "flags",
        "lastWorkingDay",
        "monthlyBasic",
        "name",
        "projected",
        "startDate",
        "status",
        "total",
        "userId",
      ].sort(),
    );
    expect(anaRow).toMatchObject({
      userId: String(ana.user._id),
      employeeId: "EMP-ana",
      employmentType: "Regular",
      status: "Active",
      startDate: "2023-03-01",
      lastWorkingDay: null,
      monthlyBasic: 25000,
      computed: 20454.55,
      projected: 4545.45,
      total: 25000,
      flags: [],
    });
    expect(anaRow.cutoffs).toHaveLength(25);
    expect(anaRow.cutoffs[0]).toMatchObject({
      amount: 662.88,
      kind: "computed",
    });
    expect(Object.keys(anaRow.cutoffs[21]).sort()).toEqual(
      [
        "amount",
        "cutoff",
        "cutoffWeekdays",
        "end",
        "kind",
        "share",
        "start",
        "weekdays",
        "weekdaysEmployed",
      ].sort(),
    );
    expect(benRow).toMatchObject({
      employmentType: "Probationary",
      total: 2181.82,
    });
    expect(carlaRow).toMatchObject({
      status: "Resigned",
      lastWorkingDay: "2026-12-04",
      total: 27840.91,
      flags: [],
    });
    expect(danRow).toMatchObject({ total: 25000, flags: [] });
    expect(fayRow).toMatchObject({
      monthlyBasic: null,
      computed: null,
      projected: null,
      total: null,
      flags: ["NO_BASIC_PAY"],
    });

    // Ana, Ben, Carla and Dan count; Fay is left out
    expect(Object.keys(res.body.totals).sort()).toEqual(
      ["byCutoff", "computed", "employees", "projected", "total"].sort(),
    );
    expect(res.body.totals).toMatchObject({
      employees: 4,
      computed: 65454.55, // 20,454.55 x 2 + 24,545.45
      projected: 14568.17, // 4,545.45 x 2 + 2,181.82 + 3,295.45
      total: 80022.73, // 25,000 x 2 + 2,181.82 + 27,840.91
    });
    expect(res.body.totals.byCutoff).toHaveLength(25);
    expect(res.body.totals.byCutoff[0]).toBe(2121.21); // 662.88 x 2 + 795.45
    expect(res.body.totals.byCutoff[21]).toBe(3742.43); // 1,041.67 x 2 + 409.09 + 1,250
    expect(res.body.totals.byCutoff[24]).toBe(1030.31); // 378.79 x 2 + 272.73
  });

  it("sorts by Employee ID, Resigned mixed in, numbers as numbers, no ID last", async () => {
    const { token } = await admin();
    const job = { basicPay: 20000, startDate: "2024-01-15" };
    await person("cara", { employeeId: "AC-003", job });
    await person("abel", {
      status: "Resigned",
      employeeId: "AC-001",
      job: { ...job, resignationDate: "2026-06-30" },
    });
    await person("bea", { employeeId: "AC-002", job });
    await person("ten", { employeeId: "ac-010", job });
    await person("zed", { employeeId: "", firstName: "Zed", job });
    await person("amy", { employeeId: "", firstName: "Amy", job });

    const res = await request(app).get(`${BASE}?year=2026`).set(as(token));

    expect(res.status).toBe(200);
    expect(
      res.body.rows.map((row) => [row.employeeId, row.status, row.name]),
    ).toEqual([
      ["AC-001", "Resigned", "Abel Test"],
      ["AC-002", "Active", "Bea Test"],
      ["AC-003", "Active", "Cara Test"],
      ["ac-010", "Active", "Ten Test"],
      ["", "Active", "Amy Test"],
      ["", "Active", "Zed Test"],
    ]);
  });

  it("counts a resigned employee's last cut-off as computed once the last working day has passed (as of Nov 5)", async () => {
    const { token } = await admin();
    manilaToday.mockReturnValue("2026-11-05");
    await person("wew", {
      employeeId: "AC-001",
      job: { basicPay: 20000, startDate: "2025-08-18" },
    });
    await person("ako", {
      employeeId: "AC-002",
      job: { basicPay: 25000, startDate: "2026-09-30" },
    });
    await person("ivers", {
      status: "Resigned",
      employeeId: "AC-003",
      job: {
        basicPay: 18000,
        startDate: "2026-10-01",
        resignationDate: "2026-10-27",
      },
    });

    const res = await request(app).get(`${BASE}?year=2026`).set(as(token));

    expect(res.status).toBe(200);
    const [wewRow, akoRow, iversRow] = res.body.rows;
    // The current cut-off (Oct 26 to Nov 10) is still projected for Active accounts
    expect(wewRow.cutoffs[20].kind).toBe("projected");
    expect(akoRow.cutoffs[20].kind).toBe("projected");
    // ivers left on Oct 27, so that cut-off is final
    expect(iversRow.cutoffs[20]).toMatchObject({ amount: 125, kind: "computed" });
    expect(iversRow).toMatchObject({
      computed: 1400,
      projected: 0,
      total: 1400,
    });
    expect(res.body.totals).toMatchObject({
      employees: 3,
      computed: 19638.64, // 16,363.64 + 1,875 + 1,400
      projected: 8181.81, // 3,636.36 + 4,545.45 + 0
      total: 27820.45,
    });
  });

  it("defaults to the current Manila year", async () => {
    const { token } = await admin();
    manilaToday.mockReturnValue("2027-02-01");

    const res = await request(app).get(BASE).set(as(token));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      year: 2027,
      asOf: "2027-02-01",
      payHistoryStart: "2026-11-04",
      totals: { employees: 0, total: 0 },
    });
    expect(res.body.cutoffs).toHaveLength(25);
    expect(res.body.totals.byCutoff).toHaveLength(25);
  });

  it.each(["2025", "2027", "abc"])("refuses the year %s", async (year) => {
    const { token } = await admin();
    const res = await request(app).get(`${BASE}?year=${year}`).set(as(token));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Year must be from 2026 to 2026.");
  });
});

describe("GET /api/thirteenth-month/:userId", () => {
  it("returns one employee's row", async () => {
    const { token } = await admin();
    const ben = await person("ben", {
      job: { basicPay: 18000, startDate: "2026-11-18" },
    });

    const res = await request(app)
      .get(`${BASE}/${ben.user._id}?year=2026`)
      .set(as(token));

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([...HEADER_KEYS, "row"].sort());
    expect(res.body).toMatchObject({
      year: 2026,
      asOf: "2026-11-04",
      payHistoryStart: "2026-11-04",
      row: { userId: String(ben.user._id), total: 2181.82 },
    });
    expect(res.body.cutoffs).toHaveLength(25);
    expect(res.body.row.cutoffs).toHaveLength(25);
  });

  it("refuses a bad id", async () => {
    const { token } = await admin();
    const res = await request(app).get(`${BASE}/not-an-id`).set(as(token));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid user ID.");
  });

  it("does not find an admin, a Pending account, a missing account or someone not listed", async () => {
    const { user: adminUser, token } = await admin();
    const pending = await longServing("pending", { status: "Pending" });
    const old = await person("old", {
      status: "Resigned",
      job: { basicPay: 1, startDate: "2019-06-03", resignationDate: "2025-12-19" },
    });

    for (const id of [
      adminUser._id,
      pending.user._id,
      old.user._id,
      new mongoose.Types.ObjectId(),
    ]) {
      const res = await request(app).get(`${BASE}/${id}`).set(as(token));
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Employee not found.");
    }
  });
});

describe("Basic pay history (admin edit route)", () => {
  const EDIT = "/api/employee/edit-employee-via-admin";
  const editPay = (token, userId, body) =>
    request(app).put(`${EDIT}/${userId}`).set(as(token)).send(body);
  const history = async (userId) =>
    (await BasicPayChange.find({ userId }).sort({ effectiveFrom: 1 }).lean()).map(
      (change) => ({
        amount: change.amount,
        effectiveFrom: toDateKey(change.effectiveFrom),
      }),
    );
  const eva = () =>
    person("eva", { job: { basicPay: 20000, startDate: "2022-08-01" } });

  it("records the old pay from the day pay history began and the new pay from today on the first change", async () => {
    const { user: adminUser, token } = await admin();
    const { user } = await eva();
    manilaToday.mockReturnValue("2026-11-18");

    const res = await editPay(token, user._id, { basicPay: 22000 });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Employee updated successfully");
    expect(await history(user._id)).toEqual([
      { amount: 20000, effectiveFrom: PAY_HISTORY_START },
      { amount: 22000, effectiveFrom: "2026-11-18" },
    ]);
    const saved = await BasicPayChange.find({ userId: user._id }).lean();
    for (const change of saved) {
      expect(String(change.changedBy)).toBe(String(adminUser._id));
      expect(change.changedAt).toBeInstanceOf(Date);
    }
    const settings = await Settings.findOne({ userId: user._id }).lean();
    expect(settings.general.jobDescription.basicPay).toBe(22000);
  });

  it("records nothing for an unchanged amount, a cleared amount or an edit without pay", async () => {
    const { token } = await admin();
    const { user } = await eva();

    expect((await editPay(token, user._id, { basicPay: "20000" })).status).toBe(
      200,
    );
    expect(
      (await editPay(token, user._id, { designation: "Engineer" })).status,
    ).toBe(200);
    expect((await editPay(token, user._id, { basicPay: "" })).status).toBe(200);

    expect(await BasicPayChange.countDocuments()).toBe(0);
  });

  it("keeps one record a day, the later change winning, and seeds only once", async () => {
    const { token } = await admin();
    const { user } = await eva();
    manilaToday.mockReturnValue("2026-11-18");

    await editPay(token, user._id, { basicPay: 21000 });
    await editPay(token, user._id, { basicPay: 22000 });
    expect(await history(user._id)).toEqual([
      { amount: 20000, effectiveFrom: PAY_HISTORY_START },
      { amount: 22000, effectiveFrom: "2026-11-18" },
    ]);

    manilaToday.mockReturnValue("2026-12-01");
    await editPay(token, user._id, { basicPay: 23000 });
    expect(await history(user._id)).toEqual([
      { amount: 20000, effectiveFrom: PAY_HISTORY_START },
      { amount: 22000, effectiveFrom: "2026-11-18" },
      { amount: 23000, effectiveFrom: "2026-12-01" },
    ]);
  });

  it("refuses an employee token and records nothing", async () => {
    const { user, token } = await eva();

    const res = await editPay(token, user._id, { basicPay: 99999 });

    expect(res.status).toBe(403);
    expect(await BasicPayChange.countDocuments()).toBe(0);
  });

  it("refuses a bad amount and records nothing", async () => {
    const { token } = await admin();
    const { user } = await eva();

    const res = await editPay(token, user._id, { basicPay: -5 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Basic pay must be an amount of 0 or more.");
    expect(await BasicPayChange.countDocuments()).toBe(0);
  });

  it("the 13th month row then uses the pay in force each day", async () => {
    const { token } = await admin();
    const { user } = await eva();
    manilaToday.mockReturnValue("2026-11-18");
    await editPay(token, user._id, { basicPay: 22000 });

    const res = await request(app)
      .get(`${BASE}/${user._id}?year=2026`)
      .set(as(token));

    expect(res.status).toBe(200);
    // Jan 1 to Nov 3 are before the first record: they use its P20,000
    expect(res.body.row.cutoffs[0].amount).toBe(530.3);
    expect(res.body.row.cutoffs.slice(1, 21).map((c) => c.amount)).toEqual(
      Array(20).fill(833.33),
    );
    // Nov 11-25: 5 days at 20,000 and 6 at 22,000 -> (5 x 833.33 + 6 x 916.67) / 11
    expect(res.body.row.cutoffs.slice(21).map((c) => c.amount)).toEqual([
      878.79, 916.67, 916.67, 333.33,
    ]);
    expect(res.body.row).toMatchObject({
      monthlyBasic: 22000,
      total: 20242.42,
      flags: [],
    });
  });
});
