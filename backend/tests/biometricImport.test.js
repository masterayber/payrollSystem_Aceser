// The import from the biometric device (POST /api/attendance/import-biometric): each
// punch lands on the employee's own attendance day, linked to the employee's sign-in
// account (as every other attendance writer links it), one row per person per day,
// with the device's clock time whatever the time zone of the machine running the API.
jest.mock("../utils/nodemailer", () => jest.fn().mockResolvedValue());

// There is no biometric device in a test: this one connects and hands over the
// punches a test sets, in the shape the route reads today (userId, timestamp, time)
let mockPunches = [];
jest.mock(
  "../utils/zktecoService",
  () =>
    class {
      async connect() {
        return true;
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
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const Attendance = require("../models/attendance");
const ActivityLog = require("../models/activityLog");

let mongo;
let boss;
let carlo;

const tokenFor = (user) =>
  jwt.sign(
    { userId: String(user._id), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

// An account, signed in (insertMany skips the password hashing: nobody signs in here)
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

// An Employee record; with `withAccount` false it has no sign-in account
const employee = async (
  username,
  firstName,
  employeeId,
  { withAccount = true } = {},
) => {
  const person = withAccount
    ? await account({ username, role: "Employee" })
    : null;
  await Employee.create({
    userId: person ? person.user._id : null,
    firstName,
    lastName: "Mercado",
    employeeId,
    email: `${username}@example.com`,
    role: "Employee",
  });
  return person;
};

const importFromDevice = () =>
  request(app)
    .post("/api/attendance/import-biometric")
    .set("Authorization", `Bearer ${boss.token}`)
    .send({ deviceIp: "10.0.0.5" });

const myAttendance = (person) =>
  request(app)
    .get(`/api/attendance/${person.id}`)
    .set("Authorization", `Bearer ${person.token}`);

const punch = (userId, time, date = "2026-11-12") => ({
  userId,
  timestamp: `${date}T${time}Z`,
  time,
});

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

beforeEach(async () => {
  mockPunches = [];
  boss = await account({ username: "admin", role: "Super Admin" });
  carlo = await employee("carlo", "Carlo", "AC-012");
});

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all(
    [User, Employee, Settings, Attendance, ActivityLog].map((Model) =>
      Model.deleteMany({}),
    ),
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("Importing from the biometric device", () => {
  it("links the punch to the employee's sign-in account, and the employee sees the day", async () => {
    mockPunches = [punch("AC-012", "08:00:00")];

    const res = await importFromDevice();
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);

    const rows = await Attendance.find().lean();
    expect(rows).toHaveLength(1);
    expect(String(rows[0].userId)).toBe(carlo.id);

    const mine = await myAttendance(carlo);
    expect(mine.status).toBe(200);
    expect(mine.body.total).toBe(1);
    expect(mine.body.data[0].date).toBe("2026-11-12T00:00:00.000Z");
    expect(mine.body.data[0].timeIn).toBe("08:00:00");
  });

  it("two punches the same day make one row with a time in and a time out", async () => {
    mockPunches = [punch("AC-012", "08:00:00"), punch("AC-012", "17:30:00")];

    const res = await importFromDevice();
    expect(res.status).toBe(200);
    expect(res.body.errors).toEqual([]);

    const mine = await myAttendance(carlo);
    expect(mine.body.total).toBe(1);
    expect(mine.body.data[0].timeIn).toBe("08:00:00");
    expect(mine.body.data[0].timeOut).toBe("17:30:00");
    expect(await Attendance.countDocuments()).toBe(1);
  });

  it("the same import run twice still leaves one row per day, with the same times", async () => {
    // One day with a single punch, one day with two
    mockPunches = [
      punch("AC-012", "08:00:00", "2026-11-12"),
      punch("AC-012", "08:10:00", "2026-11-13"),
      punch("AC-012", "17:30:00", "2026-11-13"),
    ];

    await importFromDevice();
    const again = await importFromDevice();
    expect(again.status).toBe(200);

    const mine = await myAttendance(carlo);
    expect(mine.body.total).toBe(2);
    const [thirteenth, twelfth] = mine.body.data;
    expect(twelfth.date).toBe("2026-11-12T00:00:00.000Z");
    expect(twelfth.timeIn).toBe("08:00:00");
    expect(twelfth.timeOut).toBeNull();
    expect(thirteenth.date).toBe("2026-11-13T00:00:00.000Z");
    expect(thirteenth.timeIn).toBe("08:10:00");
    expect(thirteenth.timeOut).toBe("17:30:00");
    expect(await Attendance.countDocuments()).toBe(2);
  });

  it("a device id with no employee is listed under errors and nothing is saved for it", async () => {
    mockPunches = [punch("AC-404", "08:05:00")];

    const res = await importFromDevice();
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(0);
    expect(res.body.errors).toEqual([
      { zkUserId: "AC-404", reason: "Employee not found" },
    ]);
    expect(await Attendance.countDocuments()).toBe(0);
  });

  it("an employee with no sign-in account is listed under errors; no row is saved without an account", async () => {
    await employee("nina", "Nina", "AC-020", { withAccount: false });
    mockPunches = [punch("AC-020", "08:00:00"), punch("AC-012", "08:00:00")];

    const res = await importFromDevice();
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);
    expect(res.body.errors).toEqual([
      { zkUserId: "AC-020", reason: "No sign-in account" },
    ]);

    const rows = await Attendance.find().lean();
    expect(rows).toHaveLength(1);
    expect(String(rows[0].userId)).toBe(carlo.id);
    expect(await Attendance.countDocuments({ userId: null })).toBe(0);
  });

  describe.each(["Asia/Manila", "UTC"])(
    "with the API's machine on %s time",
    (zone) => {
      let savedZone;
      beforeEach(() => {
        savedZone = process.env.TZ;
        process.env.TZ = zone;
      });
      afterEach(() => {
        if (savedZone === undefined) delete process.env.TZ;
        else process.env.TZ = savedZone;
      });

      it("the time read back is the device's clock time", async () => {
        mockPunches = [
          punch("AC-012", "08:00:00"),
          punch("AC-012", "17:30:00"),
        ];

        await importFromDevice();

    const mine = await myAttendance(carlo);
        expect(mine.body.data[0].timeIn).toBe("08:00:00");
        expect(mine.body.data[0].timeOut).toBe("17:30:00");
        const [row] = await Attendance.find().lean();
        expect(row.timeIn.toISOString()).toBe("2026-11-12T08:00:00.000Z");
        expect(row.timeOut.toISOString()).toBe("2026-11-12T17:30:00.000Z");
      });
    },
  );
});

// Found on the way: the save hook writes "No Time Out" (a past day with only a time
// in) and "Weekend" (a blank Saturday or Sunday), which the model refused, so such a
// row saved once could never be saved again (a second punch, or Edit Attendance)
describe("A saved attendance row can be saved again", () => {
  it.each([
    ["a past day with only a time in", "2026-11-12", "No Time Out"],
    ["a blank Saturday", "2026-11-14", "Weekend"],
  ])("%s", async (_, date, behavior) => {
    const userId = new mongoose.Types.ObjectId();
    const timeIn =
      behavior === "No Time Out" ? new Date(`${date}T08:00:00Z`) : undefined;
    await new Attendance({ userId, date, timeIn }).save();

    const row = await Attendance.findOne({ userId });
    expect(row.behavior).toBe(behavior);
    row.timeIn = new Date(`${date}T08:00:00Z`);
    row.timeOut = new Date(`${date}T17:30:00Z`);
    await expect(row.save()).resolves.toBeTruthy();
  });
});
