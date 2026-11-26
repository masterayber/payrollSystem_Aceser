// Attendance days and replies (Friday batch, Group 1 Part B), in routes/attendance.js:
// - "today" is the Manila day, for the blank day (POST /create-blank.today) and "my
//   attendance today" (GET /:userId/today); before 8 AM Manila, UTC is still on the
//   day before
// - Edit Attendance (PUT /edit-attendance/:id) refuses a day that isn't on the calendar
//   ("2026-02-30" used to be filed under March 2) and saves nothing
// - A server error answers with fixed text only; the raw detail goes to the server log
jest.mock("../utils/nodemailer", () => jest.fn().mockResolvedValue());

// There is no biometric device in a test: this one connects and hands over the punches
// a test sets
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

const RAW_DETAIL = "raw-database-detail-xyz";
const BAD_DATE = "A valid date (YYYY-MM-DD) is required";

let mongo;
let boss;
let carlo;
let savedCallbackSecret;

// Signed when the request is sent, so a test that sets the clock first gets a token
// from the same clock the token check reads
const tokenFor = (user) =>
  jwt.sign(
    { userId: String(user._id), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

const as = (person) => ({ Authorization: `Bearer ${tokenFor(person.user)}` });

// An account (insertMany skips the password hashing: nobody signs in here)
const account = async (fields) => {
  const [user] = await User.insertMany([
    {
      password: "not-used-to-sign-in",
      email: `${fields.username}@example.com`,
      status: "Active",
      ...fields,
    },
  ]);
  return { user, id: String(user._id) };
};

// An Employee record with its sign-in account
const employee = async (username, firstName, employeeId) => {
  const person = await account({ username, role: "Employee" });
  await Employee.create({
    userId: person.user._id,
    firstName,
    lastName: "Mercado",
    employeeId,
    email: `${username}@example.com`,
    role: "Employee",
  });
  return person;
};

// Sets the API's clock (manilaToday and the token check both read Date.now)
const setClock = (iso) =>
  jest.spyOn(Date, "now").mockReturnValue(new Date(iso).getTime());

const blankDay = (person = boss) =>
  request(app).post("/api/attendance/create-blank.today").set(as(person));

const myToday = (person) =>
  request(app).get(`/api/attendance/${person.id}/today`).set(as(person));

const editAttendance = (body, person = boss, target = carlo) =>
  request(app)
    .put(`/api/attendance/edit-attendance/${target.id}`)
    .set(as(person))
    .send(body);

// Makes `target[method]` throw a database-style error carrying RAW_DETAIL. A throw (not
// a rejected promise) works whatever the route chains after the call.
const breakCall = (target, method) =>
  jest.spyOn(target, method).mockImplementation(() => {
    throw new Error(RAW_DETAIL);
  });

const quietLog = () =>
  jest.spyOn(console, "error").mockImplementation(() => {});

const loggedRawDetail = (logSpy) =>
  logSpy.mock.calls.some((args) =>
    args.some((arg) => String(arg?.message ?? arg).includes(RAW_DETAIL)),
  );

const expectPlainServerError = (res, body, logSpy) => {
  expect(res.status).toBe(500);
  expect(res.body).toEqual(body);
  expect(res.body).not.toHaveProperty("error");
  expect(JSON.stringify(res.body)).not.toContain(RAW_DETAIL);
  // Logged on the server instead
  expect(loggedRawDetail(logSpy)).toBe(true);
};

const dayKeys = async () =>
  (await Attendance.find().lean()).map((row) =>
    row.date.toISOString().slice(0, 10),
  );

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  savedCallbackSecret = process.env.ZKTECO_CALLBACK_SECRET;
});

beforeEach(async () => {
  mockPunches = [];
  boss = await account({ username: "admin", role: "Super Admin" });
  carlo = await employee("carlo", "Carlo", "AC-012");
});

afterEach(async () => {
  jest.restoreAllMocks();
  if (savedCallbackSecret === undefined) {
    delete process.env.ZKTECO_CALLBACK_SECRET;
  } else {
    process.env.ZKTECO_CALLBACK_SECRET = savedCallbackSecret;
  }
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

describe("The blank day is today in Manila", () => {
  it("at 07:30 Manila (23:30 UTC the day before) it is Nov 27, and the rows are stored on Nov 27", async () => {
    setClock("2026-11-26T23:30:00Z");

    const res = await blankDay();
    expect(res.status).toBe(200);
    expect(res.body.date).toBe("2026-11-27");
    expect(res.body.created).toBe(1);

    const rows = await Attendance.find().lean();
    expect(rows).toHaveLength(1);
    expect(String(rows[0].userId)).toBe(carlo.id);
    expect(rows[0].date.toISOString()).toBe("2026-11-27T00:00:00.000Z");
  });

  it("at 00:30 Manila (16:30 UTC the day before) it is already Nov 28", async () => {
    setClock("2026-11-27T16:30:00Z");

    const res = await blankDay();
    expect(res.status).toBe(200);
    expect(res.body.date).toBe("2026-11-28");
    expect(await dayKeys()).toEqual(["2026-11-28"]);
  });

  it("run again the same Manila morning, it adds nothing new", async () => {
    setClock("2026-11-26T23:30:00Z");
    await blankDay();

    const again = await blankDay();
    expect(again.status).toBe(200);
    expect(again.body.created).toBe(0);
    expect(again.body.skippedRecords).toEqual([
      { name: "Carlo Mercado", reason: "Record already exists" },
    ]);
    expect(await dayKeys()).toEqual(["2026-11-27"]);
  });

  it("an Employee can't make a blank day (403), and nothing is saved", async () => {
    setClock("2026-11-26T23:30:00Z");

    const res = await blankDay(carlo);
    expect(res.status).toBe(403);
    expect(await Attendance.countDocuments()).toBe(0);
  });
});

describe("My attendance today is today in Manila", () => {
  beforeEach(async () => {
    await Attendance.insertMany([
      {
        userId: carlo.user._id,
        date: new Date("2026-11-26T00:00:00Z"),
        timeIn: new Date("2026-11-26T08:00:00Z"),
      },
      {
        userId: carlo.user._id,
        date: new Date("2026-11-27T00:00:00Z"),
        timeIn: new Date("2026-11-27T07:15:00Z"),
      },
    ]);
  });

  it("at 07:30 Manila on Nov 27 it returns the Nov 27 row, not the Nov 26 one", async () => {
    setClock("2026-11-26T23:30:00Z");

    const res = await myToday(carlo);
    expect(res.status).toBe(200);
    expect(res.body.date).toBe("2026-11-27T00:00:00.000Z");
    expect(res.body.timeIn).toBe("07:15:00");
  });

  it("at 00:30 Manila on Nov 28, with no row yet, it answers 404", async () => {
    setClock("2026-11-27T16:30:00Z");

    const res = await myToday(carlo);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Attendance not found for today" });
  });

  it("another Employee can't read Carlo's day (403)", async () => {
    setClock("2026-11-26T23:30:00Z");
    const liza = await employee("liza", "Liza", "AC-013");

    const res = await request(app)
      .get(`/api/attendance/${carlo.id}/today`)
      .set(as(liza));
    expect(res.status).toBe(403);
  });
});

describe("Edit Attendance refuses a day that isn't on the calendar", () => {
  it.each(["2026-02-30", "2026-04-31"])(
    "%s answers 400 and saves nothing",
    async (date) => {
      const res = await editAttendance({ date, timeIn: "08:00:00" });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: BAD_DATE });
      expect(await Attendance.countDocuments()).toBe(0);
      expect(await ActivityLog.countDocuments()).toBe(0);
    },
  );

  it("a refused day leaves an existing row on the rolled-over day alone", async () => {
    await editAttendance({ date: "2026-03-02", timeIn: "08:00:00" });

    const res = await editAttendance({
      date: "2026-02-30",
      timeIn: "09:00:00",
      timeOut: "17:00:00",
    });
    expect(res.status).toBe(400);

    const [row] = await Attendance.find().lean();
    expect(row.date.toISOString()).toBe("2026-03-02T00:00:00.000Z");
    expect(row.timeIn.toISOString()).toBe("2026-03-02T08:00:00.000Z");
    expect(row.timeOut).toBeNull();
  });

  it("a real day still works: Feb 28 is saved on Feb 28", async () => {
    const res = await editAttendance({
      date: "2026-02-28",
      timeIn: "08:00:00",
      timeOut: "17:00:00",
    });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);

    const [row] = await Attendance.find().lean();
    expect(row.date.toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(row.timeIn.toISOString()).toBe("2026-02-28T08:00:00.000Z");
    expect(row.timeOut.toISOString()).toBe("2026-02-28T17:00:00.000Z");
  });

  it("Feb 29 of a leap year is a real day", async () => {
    const res = await editAttendance({ date: "2028-02-29", timeIn: "08:00:00" });
    expect(res.status).toBe(201);
    expect(await dayKeys()).toEqual(["2028-02-29"]);
  });

  it("a date that isn't text answers 400 with the same message", async () => {
    const res = await editAttendance({
      date: ["2026-02-28"],
      timeIn: "08:00:00",
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: BAD_DATE });
    expect(await Attendance.countDocuments()).toBe(0);
  });

  it("an Employee can't edit attendance (403), and nothing is saved", async () => {
    const res = await editAttendance(
      { date: "2026-02-28", timeIn: "08:00:00" },
      carlo,
    );
    expect(res.status).toBe(403);
    expect(await Attendance.countDocuments()).toBe(0);
  });
});

describe("routes/attendance.js: no error details in a 500 reply", () => {
  it("GET /attendance (the list)", async () => {
    const log = quietLog();
    breakCall(Attendance, "find");

    const res = await request(app)
      .get("/api/attendance/attendance")
      .set(as(boss));
    expectPlainServerError(res, { message: "Server error" }, log);
  });

  it("GET /:userId/records", async () => {
    const log = quietLog();
    breakCall(Attendance, "find");

    const res = await request(app)
      .get(`/api/attendance/${carlo.id}/records`)
      .set(as(carlo));
    expectPlainServerError(res, { message: "Server error" }, log);
  });

  it("an Admin opening another account's records, when the account check fails", async () => {
    const log = quietLog();
    // Only the visible-account check (it asks for a role); the sign-in check still works
    const realFindOne = User.findOne.bind(User);
    jest.spyOn(User, "findOne").mockImplementation((filter, ...rest) => {
      if (filter && Object.prototype.hasOwnProperty.call(filter, "role")) {
        throw new Error(RAW_DETAIL);
      }
      return realFindOne(filter, ...rest);
    });

    const res = await request(app)
      .get(`/api/attendance/${carlo.id}/records`)
      .set(as(boss));
    expectPlainServerError(res, { message: "Server error" }, log);
  });

  it("PUT /edit-attendance/:id saves nothing", async () => {
    const log = quietLog();
    breakCall(Attendance, "findOne");

    const res = await editAttendance({ date: "2026-02-28", timeIn: "08:00:00" });
    expectPlainServerError(res, { message: "Server error" }, log);
    expect(await Attendance.countDocuments()).toBe(0);
  });

  it("POST /create-blank.today saves nothing", async () => {
    const log = quietLog();
    breakCall(Employee, "find");

    const res = await blankDay();
    expectPlainServerError(res, { message: "Server error" }, log);
    expect(await Attendance.countDocuments()).toBe(0);
  });

  it("POST /import-biometric", async () => {
    const log = quietLog();
    breakCall(Employee, "find");

    const res = await request(app)
      .post("/api/attendance/import-biometric")
      .set(as(boss))
      .send({ deviceIp: "10.0.0.5" });
    expectPlainServerError(res, { message: "Server error" }, log);
  });

  it("POST /import-biometric: a record that can't be saved is listed with fixed text, the others still come in", async () => {
    const log = quietLog();
    const realSave = Attendance.prototype.save;
    let saves = 0;
    jest
      .spyOn(Attendance.prototype, "save")
      .mockImplementation(function (...args) {
        saves += 1;
        if (saves === 1) return Promise.reject(new Error(RAW_DETAIL));
        return realSave.apply(this, args);
      });
    const broken = {
      userId: "AC-012",
      timestamp: "2026-11-12T08:00:00Z",
      time: "08:00:00",
    };
    mockPunches = [
      broken,
      { userId: "AC-012", timestamp: "2026-11-13T08:00:00Z", time: "08:00:00" },
    ];

    const res = await request(app)
      .post("/api/attendance/import-biometric")
      .set(as(boss))
      .send({ deviceIp: "10.0.0.5" });
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);
    expect(res.body.errors).toEqual([
      { zkRecord: broken, error: "Could not save this record." },
    ]);
    expect(JSON.stringify(res.body)).not.toContain(RAW_DETAIL);
    expect(loggedRawDetail(log)).toBe(true);
    expect(await dayKeys()).toEqual(["2026-11-13"]);
  });

  it("POST /iclock/cdata (the device's own push)", async () => {
    process.env.ZKTECO_CALLBACK_SECRET = "device-secret-for-tests";
    const log = quietLog();
    breakCall(Employee, "findOne");

    const res = await request(app)
      .post("/api/attendance/iclock/cdata")
      .set("x-zkteco-token", "device-secret-for-tests")
      .send({ userId: "AC-012", dateTime: "2026-11-12T08:00:00" });
    expectPlainServerError(
      res,
      { success: false, message: "Server error" },
      log,
    );
    expect(await Attendance.countDocuments()).toBe(0);
  });
});
