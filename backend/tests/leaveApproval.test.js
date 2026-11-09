// Approving a leave writes an On-Leave attendance row for each of its days, for every
// leave type an employee can file, not only VL and SL.
jest.mock("../utils/nodemailer", () => jest.fn().mockResolvedValue());

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Settings = require("../models/settings");
const Attendance = require("../models/attendance");
const LeaveApplication = require("../models/leaveApplication");

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

// The leave types in the employee's leave form, plus one the form doesn't list: the
// leave application model takes any text
const LEAVE_TYPES = [
  "Vacation Leave",
  "Sick Leave",
  "Maternity Leave",
  "Paternity Leave",
  "Solo Parent Leave",
  "Study Leave",
  "10-Day VAWC Leave",
  "Special Leave Benefits for Women",
  "Adoption Leave",
  "Leave Without Pay (LWOP)",
  "Emergency Leave",
];

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

// A regularized employee (so VL and SL have credits) and an admin
const setup = async () => {
  const employeeUser = await createUser();
  await Settings.create({
    userId: employeeUser._id,
    general: {
      jobDescription: {
        startDate: new Date("2025-07-01"),
        regularizationDate: new Date("2026-01-05"),
      },
    },
  });
  await createUser({
    username: "admin1",
    email: "admin1@example.com",
    role: "Super Admin",
  });
  return { employeeUser, adminToken: await loginAs("admin1") };
};

const fileLeave = (userId, leaveType) =>
  LeaveApplication.create({
    userId,
    leaveType,
    leaveDetails: "Personal",
    startDate: "2026-11-02",
    endDate: "2026-11-03",
  });

const decide = (adminToken, id, status) =>
  request(app)
    .patch(`/api/filing/leave/${id}/status`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ status });

const attendanceByDay = async (userId) => {
  const rows = await Attendance.find({ userId }).lean();
  return Object.fromEntries(
    rows.map((row) => [row.date.toISOString().slice(0, 10), row]),
  );
};

describe("Approving a leave (PATCH /api/filing/leave/:id/status)", () => {
  it.each(LEAVE_TYPES)(
    "approves %s and marks each of its days On-Leave with that type",
    async (leaveType) => {
      const { employeeUser, adminToken } = await setup();
      // Nov 3 already has a row (the employee was marked absent); Nov 2 has none
      await Attendance.create({
        userId: employeeUser._id,
        date: "2026-11-03",
        behavior: "Absent",
      });
      const leave = await fileLeave(employeeUser._id, leaveType);

      const res = await decide(adminToken, leave._id, "Approved");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("Approved");
      expect((await LeaveApplication.findById(leave._id)).status).toBe(
        "Approved",
      );

      const days = await attendanceByDay(employeeUser._id);
      expect(Object.keys(days).sort()).toEqual(["2026-11-02", "2026-11-03"]);
      for (const day of Object.values(days)) {
        expect(day).toMatchObject({ behavior: "On-Leave", leaveType });
      }
    },
  );

  describe("when the attendance can't be written", () => {
    afterEach(() => jest.restoreAllMocks());

    const LWOP = "Leave Without Pay (LWOP)";
    const FAILED =
      "The leave couldn't be approved because its attendance days couldn't be updated. It is still pending; please try again.";

    // Nov 2 has no row; Nov 3 and Nov 4 were marked absent
    const setupRange = async () => {
      const { employeeUser, adminToken } = await setup();
      for (const date of ["2026-11-03", "2026-11-04"]) {
        await Attendance.create({
          userId: employeeUser._id,
          date,
          behavior: "Absent",
        });
      }
      const leave = await LeaveApplication.create({
        userId: employeeUser._id,
        leaveType: LWOP,
        leaveDetails: "Personal",
        startDate: "2026-11-02",
        endDate: "2026-11-04",
      });
      const before = await Attendance.find({ userId: employeeUser._id })
        .sort({ date: 1 })
        .lean();
      return { employeeUser, adminToken, leave, before };
    };

    const expectUntouched = async ({ employeeUser, leave, before }) => {
      expect((await LeaveApplication.findById(leave._id)).status).toBe(
        "Pending",
      );
      const after = await Attendance.find({ userId: employeeUser._id })
        .sort({ date: 1 })
        .lean();
      expect(after).toEqual(before);
    };

    const expectApprovedOnRetry = async ({ employeeUser, adminToken, leave }) => {
      const retry = await decide(adminToken, leave._id, "Approved");
      expect(retry.status).toBe(200);
      const days = await attendanceByDay(employeeUser._id);
      expect(Object.keys(days).sort()).toEqual([
        "2026-11-02",
        "2026-11-03",
        "2026-11-04",
      ]);
      for (const day of Object.values(days)) {
        expect(day).toMatchObject({ behavior: "On-Leave", leaveType: LWOP });
      }
    };

    it("keeps the leave Pending and writes nothing when the new rows fail", async () => {
      const state = await setupRange();
      jest
        .spyOn(Attendance, "insertMany")
        .mockRejectedValueOnce(new Error("insert failed"));

      const res = await decide(state.adminToken, state.leave._id, "Approved");

      expect(res.status).toBe(500);
      expect(res.body.error).toBe(FAILED);
      await expectUntouched(state);
      await expectApprovedOnRetry(state);
    });

    it("removes the new rows and puts back the changed ones when a later row fails", async () => {
      const state = await setupRange();
      const realUpdate = Attendance.findOneAndUpdate.bind(Attendance);
      // Nov 2 is inserted and Nov 3 overwritten before Nov 4 fails
      jest
        .spyOn(Attendance, "findOneAndUpdate")
        .mockImplementationOnce(realUpdate)
        .mockImplementationOnce(() =>
          Promise.reject(new Error("update failed")),
        );

      const res = await decide(state.adminToken, state.leave._id, "Approved");

      expect(res.status).toBe(500);
      expect(res.body.error).toBe(FAILED);
      await expectUntouched(state);
      await expectApprovedOnRetry(state);
    });
  });

  it("disapproves a Leave Without Pay request and writes no attendance", async () => {
    const { employeeUser, adminToken } = await setup();
    const leave = await fileLeave(employeeUser._id, "Leave Without Pay (LWOP)");

    const res = await decide(adminToken, leave._id, "Disapproved");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Disapproved");
    expect(await Attendance.countDocuments({ userId: employeeUser._id })).toBe(
      0,
    );
  });
});
