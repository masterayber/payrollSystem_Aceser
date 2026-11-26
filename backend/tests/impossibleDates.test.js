// Impossible days are refused (Friday batch 2026-11-27, Group 2; decision 3). A day such
// as "2026-02-30" used to be accepted and silently saved as March 2. The leave dates
// (utils/leaveCredits.js: checkLeaveDates), the date of regularization
// (utils/jobDetails.js: checkJobDetails) and the last working day (checkResignation) now
// need a real calendar day, each with the message it already used for a bad date.
// Edit Attendance's impossible day is in attendanceDay.test.js (Group 1).
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { checkLeaveDates } = require("../utils/leaveCredits");
const { checkJobDetails, checkResignation } = require("../utils/jobDetails");

const LEAVE_DATE_ERROR = "Enter the start and end dates as valid dates.";
const REGULARIZATION_ERROR = "Date of regularization must be a valid date.";
const LAST_DAY_ERROR = "Enter the last working day as a valid date.";

const IMPOSSIBLE_DAYS = ["2026-02-30", "2026-04-31"];
// A real leap day and an ordinary Monday
const REAL_DAYS = ["2028-02-29", "2026-11-02"];

describe("checkLeaveDates: the leave's start and end", () => {
  it.each(IMPOSSIBLE_DAYS)("refuses %s as the start date", (day) => {
    expect(checkLeaveDates({ startDate: day, endDate: "2028-03-03" })).toEqual({
      error: LEAVE_DATE_ERROR,
    });
  });

  it.each(IMPOSSIBLE_DAYS)("refuses %s as the end date", (day) => {
    expect(checkLeaveDates({ startDate: "2026-01-05", endDate: day })).toEqual({
      error: LEAVE_DATE_ERROR,
    });
  });

  it.each(REAL_DAYS)("accepts %s", (day) => {
    expect(checkLeaveDates({ startDate: day, endDate: day })).toEqual({
      startKey: day,
      endKey: day,
    });
  });

  it("still refuses an end before the start", () => {
    expect(
      checkLeaveDates({ startDate: "2026-11-03", endDate: "2026-11-02" }),
    ).toEqual({ error: "The end date can't be before the start date." });
  });
});

describe("checkJobDetails: the date of regularization", () => {
  it.each(IMPOSSIBLE_DAYS)("refuses %s", (day) => {
    expect(checkJobDetails({ regularizationDate: day })).toEqual({
      error: REGULARIZATION_ERROR,
    });
  });

  it.each(REAL_DAYS)("accepts %s", (day) => {
    expect(checkJobDetails({ regularizationDate: day })).toEqual({
      fields: { regularizationDate: day },
    });
  });
});

describe("checkResignation: the last working day", () => {
  it.each(IMPOSSIBLE_DAYS)("refuses %s", (day) => {
    expect(checkResignation({ resignationDate: day })).toEqual({
      error: LAST_DAY_ERROR,
    });
  });

  it.each(REAL_DAYS)("accepts %s", (day) => {
    expect(
      checkResignation({ resignationDate: day, resignationReason: " Moving " }),
    ).toEqual({ fields: { resignationDate: day, resignationReason: "Moving" } });
  });
});

describe("POST /api/filing/apply-leave with an impossible day", () => {
  const app = require("../app");
  const User = require("../models/authUsers");
  const Settings = require("../models/settings");
  const LeaveApplication = require("../models/leaveApplication");

  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Settings.deleteMany({});
    await LeaveApplication.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  const signIn = async () => {
    const user = await User.create({
      username: "ana",
      password: "Password123!",
      email: "ana@example.com",
      role: "Employee",
      status: "Active",
    });
    await Settings.create({
      userId: user._id,
      general: {
        jobDescription: {
          employmentType: "Regular",
          startDate: new Date("2025-07-01"),
          regularizationDate: new Date("2026-01-05"),
        },
      },
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "ana", password: "Password123!" });
    expect(res.status).toBe(200);
    return res.body.token;
  };

  const apply = (token, startDate, endDate) =>
    request(app)
      .post("/api/filing/apply-leave")
      .set("Authorization", `Bearer ${token}`)
      .send({
        leaveType: "Vacation Leave",
        leaveDetails: "Family trip",
        startDate,
        endDate,
      });

  it("answers 400 with the bad-date message and saves nothing", async () => {
    const token = await signIn();

    const res = await apply(token, "2026-02-30", "2026-03-03");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: LEAVE_DATE_ERROR });
    expect(await LeaveApplication.countDocuments({})).toBe(0);
  });

  it("still files a leave on real days", async () => {
    const token = await signIn();

    const res = await apply(token, "2026-03-02", "2026-03-03");

    expect(res.status).toBe(201);
    expect(await LeaveApplication.countDocuments({})).toBe(1);
  });
});
