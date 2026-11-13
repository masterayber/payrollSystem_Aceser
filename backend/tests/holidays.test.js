// The company holiday list (DED-2): the shared list of holiday types
// (backend/config/holidays.js and its frontend copy), and /api/holidays: everyone signed
// in reads the list, an admin with the Calendar tick adds and removes holidays.
import * as frontendList from "../../frontend/src/utils/holidays";

jest.mock("../utils/nodemailer", () => jest.fn().mockResolvedValue());

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Holiday = require("../models/holiday");
const backendList = require("../config/holidays");

// name, non-working: in the order the Calendar form lists them
const EXPECTED = [
  ["Regular", true],
  ["Special Non-Working", true],
  ["Special Working", false],
];
const EXPECTED_NAMES = EXPECTED.map(([name]) => name);

// Not on the list: refused by isHolidayType and by POST /api/holidays, and never a
// non-working holiday
const OFF_LIST = [
  ["a type that isn't on the list", "Company Holiday"],
  ["an empty type", ""],
  ["a name in the wrong case", "regular"],
  ["a name with spaces around it", " Regular "],
  ["the name as the screen shows it", "Regular Holiday"],
  ["null", null],
  ["a list holding a name", ["Regular"]],
  ["a number", 1],
];

// One table of cases for both copies of the list, so they can't drift apart
describe.each([
  ["frontend", frontendList],
  ["backend", backendList],
])("%s holiday-type list", (copy, list) => {
  const {
    HOLIDAY_TYPES,
    HOLIDAY_TYPE_NAMES,
    isHolidayType,
    isNonWorkingHoliday,
  } = list;

  it("holds the three types in the order of the Calendar form, with nothing else", () => {
    expect(HOLIDAY_TYPES).toStrictEqual(
      EXPECTED.map(([name, nonWorking]) => ({ name, nonWorking })),
    );
  });

  it("lists the three names in order as HOLIDAY_TYPE_NAMES", () => {
    expect(HOLIDAY_TYPE_NAMES).toStrictEqual(EXPECTED_NAMES);
  });

  it.each(EXPECTED_NAMES)("isHolidayType is true for %s", (name) => {
    expect(isHolidayType(name)).toBe(true);
  });

  it.each([...OFF_LIST, ["undefined", undefined]])(
    "isHolidayType is false for %s",
    (label, value) => {
      expect(isHolidayType(value)).toBe(false);
    },
  );

  it.each(EXPECTED)("isNonWorkingHoliday for %s is %s", (name, nonWorking) => {
    expect(isNonWorkingHoliday(name)).toBe(nonWorking);
  });

  it.each([...OFF_LIST, ["undefined", undefined]])(
    "isNonWorkingHoliday is false for %s",
    (label, value) => {
      expect(isNonWorkingHoliday(value)).toBe(false);
    },
  );
});

describe("the two copies of the holiday-type list", () => {
  it("are the same", () => {
    expect(frontendList.HOLIDAY_TYPES).toStrictEqual(backendList.HOLIDAY_TYPES);
    expect(frontendList.HOLIDAY_TYPE_NAMES).toStrictEqual(
      backendList.HOLIDAY_TYPE_NAMES,
    );
  });

  it("the frontend copy has everything the server's list exports (and its own screen helpers)", () => {
    expect(Object.keys(frontendList)).toEqual(
      expect.arrayContaining(Object.keys(backendList)),
    );
  });
});

describe("/api/holidays", () => {
  const PASSWORD = "Password123!";
  const DENIED = {
    message: "You do not have access to this page",
    code: "PAGE_ACCESS_DENIED",
  };
  const ADMIN_ONLY = { message: "Admin access required" };
  const BAD_DATE = "Enter the date as a valid date.";
  const NO_NAME = "Name the holiday.";
  const BAD_TYPE = "Choose a holiday type.";
  const TAKEN = "That date already has a holiday.";
  const NOT_FOUND = { message: "Holiday not found." };

  // Friday, December 25, 2026
  const CHRISTMAS = {
    date: "2026-12-25",
    name: "Christmas Day",
    type: "Regular",
  };

  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    // The unique index on the date has to exist before the tests that rely on it
    await Holiday.init();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await User.deleteMany({});
    await Holiday.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  const loginAs = async (username) => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username, password: PASSWORD });
    expect(res.status).toBe(200);
    return res.body.token;
  };

  // An Active account, signed in. An Admin's ticks are its `pageAccess`.
  const account = async (username, role, extra = {}) => {
    const user = await User.create({
      username,
      password: PASSWORD,
      email: `${username}@example.com`,
      role,
      status: "Active",
      ...extra,
    });
    return { user, token: await loginAs(username) };
  };
  const superAdmin = () => account("admin", "Super Admin");
  const employee = (extra) => account("ana", "Employee", extra);
  const adminWithCalendar = () =>
    account("hr.rhea", "Admin", { pageAccess: ["admin-calendar"] });
  // Every other everyday tick, but not Calendar
  const adminWithoutCalendar = () =>
    account("hr.carl", "Admin", {
      pageAccess: ["employees", "admin-attendance", "admin-filing", "reports"],
    });

  const as = (token) => ({ Authorization: `Bearer ${token}` });
  const list = (token, query = "") =>
    request(app).get(`/api/holidays${query}`).set(as(token));
  const add = (token, body) =>
    request(app).post("/api/holidays").set(as(token)).send(body);
  const remove = (token, id) =>
    request(app).delete(`/api/holidays/${id}`).set(as(token));

  // Saved straight to the model, as a holiday that is already on the list
  const saveHoliday = (date, name = "Holiday", type = "Regular") =>
    Holiday.create({ date: new Date(`${date}T00:00:00Z`), name, type });

  const savedDates = async () =>
    (await Holiday.find().sort({ date: 1 }).lean()).map((holiday) =>
      holiday.date.toISOString(),
    );

  const expectRefused = async (res, message) => {
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message });
    expect(await Holiday.countDocuments()).toBe(0);
  };

  describe("GET /api/holidays", () => {
    it("answers the same list to an Employee, an Admin and the Super Admin", async () => {
      const holiday = await saveHoliday("2026-12-25", "Christmas Day");
      const expected = [
        {
          id: String(holiday._id),
          date: "2026-12-25",
          name: "Christmas Day",
          type: "Regular",
        },
      ];

      const callers = [
        await employee(),
        await adminWithCalendar(),
        await adminWithoutCalendar(),
        await superAdmin(),
      ];
      for (const { user, token } of callers) {
        const res = await list(token);
        expect([user.role, res.status]).toEqual([user.role, 200]);
        expect(res.body).toStrictEqual(expected);
      }
    });

    it("answers an employee who doesn't have the Calendar page: the attendance rules need the list", async () => {
      await saveHoliday("2026-12-25");
      const { token } = await employee({ pageAccess: ["dashboard"] });

      const res = await list(token);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("refuses a request without a sign-in token", async () => {
      await saveHoliday("2026-12-25");

      const res = await request(app).get("/api/holidays");

      expect(res.status).toBe(401);
      expect(Array.isArray(res.body)).toBe(false);
    });

    it("answers an empty list when no holiday has been added", async () => {
      const { token } = await employee();

      const res = await list(token);

      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual([]);
    });

    it("gives each holiday as id, date (YYYY-MM-DD), name and type only, oldest first", async () => {
      // Saved out of order
      await saveHoliday("2026-12-25", "Christmas Day", "Regular");
      await saveHoliday("2026-01-01", "New Year's Day", "Regular");
      await saveHoliday("2026-11-02", "All Souls' Day", "Special Working");
      await saveHoliday(
        "2026-08-21",
        "Ninoy Aquino Day",
        "Special Non-Working",
      );
      const { token } = await employee();

      const res = await list(token);

      expect(res.status).toBe(200);
      expect(
        res.body.map(({ date, name, type }) => [date, name, type]),
      ).toEqual([
        ["2026-01-01", "New Year's Day", "Regular"],
        ["2026-08-21", "Ninoy Aquino Day", "Special Non-Working"],
        ["2026-11-02", "All Souls' Day", "Special Working"],
        ["2026-12-25", "Christmas Day", "Regular"],
      ]);
      for (const holiday of res.body) {
        expect(Object.keys(holiday).sort()).toEqual([
          "date",
          "id",
          "name",
          "type",
        ]);
        expect(mongoose.isValidObjectId(holiday.id)).toBe(true);
      }
    });

    describe("the year", () => {
      const seed = async () => {
        await saveHoliday("2025-12-31", "Last Day of 2025");
        await saveHoliday("2026-01-01", "New Year's Day");
        await saveHoliday("2026-06-12", "Independence Day");
        await saveHoliday("2026-12-31", "Last Day of the Year");
        await saveHoliday("2027-01-01", "New Year's Day 2027");
      };

      it("keeps only that calendar year, January 1 and December 31 included", async () => {
        await seed();
        const { token } = await employee();

        const year2026 = await list(token, "?year=2026");
        expect(year2026.status).toBe(200);
        expect(year2026.body.map(({ date }) => date)).toEqual([
          "2026-01-01",
          "2026-06-12",
          "2026-12-31",
        ]);

        const year2025 = await list(token, "?year=2025");
        expect(year2025.body.map(({ date }) => date)).toEqual(["2025-12-31"]);

        const year2027 = await list(token, "?year=2027");
        expect(year2027.body.map(({ date }) => date)).toEqual(["2027-01-01"]);

        const year2030 = await list(token, "?year=2030");
        expect(year2030.status).toBe(200);
        expect(year2030.body).toStrictEqual([]);
      });

      it("gives every holiday when no year is sent, so a cut-off across New Year has both years", async () => {
        await seed();
        const { token } = await employee();

        const res = await list(token);

        expect(res.status).toBe(200);
        expect(res.body.map(({ date }) => date)).toEqual([
          "2025-12-31",
          "2026-01-01",
          "2026-06-12",
          "2026-12-31",
          "2027-01-01",
        ]);
      });

      it.each([
        ["two digits", "?year=26"],
        ["five digits", "?year=20266"],
        ["letters", "?year=abcd"],
        ["an empty year", "?year="],
        ["a year with a decimal point", "?year=2026.0"],
        ["a year with a space", "?year=%202026"],
        ["a negative year", "?year=-2026"],
        ["a full date", "?year=2026-01-01"],
        ["the year sent twice", "?year=2026&year=2027"],
      ])("refuses %s", async (label, query) => {
        await seed();
        const { token } = await employee();

        const res = await list(token, query);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: "Enter the year as four digits." });
      });
    });
  });

  describe("POST /api/holidays", () => {
    it("saves a holiday: 201, the message and the holiday, stored at 00:00 UTC with who added it", async () => {
      const { user, token } = await superAdmin();

      const res = await add(token, CHRISTMAS);

      expect(res.status).toBe(201);
      const saved = await Holiday.findOne().lean();
      expect(res.body).toStrictEqual({
        message: "Holiday saved.",
        holiday: { id: String(saved._id), ...CHRISTMAS },
      });
      expect(saved.date.toISOString()).toBe("2026-12-25T00:00:00.000Z");
      expect(saved.name).toBe("Christmas Day");
      expect(saved.type).toBe("Regular");
      expect(String(saved.createdBy)).toBe(String(user._id));
      expect(await Holiday.countDocuments()).toBe(1);

      const listed = await list(token, "?year=2026");
      expect(listed.body).toStrictEqual([res.body.holiday]);
    });

    it.each(EXPECTED_NAMES)("accepts the type %s", async (type) => {
      const { token } = await superAdmin();

      const res = await add(token, { ...CHRISTMAS, type });

      expect(res.status).toBe(201);
      expect(res.body.holiday.type).toBe(type);
    });

    it("trims the name, and ignores any other field that is sent", async () => {
      const { user, token } = await superAdmin();
      const someoneElse = String(new mongoose.Types.ObjectId());

      const res = await add(token, {
        ...CHRISTMAS,
        name: "  Christmas Day  ",
        createdBy: someoneElse,
        _id: someoneElse,
      });

      expect(res.status).toBe(201);
      expect(res.body.holiday.name).toBe("Christmas Day");
      const saved = await Holiday.findOne().lean();
      expect(saved.name).toBe("Christmas Day");
      expect(String(saved.createdBy)).toBe(String(user._id));
      expect(String(saved._id)).not.toBe(someoneElse);
    });

    it("accepts a holiday on a Saturday, a leap day and a past date", async () => {
      const { token } = await superAdmin();

      for (const date of ["2026-12-26", "2028-02-29", "2026-01-01"]) {
        const res = await add(token, { ...CHRISTMAS, date });
        expect([date, res.status]).toEqual([date, 201]);
        expect(res.body.holiday.date).toBe(date);
      }

      expect(await savedDates()).toEqual([
        "2026-01-01T00:00:00.000Z",
        "2026-12-26T00:00:00.000Z",
        "2028-02-29T00:00:00.000Z",
      ]);
    });

    it.each([
      ["no date", undefined],
      ["an empty date", ""],
      ["a date in another format", "12/25/2026"],
      ["a date without leading zeros", "2026-2-3"],
      ["February 30", "2026-02-30"],
      ["February 29 of a year that has none", "2026-02-29"],
      ["April 31", "2026-04-31"],
      ["month 13", "2026-13-01"],
      ["day 00", "2026-12-00"],
      ["a date with a time", "2026-12-25T00:00:00Z"],
      ["a number", 20261225],
      ["null", null],
      ["a list holding a date", ["2026-12-25"]],
    ])("refuses %s and saves nothing", async (label, date) => {
      const { token } = await superAdmin();

      const res = await add(token, { ...CHRISTMAS, date });

      await expectRefused(res, BAD_DATE);
    });

    it.each([
      ["no name", undefined],
      ["an empty name", ""],
      ["a name of spaces only", "   "],
      ["a number", 5],
      ["null", null],
      ["a list holding a name", ["Christmas Day"]],
    ])("refuses %s and saves nothing", async (label, name) => {
      const { token } = await superAdmin();

      const res = await add(token, { ...CHRISTMAS, name });

      await expectRefused(res, NO_NAME);
    });

    it.each([...OFF_LIST, ["no type", undefined]])(
      "refuses %s and saves nothing",
      async (label, type) => {
        const { token } = await superAdmin();

        const res = await add(token, { ...CHRISTMAS, type });

        await expectRefused(res, BAD_TYPE);
      },
    );

    it("refuses an empty request with the date message", async () => {
      const { token } = await superAdmin();

      const res = await add(token, {});

      await expectRefused(res, BAD_DATE);
    });

    it("checks the date first, then the name, then the type, then whether the date is taken", async () => {
      const { token } = await superAdmin();
      const bad = { date: "2026-02-30", name: " ", type: "Company Holiday" };

      await expectRefused(await add(token, bad), BAD_DATE);
      await expectRefused(
        await add(token, { ...bad, date: CHRISTMAS.date }),
        NO_NAME,
      );
      await expectRefused(
        await add(token, { ...bad, date: CHRISTMAS.date, name: "Christmas" }),
        BAD_TYPE,
      );

      // With a holiday already on that date, a bad name or type is still what is reported
      await saveHoliday(CHRISTMAS.date, "Christmas Day");
      const badName = await add(token, { ...CHRISTMAS, name: "" });
      expect(badName.status).toBe(400);
      expect(badName.body).toEqual({ message: NO_NAME });
      const badType = await add(token, {
        ...CHRISTMAS,
        type: "Company Holiday",
      });
      expect(badType.status).toBe(400);
      expect(badType.body).toEqual({ message: BAD_TYPE });

      const taken = await add(token, CHRISTMAS);
      expect(taken.status).toBe(409);
      expect(taken.body).toEqual({ message: TAKEN });
      expect(await Holiday.countDocuments()).toBe(1);
    });

    it("refuses a second holiday on the same date, whatever its name and type, and keeps the first", async () => {
      const { token } = await superAdmin();
      expect((await add(token, CHRISTMAS)).status).toBe(201);

      const res = await add(token, {
        date: CHRISTMAS.date,
        name: "Company Outing",
        type: "Special Working",
      });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ message: TAKEN });
      const saved = await Holiday.find().lean();
      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe("Christmas Day");
      expect(saved[0].type).toBe("Regular");

      // The day before and the day after are free
      expect(
        (await add(token, { ...CHRISTMAS, date: "2026-12-24" })).status,
      ).toBe(201);
      expect(
        (await add(token, { ...CHRISTMAS, date: "2026-12-26" })).status,
      ).toBe(201);
    });

    it("answers 409, not 500, when two requests for the same date arrive together", async () => {
      const { token } = await superAdmin();
      await saveHoliday(CHRISTMAS.date, "Christmas Day");
      // The other request saved its holiday after this one looked: only the unique
      // index on the date is left to refuse it
      jest.spyOn(Holiday, "exists").mockResolvedValueOnce(null);

      const res = await add(token, { ...CHRISTMAS, name: "Christmas" });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ message: TAKEN });
      expect(await Holiday.countDocuments()).toBe(1);
    });

    it("the model itself refuses a second holiday on a date, a missing name and an unknown type", async () => {
      await saveHoliday(CHRISTMAS.date);

      await expect(saveHoliday(CHRISTMAS.date, "Again")).rejects.toMatchObject({
        code: 11000,
      });
      await expect(
        Holiday.create({
          date: new Date("2026-12-24T00:00:00Z"),
          type: "Regular",
        }),
      ).rejects.toThrow(/name/);
      await expect(
        saveHoliday("2026-12-24", "Christmas Eve", "Company Holiday"),
      ).rejects.toThrow(/type/);
      expect(await Holiday.countDocuments()).toBe(1);
    });
  });

  describe("DELETE /api/holidays/:id", () => {
    it("removes the holiday and leaves the others", async () => {
      const { token } = await superAdmin();
      const christmas = await saveHoliday("2026-12-25", "Christmas Day");
      await saveHoliday("2026-12-30", "Rizal Day");

      const res = await remove(token, christmas._id);

      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({ message: "Holiday removed." });
      expect(await savedDates()).toEqual(["2026-12-30T00:00:00.000Z"]);

      const listed = await list(token);
      expect(listed.body.map(({ date }) => date)).toEqual(["2026-12-30"]);
    });

    it("frees the date: the same date can be added again", async () => {
      const { token } = await superAdmin();
      const first = await add(token, CHRISTMAS);

      expect((await remove(token, first.body.holiday.id)).status).toBe(200);
      const again = await add(token, { ...CHRISTMAS, type: "Special Working" });

      expect(again.status).toBe(201);
      expect(again.body.holiday.id).not.toBe(first.body.holiday.id);
      expect(await Holiday.countDocuments()).toBe(1);
    });

    it.each([
      ["an id that isn't an id", "not-an-id"],
      ["a date instead of an id", "2026-12-25"],
    ])("answers 404 for %s", async (label, id) => {
      const { token } = await superAdmin();
      await saveHoliday("2026-12-25");

      const res = await remove(token, id);

      expect(res.status).toBe(404);
      expect(res.body).toEqual(NOT_FOUND);
      expect(await Holiday.countDocuments()).toBe(1);
    });

    it("answers 404 for an id that matches no holiday, and for one already removed", async () => {
      const { token } = await superAdmin();
      const holiday = await saveHoliday("2026-12-25");

      const unknown = await remove(token, new mongoose.Types.ObjectId());
      expect(unknown.status).toBe(404);
      expect(unknown.body).toEqual(NOT_FOUND);
      expect(await Holiday.countDocuments()).toBe(1);

      expect((await remove(token, holiday._id)).status).toBe(200);
      const twice = await remove(token, holiday._id);
      expect(twice.status).toBe(404);
      expect(twice.body).toEqual(NOT_FOUND);
    });
  });

  describe("who may add and remove", () => {
    it("lets an Admin with the Calendar tick add and remove, and records it as the one who added", async () => {
      const { user, token } = await adminWithCalendar();

      const added = await add(token, CHRISTMAS);
      expect(added.status).toBe(201);
      expect(added.body.message).toBe("Holiday saved.");
      const saved = await Holiday.findOne().lean();
      expect(String(saved.createdBy)).toBe(String(user._id));

      const removed = await remove(token, added.body.holiday.id);
      expect(removed.status).toBe(200);
      expect(removed.body).toEqual({ message: "Holiday removed." });
      expect(await Holiday.countDocuments()).toBe(0);
    });

    it("refuses an Admin without the Calendar tick: 403 PAGE_ACCESS_DENIED, nothing saved or removed", async () => {
      const { token } = await adminWithoutCalendar();
      const holiday = await saveHoliday("2026-12-30", "Rizal Day");

      const added = await add(token, CHRISTMAS);
      expect(added.status).toBe(403);
      expect(added.body).toEqual(DENIED);

      const removed = await remove(token, holiday._id);
      expect(removed.status).toBe(403);
      expect(removed.body).toEqual(DENIED);

      expect(await savedDates()).toEqual(["2026-12-30T00:00:00.000Z"]);
    });

    it("refuses an Admin with no ticks stored at all", async () => {
      const { token } = await account("hr.new", "Admin");

      const res = await add(token, CHRISTMAS);

      expect(res.status).toBe(403);
      expect(res.body).toEqual(DENIED);
      expect(await Holiday.countDocuments()).toBe(0);
    });

    it("refuses an Employee: 403, even one with the employee Calendar page", async () => {
      const { token } = await employee({
        pageAccess: ["dashboard", "calendar"],
      });
      const holiday = await saveHoliday("2026-12-30", "Rizal Day");

      const added = await add(token, CHRISTMAS);
      expect(added.status).toBe(403);
      expect(added.body).toEqual(ADMIN_ONLY);

      const removed = await remove(token, holiday._id);
      expect(removed.status).toBe(403);
      expect(removed.body).toEqual(ADMIN_ONLY);

      expect(await savedDates()).toEqual(["2026-12-30T00:00:00.000Z"]);
    });

    it("refuses a request without a sign-in token", async () => {
      const holiday = await saveHoliday("2026-12-30", "Rizal Day");

      const added = await request(app).post("/api/holidays").send(CHRISTMAS);
      expect(added.status).toBe(401);

      const removed = await request(app).delete(`/api/holidays/${holiday._id}`);
      expect(removed.status).toBe(401);

      expect(await savedDates()).toEqual(["2026-12-30T00:00:00.000Z"]);
    });

    it("checks who is asking before what was sent: no hint about the form or the list", async () => {
      const { token } = await adminWithoutCalendar();
      await saveHoliday(CHRISTMAS.date);

      const badBody = await add(token, { date: "2026-02-30" });
      expect(badBody.status).toBe(403);
      expect(badBody.body).toEqual(DENIED);

      const taken = await add(token, CHRISTMAS);
      expect(taken.status).toBe(403);
      expect(taken.body).toEqual(DENIED);

      const unknown = await remove(token, "not-an-id");
      expect(unknown.status).toBe(403);
      expect(unknown.body).toEqual(DENIED);
    });

    it("takes the tick away on the Admin's next request, without a new sign-in", async () => {
      const { user, token } = await adminWithCalendar();
      expect((await add(token, CHRISTMAS)).status).toBe(201);

      await User.updateOne({ _id: user._id }, { pageAccess: ["employees"] });

      const res = await add(token, { ...CHRISTMAS, date: "2026-12-30" });
      expect(res.status).toBe(403);
      expect(res.body).toEqual(DENIED);
      expect(await Holiday.countDocuments()).toBe(1);
    });

    it("never names the highest admin role in a message", async () => {
      const { token: employeeToken } = await employee();
      const { token: adminToken } = await adminWithoutCalendar();
      const { token } = await superAdmin();
      await saveHoliday(CHRISTMAS.date);

      const replies = [
        await request(app).get("/api/holidays"),
        await list(token, "?year=x"),
        await add(employeeToken, CHRISTMAS),
        await add(adminToken, CHRISTMAS),
        await add(token, {}),
        await add(token, { date: "2026-12-24" }),
        await add(token, { date: "2026-12-24", name: "Christmas Eve" }),
        await add(token, CHRISTMAS),
        await add(token, { ...CHRISTMAS, date: "2026-12-24" }),
        await remove(token, "not-an-id"),
        await remove(employeeToken, "not-an-id"),
      ];

      for (const res of replies) {
        expect(typeof res.body.message).toBe("string");
        expect(res.body.message).not.toMatch(/super\s*admin/i);
      }
    });
  });
});
