// The shared leave-type list (backend/config/leaveTypes.js and its frontend copy), and the
// two rules the server applies when a leave is filed or edited: the type must be on the
// list, and the dates need a Monday-to-Friday day whatever the type.
import * as frontendList from "../../frontend/src/utils/leaveTypes";
import * as frontendCredits from "../../frontend/src/utils/leaveCredits";

jest.mock("../utils/nodemailer", () => jest.fn().mockResolvedValue());

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Settings = require("../models/settings");
const Attendance = require("../models/attendance");
const LeaveApplication = require("../models/leaveApplication");
const backendList = require("../config/leaveTypes");
const {
  CREDIT_LEAVE_TYPES: backendCreditTypes,
} = require("../utils/leaveCredits");

// name, code, usesCredits, paid: in the order the Leave form lists them
const EXPECTED = [
  ["Vacation Leave", "VL", true, true],
  ["Sick Leave", "SL", true, true],
  ["Maternity Leave", "ML", false, true],
  ["Paternity Leave", "PL", false, true],
  ["Solo Parent Leave", "SPL", false, true],
  ["Study Leave", "STL", false, true],
  ["10-Day VAWC Leave", "VAWC", false, true],
  ["Special Leave Benefits for Women", "SLW", false, true],
  ["Adoption Leave", "AL", false, true],
  ["Leave Without Pay (LWOP)", "LWOP", false, false],
];
const EXPECTED_NAMES = EXPECTED.map(([name]) => name);

// Not on the list: each is refused by isLeaveType and by the two routes
const OFF_LIST = [
  ["a type that isn't on the list", "Emergency Leave"],
  ["an empty type", ""],
  ["a name in the wrong case", "vacation leave"],
  ["a name with spaces around it", " Vacation Leave "],
  ["a code instead of the name", "VL"],
  ["null", null],
  ["a list holding a name", ["Vacation Leave"]],
  ["a number", 1],
];

// One table of cases for both copies of the list, so they can't drift apart
describe.each([
  ["frontend", frontendList],
  ["backend", backendList],
])("%s leave-type list", (copy, list) => {
  const { LEAVE_TYPES, LEAVE_TYPE_NAMES, CREDIT_LEAVE_TYPES, isLeaveType } =
    list;

  it("holds the ten types in the order of the Leave form, with nothing else", () => {
    expect(LEAVE_TYPES).toStrictEqual(
      EXPECTED.map(([name, code, usesCredits, paid]) => ({
        name,
        code,
        usesCredits,
        paid,
      })),
    );
  });

  it.each(EXPECTED)(
    "%s has the code %s, uses credits: %s, paid: %s",
    (name, code, usesCredits, paid) => {
      expect(LEAVE_TYPES.filter((type) => type.name === name)).toStrictEqual([
        { name, code, usesCredits, paid },
      ]);
    },
  );

  it("gives each type its own code", () => {
    const codes = LEAVE_TYPES.map(({ code }) => code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("lists the ten names in order as LEAVE_TYPE_NAMES", () => {
    expect(LEAVE_TYPE_NAMES).toStrictEqual(EXPECTED_NAMES);
  });

  it("keeps CREDIT_LEAVE_TYPES as Vacation Leave and Sick Leave", () => {
    expect(CREDIT_LEAVE_TYPES).toStrictEqual(["Vacation Leave", "Sick Leave"]);
  });

  it.each(EXPECTED_NAMES)("isLeaveType is true for %s", (name) => {
    expect(isLeaveType(name)).toBe(true);
  });

  it.each([...OFF_LIST, ["undefined", undefined]])(
    "isLeaveType is false for %s",
    (label, value) => {
      expect(isLeaveType(value)).toBe(false);
    },
  );
});

describe("the two copies of the leave-type list", () => {
  it("are the same", () => {
    expect(frontendList.LEAVE_TYPES).toStrictEqual(backendList.LEAVE_TYPES);
    expect(frontendList.LEAVE_TYPE_NAMES).toStrictEqual(
      backendList.LEAVE_TYPE_NAMES,
    );
    expect(frontendList.CREDIT_LEAVE_TYPES).toStrictEqual(
      backendList.CREDIT_LEAVE_TYPES,
    );
  });

  it("export the same names", () => {
    expect(Object.keys(frontendList).sort()).toEqual(
      Object.keys(backendList).sort(),
    );
  });

  it("leave CREDIT_LEAVE_TYPES unchanged where the credit helpers export it", () => {
    expect(backendCreditTypes).toStrictEqual(["Vacation Leave", "Sick Leave"]);
    expect(frontendCredits.CREDIT_LEAVE_TYPES).toStrictEqual([
      "Vacation Leave",
      "Sick Leave",
    ]);
  });
});

describe("Filing a leave: the type list and the working-days rule", () => {
  const UNKNOWN_TYPE = "Choose a leave type from the list.";
  const NO_WORKING_DAYS = "This leave has no working days (Monday to Friday).";
  const LWOP = "Leave Without Pay (LWOP)";
  // Saturday and Sunday
  const WEEKEND = { startDate: "2026-11-14", endDate: "2026-11-15" };
  // Friday to Monday
  const OVER_WEEKEND = { startDate: "2026-11-13", endDate: "2026-11-16" };
  // Monday and Tuesday
  const WEEKDAYS = { startDate: "2026-11-16", endDate: "2026-11-17" };

  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Settings.deleteMany({});
    await Attendance.deleteMany({});
    await LeaveApplication.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  const createUser = (overrides = {}) =>
    User.create({
      username: "employee1",
      password: "Password123!",
      email: "employee1@example.com",
      role: "Employee",
      status: "Active",
      ...overrides,
    });

  const loginAs = async (username) => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username, password: "Password123!" });
    return res.body.token;
  };

  // A regularized employee: 15 VL for 2026 and 15 SL each month
  const setup = async ({
    regularizationDate = "2026-01-05",
    ...userOverrides
  } = {}) => {
    const employeeUser = await createUser(userOverrides);
    await Settings.create({
      userId: employeeUser._id,
      general: {
        jobDescription: {
          startDate: new Date("2025-07-01"),
          regularizationDate:
            regularizationDate && new Date(regularizationDate),
        },
      },
    });
    return { employeeUser, token: await loginAs("employee1") };
  };

  const apply = (token, body) =>
    request(app)
      .post("/api/filing/apply-leave")
      .set("Authorization", `Bearer ${token}`)
      .send({ leaveDetails: "Personal", ...body });

  const edit = (token, id, body) =>
    request(app)
      .patch(`/api/filing/edit-leave/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  // Saved straight to the model, as a request filed before the list was (any text)
  const saveLeave = (userId, overrides = {}) =>
    LeaveApplication.create({
      userId,
      leaveType: "Maternity Leave",
      leaveDetails: "Personal",
      ...WEEKDAYS,
      ...overrides,
    });

  // A saved leave as plain values, to show a refused edit changed nothing
  const snapshot = async (id) => {
    const leave = await LeaveApplication.findById(id).lean();
    return {
      leaveType: leave.leaveType,
      leaveDetails: leave.leaveDetails,
      startDate: leave.startDate.toISOString().slice(0, 10),
      endDate: leave.endDate.toISOString().slice(0, 10),
      status: leave.status,
    };
  };

  const expectRefused = (res, message) => {
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: message });
  };

  describe("POST /api/filing/apply-leave", () => {
    it("accepts every type on the list", async () => {
      const { employeeUser, token } = await setup();

      for (const leaveType of EXPECTED_NAMES) {
        const res = await apply(token, { leaveType, ...WEEKDAYS });
        expect([leaveType, res.status]).toEqual([leaveType, 201]);
        expect(res.body.leaveType).toBe(leaveType);
      }

      const saved = await LeaveApplication.find({ userId: employeeUser._id });
      expect(saved.map((leave) => leave.leaveType).sort()).toEqual(
        [...EXPECTED_NAMES].sort(),
      );
    });

    it.each(OFF_LIST)(
      "refuses %s and saves nothing",
      async (label, leaveType) => {
        const { token } = await setup();

        const res = await apply(token, { leaveType, ...WEEKDAYS });

        expectRefused(res, UNKNOWN_TYPE);
        expect(await LeaveApplication.countDocuments()).toBe(0);
      },
    );

    it("refuses a request with no type the same way", async () => {
      const { token } = await setup();

      const res = await apply(token, WEEKDAYS);

      expectRefused(res, UNKNOWN_TYPE);
      expect(await LeaveApplication.countDocuments()).toBe(0);
    });

    it.each(["Maternity Leave", LWOP, "Vacation Leave", "Sick Leave"])(
      "refuses %s over a Saturday and Sunday only",
      async (leaveType) => {
        const { token } = await setup();

        const res = await apply(token, { leaveType, ...WEEKEND });

        expectRefused(res, NO_WORKING_DAYS);
        expect(await LeaveApplication.countDocuments()).toBe(0);
      },
    );

    it("refuses a single Saturday, and accepts a Sunday-to-Monday leave", async () => {
      const { token } = await setup();

      const saturday = await apply(token, {
        leaveType: "Study Leave",
        startDate: "2026-11-14",
        endDate: "2026-11-14",
      });
      expectRefused(saturday, NO_WORKING_DAYS);

      const withMonday = await apply(token, {
        leaveType: "Study Leave",
        startDate: "2026-11-15",
        endDate: "2026-11-16",
      });
      expect(withMonday.status).toBe(201);
      expect(await LeaveApplication.countDocuments()).toBe(1);
    });

    it("checks the dates first, then the type, then the working days, then the credits", async () => {
      // Not regularized: VL has no credits
      const { token } = await setup({ regularizationDate: null });

      const badDates = await apply(token, {
        leaveType: "Emergency Leave",
        startDate: "2026-11-15",
        endDate: "2026-11-14",
      });
      expectRefused(badDates, "The end date can't be before the start date.");

      const badType = await apply(token, {
        leaveType: "Emergency Leave",
        ...WEEKEND,
      });
      expectRefused(badType, UNKNOWN_TYPE);

      const noDays = await apply(token, {
        leaveType: "Vacation Leave",
        ...WEEKEND,
      });
      expectRefused(noDays, NO_WORKING_DAYS);

      const noCredits = await apply(token, {
        leaveType: "Vacation Leave",
        ...WEEKDAYS,
      });
      expect(noCredits.status).toBe(400);
      expect(noCredits.body.error).toMatch(/date of regularization/);

      expect(await LeaveApplication.countDocuments()).toBe(0);
    });
  });

  describe("PATCH /api/filing/edit-leave/:id", () => {
    it.each(OFF_LIST)(
      "refuses a change to %s and leaves the request as it was",
      async (label, leaveType) => {
        const { employeeUser, token } = await setup();
        const leave = await saveLeave(employeeUser._id);
        const before = await snapshot(leave._id);

        const res = await edit(token, leave._id, {
          leaveType,
          leaveDetails: "Changed",
        });

        expectRefused(res, UNKNOWN_TYPE);
        expect(await snapshot(leave._id)).toEqual(before);
      },
    );

    it("saves a change to another type on the list", async () => {
      const { employeeUser, token } = await setup();
      const leave = await saveLeave(employeeUser._id);

      const res = await edit(token, leave._id, { leaveType: LWOP });

      expect(res.status).toBe(200);
      expect(res.body.leaveType).toBe(LWOP);
      expect((await snapshot(leave._id)).leaveType).toBe(LWOP);
    });

    it.each(["Maternity Leave", LWOP, "Vacation Leave"])(
      "refuses new dates with no working day for %s and leaves the request as it was",
      async (leaveType) => {
        const { employeeUser, token } = await setup();
        const leave = await saveLeave(employeeUser._id, { leaveType });
        const before = await snapshot(leave._id);

        const res = await edit(token, leave._id, WEEKEND);

        expectRefused(res, NO_WORKING_DAYS);
        expect(await snapshot(leave._id)).toEqual(before);
      },
    );

    it("uses the dates that will be saved: one new date together with the saved one", async () => {
      const { employeeUser, token } = await setup();
      // Saturday Nov 14 to Monday Nov 16
      const leave = await saveLeave(employeeUser._id, {
        startDate: "2026-11-14",
        endDate: "2026-11-16",
      });

      // Ending on the Sunday leaves no working day
      const res = await edit(token, leave._id, { endDate: "2026-11-15" });
      expectRefused(res, NO_WORKING_DAYS);

      // Starting on the Friday instead keeps two
      const moved = await edit(token, leave._id, { startDate: "2026-11-13" });
      expect(moved.status).toBe(200);
      expect(await snapshot(leave._id)).toMatchObject(OVER_WEEKEND);
    });

    it("checks the type before the working days", async () => {
      const { employeeUser, token } = await setup();
      const leave = await saveLeave(employeeUser._id);

      const res = await edit(token, leave._id, {
        leaveType: "Emergency Leave",
        ...WEEKEND,
      });

      expectRefused(res, UNKNOWN_TYPE);
    });

    describe("a request saved with a type that isn't on the list", () => {
      it("can still have its details and its dates changed", async () => {
        const { employeeUser, token } = await setup();
        const leave = await saveLeave(employeeUser._id, {
          leaveType: "Emergency Leave",
        });

        const details = await edit(token, leave._id, {
          leaveDetails: "Changed",
        });
        expect(details.status).toBe(200);

        const dates = await edit(token, leave._id, OVER_WEEKEND);
        expect(dates.status).toBe(200);

        expect(await snapshot(leave._id)).toEqual({
          leaveType: "Emergency Leave",
          leaveDetails: "Changed",
          ...OVER_WEEKEND,
          status: "Pending",
        });
      });

      it("is refused when the edit sends that type again, or dates with no working day", async () => {
        const { employeeUser, token } = await setup();
        const leave = await saveLeave(employeeUser._id, {
          leaveType: "Emergency Leave",
        });
        const before = await snapshot(leave._id);

        const sameType = await edit(token, leave._id, {
          leaveType: "Emergency Leave",
          ...OVER_WEEKEND,
        });
        expectRefused(sameType, UNKNOWN_TYPE);

        const weekend = await edit(token, leave._id, WEEKEND);
        expectRefused(weekend, NO_WORKING_DAYS);

        expect(await snapshot(leave._id)).toEqual(before);
      });
    });

    it("runs no new check when only the details are sent", async () => {
      const { employeeUser, token } = await setup();
      // Saved before the working-days rule covered every type
      const leave = await saveLeave(employeeUser._id, WEEKEND);

      const res = await edit(token, leave._id, { leaveDetails: "Changed" });

      expect(res.status).toBe(200);
      expect(await snapshot(leave._id)).toMatchObject({
        leaveDetails: "Changed",
        ...WEEKEND,
      });
    });

    it("still answers 404 for someone else's request and 409 for a decided one", async () => {
      const { employeeUser, token } = await setup();
      const other = await createUser({
        username: "employee2",
        email: "employee2@example.com",
      });
      const theirs = await saveLeave(other._id);
      const decided = await saveLeave(employeeUser._id, { status: "Approved" });
      const body = { leaveType: "Emergency Leave", ...WEEKEND };

      const notMine = await edit(token, theirs._id, body);
      expect(notMine.status).toBe(404);
      expect(notMine.body.error).toBe("Leave request not found.");

      const tooLate = await edit(token, decided._id, body);
      expect(tooLate.status).toBe(409);

      expect(await snapshot(theirs._id)).toMatchObject({
        leaveType: "Maternity Leave",
        ...WEEKDAYS,
      });
      expect(await snapshot(decided._id)).toMatchObject({
        leaveType: "Maternity Leave",
        ...WEEKDAYS,
      });
    });
  });

  describe("who may file", () => {
    it("refuses an employee without the Filing page, on apply and on edit", async () => {
      const { employeeUser, token } = await setup({
        pageAccess: ["dashboard"],
      });
      const leave = await saveLeave(employeeUser._id);
      const before = await snapshot(leave._id);

      const applied = await apply(token, { leaveType: LWOP, ...WEEKDAYS });
      expect(applied.status).toBe(403);
      expect(applied.body.code).toBe("PAGE_ACCESS_DENIED");

      const edited = await edit(token, leave._id, { leaveType: LWOP });
      expect(edited.status).toBe(403);
      expect(edited.body.code).toBe("PAGE_ACCESS_DENIED");

      expect(await LeaveApplication.countDocuments()).toBe(1);
      expect(await snapshot(leave._id)).toEqual(before);
    });

    it("refuses a request without a sign-in token", async () => {
      const res = await request(app)
        .post("/api/filing/apply-leave")
        .send({ leaveType: LWOP, leaveDetails: "Personal", ...WEEKDAYS });

      expect(res.status).toBe(401);
      expect(await LeaveApplication.countDocuments()).toBe(0);
    });
  });

  describe("approval is unchanged", () => {
    it("writes an On-Leave row for each day of a Friday-to-Monday leave, weekend included", async () => {
      const { employeeUser, token } = await setup();
      await createUser({
        username: "admin1",
        email: "admin1@example.com",
        role: "Super Admin",
      });
      const adminToken = await loginAs("admin1");

      const filed = await apply(token, { leaveType: LWOP, ...OVER_WEEKEND });
      expect(filed.status).toBe(201);

      const res = await request(app)
        .patch(`/api/filing/leave/${filed.body._id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "Approved" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("Approved");

      const rows = await Attendance.find({ userId: employeeUser._id })
        .sort({ date: 1 })
        .lean();
      expect(
        rows.map((row) => [
          row.date.toISOString().slice(0, 10),
          row.behavior,
          row.leaveType,
        ]),
      ).toEqual([
        ["2026-11-13", "On-Leave", LWOP],
        ["2026-11-14", "On-Leave", LWOP],
        ["2026-11-15", "On-Leave", LWOP],
        ["2026-11-16", "On-Leave", LWOP],
      ]);
    });
  });
});
