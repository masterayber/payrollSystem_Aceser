// The holiday import (follow-up to DED-2): the table of Regular holidays
// (config/regularHolidays.js), the rules in utils/holidayImport.js, and the two routes
// GET /api/holidays/import-preview and POST /api/holidays/import, plus the `source` mark
// on every holiday.
//
// No test here goes out to the internet. `global.fetch` is replaced before every test by
// a fake that rejects with "real network in a test"; a test that expects the source to be
// asked says so with sourceAnswers / sourceGives / sourceFails, and after every test the
// number of calls must be exactly the number planned. "Today" is pinned with
// jest.spyOn(Date, "now") (manilaToday reads it): Friday 2026-11-13, noon in Manila, so
// the two years an import may be for are 2026 and 2027.
//
// SOURCE_HOLIDAYS holds the 18 names and the 2026 dates of the Nager.Date v4 reply as
// the plan recorded them on 2026-11-13 (backend/reports/Plans/2026-11-13 holiday import
// proposal.md, section 4), and the 2027 dates of the plan's worked example (section 9).
// The other fields of a row (countryCode, nationalHoliday, subdivisionCodes,
// holidayTypes) follow the plan's description of v4, not a fresh recording.

jest.mock("../utils/nodemailer", () => jest.fn().mockResolvedValue());

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Holiday = require("../models/holiday");
const config = require("../config/regularHolidays");
const { HOLIDAY_TYPE_NAMES } = require("../config/holidays");
const {
  isCalendarDay,
  checkHoliday,
  toShortDate,
  normaliseName,
  presetFor,
  importYears,
  checkImportYear,
  sourceAddress,
  fetchSourceHolidays,
  cleanSourceRows,
  buildPreview,
  checkImport,
  importMessage,
} = require("../utils/holidayImport");

const REGULAR = "Regular";
const SPECIAL = "Special Non-Working";

const ADDRESS_2026 = "https://nagerholidays.com/api/v4/Holidays/PH/2026";
const ADDRESS_2027 = "https://nagerholidays.com/api/v4/Holidays/PH/2027";

// Month and day in 2026, month and day in 2027, the source's name, the name and type the
// preview presets
const SOURCE_HOLIDAYS = [
  ["01-01", "01-01", "New Year's Day", "New Year's Day", REGULAR],
  ["02-17", "02-06", "Chinese New Year", "Chinese New Year", SPECIAL],
  ["04-02", "03-25", "Maundy Thursday", "Maundy Thursday", REGULAR],
  ["04-03", "03-26", "Good Friday", "Good Friday", REGULAR],
  ["04-04", "03-27", "Holy Saturday", "Holy Saturday", SPECIAL],
  ["04-09", "04-09", "Day of Valor", "Araw ng Kagitingan", REGULAR],
  ["05-01", "05-01", "Labour Day", "Labor Day", REGULAR],
  ["06-12", "06-12", "Independence Day", "Independence Day", REGULAR],
  ["08-21", "08-21", "Ninoy Aquino Day", "Ninoy Aquino Day", SPECIAL],
  ["08-31", "08-30", "National Heroes Day", "National Heroes Day", REGULAR],
  ["10-31", "10-31", "All Saints' Day Eve", "All Saints' Day Eve", SPECIAL],
  ["11-01", "11-01", "All Saints' Day", "All Saints' Day", SPECIAL],
  ["11-30", "11-30", "Bonifacio Day", "Bonifacio Day", REGULAR],
  [
    "12-08",
    "12-08",
    "Feast of the Immaculate Conception of Mary",
    "Feast of the Immaculate Conception of Mary",
    SPECIAL,
  ],
  ["12-24", "12-24", "Christmas Eve", "Christmas Eve", SPECIAL],
  ["12-25", "12-25", "Christmas Day", "Christmas Day", REGULAR],
  ["12-30", "12-30", "Rizal Day", "Rizal Day", REGULAR],
  ["12-31", "12-31", "Last Day of The Year", "Last Day of The Year", SPECIAL],
];

// One row as Nager.Date v4 sends it
const sourceRow = (date, name, extra = {}) => ({
  date,
  name,
  countryCode: "PH",
  nationalHoliday: true,
  subdivisionCodes: null,
  holidayTypes: ["Public"],
  ...extra,
});

const REPLY_2026 = SOURCE_HOLIDAYS.map(([day, , name]) =>
  sourceRow(`2026-${day}`, name),
);
const REPLY_2027 = SOURCE_HOLIDAYS.map(([, day, name]) =>
  sourceRow(`2027-${day}`, name),
);

// The preview rows those replies give when no holiday is listed yet
const PREVIEW_2026 = SOURCE_HOLIDAYS.map(([day, , sourceName, name, type]) => ({
  date: `2026-${day}`,
  sourceName,
  name,
  type,
  listed: null,
}));
const PREVIEW_2027 = SOURCE_HOLIDAYS.map(([, day, sourceName, name, type]) => ({
  date: `2027-${day}`,
  sourceName,
  name,
  type,
  listed: null,
}));

// What the screen sends on Save for a set of preview rows
const ticked = (rows) =>
  rows.map(({ date, name, type }) => ({ date, name, type }));
const ALL_2027 = ticked(PREVIEW_2027);
// The plan's worked example: 2027 without April 9 (already listed) and December 24
const SIXTEEN_2027 = ALL_2027.filter(
  ({ date }) => date !== "2027-04-09" && date !== "2027-12-24",
);
const NEW_YEAR_2027 = {
  date: "2027-01-01",
  name: "New Year's Day",
  type: REGULAR,
};

const YEAR_FORMAT = "Enter the year as four digits.";
const YEAR_WINDOW = "Holidays can be imported for 2026 or 2027 only.";
const SOURCE_DOWN =
  "Could not get the holidays from Nager.Date. Try again later, or add them by hand.";
const NOTHING_TICKED = "Tick at least one holiday to save.";
const TOO_MANY = "Too many holidays in one import (40 at most).";
const ALL_TAKEN = "Every ticked date already has a holiday. Nothing was saved.";
const BAD_DATE = "Enter the date as a valid date.";
const NO_NAME = "Name the holiday.";
const BAD_TYPE = "Choose a holiday type.";

// Friday, November 13, 2026, noon in Manila
const TODAY = "2026-11-13T04:00:00Z";
const pinNow = (iso) =>
  jest.spyOn(Date, "now").mockReturnValue(Date.parse(iso));

let fetchSpy;
let plannedCalls;

// A reply as fetch gives it
const jsonReply = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
// The next call to the source gets this response
const sourceGives = (response) => {
  plannedCalls += 1;
  fetchSpy.mockResolvedValueOnce(response);
};
// The next call to the source gets 200 and this list
const sourceAnswers = (rows) => sourceGives(jsonReply(rows));
// The next call to the source fails
const sourceFails = (error) => {
  plannedCalls += 1;
  fetchSpy.mockRejectedValueOnce(error);
};

const quietLog = () =>
  jest.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  plannedCalls = 0;
  fetchSpy = jest
    .spyOn(global, "fetch")
    .mockRejectedValue(new Error("real network in a test"));
  pinNow(TODAY);
});

afterEach(() => {
  try {
    // Every call to the source was one the test planned
    expect(fetchSpy).toHaveBeenCalledTimes(plannedCalls);
  } finally {
    jest.restoreAllMocks();
  }
});

describe("config/regularHolidays.js", () => {
  it("holds the ten Regular holidays with the names they are saved under and the source names they answer to", () => {
    expect(config.REGULAR_HOLIDAYS).toStrictEqual([
      { name: "New Year's Day", matches: ["New Year's Day"] },
      { name: "Maundy Thursday", matches: ["Maundy Thursday"] },
      { name: "Good Friday", matches: ["Good Friday"] },
      {
        name: "Araw ng Kagitingan",
        matches: ["Day of Valor", "Day of Valour", "Araw ng Kagitingan"],
      },
      { name: "Labor Day", matches: ["Labour Day", "Labor Day"] },
      { name: "Independence Day", matches: ["Independence Day"] },
      { name: "National Heroes Day", matches: ["National Heroes Day"] },
      { name: "Bonifacio Day", matches: ["Bonifacio Day"] },
      { name: "Christmas Day", matches: ["Christmas Day"] },
      { name: "Rizal Day", matches: ["Rizal Day"] },
    ]);
  });

  it("holds the source address, the time limit and the two row limits", () => {
    expect(config.SOURCE_URL).toBe(
      "https://nagerholidays.com/api/v4/Holidays/PH/{year}",
    );
    expect(config.SOURCE_COUNTRY).toBe("PH");
    expect(config.SOURCE_TIMEOUT_MS).toBe(10000);
    expect(config.MAX_SOURCE_ROWS).toBe(100);
    expect(config.MAX_IMPORT_ROWS).toBe(40);
  });

  it("presets two of the holiday types of config/holidays.js, and names the two sources", () => {
    expect(config.REGULAR_TYPE).toBe(REGULAR);
    expect(config.OTHER_TYPE).toBe(SPECIAL);
    expect(HOLIDAY_TYPE_NAMES).toEqual(
      expect.arrayContaining([config.REGULAR_TYPE, config.OTHER_TYPE]),
    );
    expect(config.HOLIDAY_SOURCES).toStrictEqual({
      MANUAL: "Manual",
      IMPORTED: "Imported",
    });
  });
});

describe("the type and name preset for a source name", () => {
  it.each(config.REGULAR_HOLIDAYS.map(({ name }) => name))(
    "the saved name %s is Regular under that name",
    (name) => {
      expect(presetFor(name)).toStrictEqual({ name, type: REGULAR });
    },
  );

  it.each(
    config.REGULAR_HOLIDAYS.flatMap(({ name, matches }) =>
      matches.map((match) => [match, name]),
    ),
  )("the source name %s is Regular, saved as %s", (match, name) => {
    expect(presetFor(match)).toStrictEqual({ name, type: REGULAR });
  });

  it.each([
    ["LABOUR DAY", "Labor Day"],
    ["  labour   day ", "Labor Day"],
    ["labor day", "Labor Day"],
    ["New Year’s Day", "New Year's Day"],
    ["New Year‘s Day", "New Year's Day"],
    ["NEW  YEAR’S\tDAY", "New Year's Day"],
    ["day of valour", "Araw ng Kagitingan"],
    ["ARAW NG KAGITINGAN", "Araw ng Kagitingan"],
    [" Rizal Day\n", "Rizal Day"],
  ])("%j is Regular, saved as %s", (sourceName, name) => {
    expect(presetFor(sourceName)).toStrictEqual({ name, type: REGULAR });
  });

  it.each([
    "Christmas Eve",
    "All Saints' Day Eve",
    "All Saints' Day",
    "Holy Saturday",
    "Chinese New Year",
    "Ninoy Aquino Day",
    "Feast of the Immaculate Conception of Mary",
    "Last Day of The Year",
    // Never by part
    "Christmas",
    "Day",
    "Christmas Day Eve",
    "Christmas Day (observed)",
    "Rizal",
    "Labor",
    "New Year",
    "New Years Day",
    "Day of Valor and Labour Day",
    "Eid'l Fitr",
    "Eid'l Adha",
  ])("%s is Special Non-Working under its own name", (sourceName) => {
    expect(presetFor(sourceName)).toStrictEqual({
      name: sourceName,
      type: SPECIAL,
    });
  });

  it("keeps the source's own name, trimmed, when it isn't on the table", () => {
    expect(presetFor("  Christmas Eve ")).toStrictEqual({
      name: "Christmas Eve",
      type: SPECIAL,
    });
  });

  it.each([
    ["an empty name", ""],
    ["a name of spaces only", "   "],
    ["null", null],
    ["undefined", undefined],
    ["a number", 5],
    ["a list holding a name", ["Rizal Day"]],
    ["an object", { name: "Rizal Day" }],
  ])("%s is Special Non-Working with no name", (label, sourceName) => {
    expect(presetFor(sourceName)).toStrictEqual({ name: "", type: SPECIAL });
  });

  it("compares names in lower case, spaces trimmed and collapsed, curly apostrophes straight", () => {
    expect(normaliseName("  New   Year’s  DAY ")).toBe("new year's day");
    expect(normaliseName("Labour Day")).toBe("labour day");
    expect(normaliseName("")).toBe("");
    expect(normaliseName(null)).toBe("");
    expect(normaliseName(12)).toBe("");
  });
});

describe("the preview of the 2026 reply", () => {
  it("offers all 18 rows: the 10 Regular ones on their dates under the preset names, the 8 others as Special Non-Working under their own", () => {
    const preview = buildPreview({ year: 2026, reply: REPLY_2026 });

    expect(preview).toStrictEqual({
      year: 2026,
      rows: PREVIEW_2026,
      missingRegular: [],
      leftOut: 0,
    });
    expect(preview.rows).toHaveLength(18);

    const of = (type) =>
      preview.rows
        .filter((row) => row.type === type)
        .map(({ date, name }) => [date, name]);
    expect(of(REGULAR)).toEqual([
      ["2026-01-01", "New Year's Day"],
      ["2026-04-02", "Maundy Thursday"],
      ["2026-04-03", "Good Friday"],
      ["2026-04-09", "Araw ng Kagitingan"],
      ["2026-05-01", "Labor Day"],
      ["2026-06-12", "Independence Day"],
      ["2026-08-31", "National Heroes Day"],
      ["2026-11-30", "Bonifacio Day"],
      ["2026-12-25", "Christmas Day"],
      ["2026-12-30", "Rizal Day"],
    ]);
    expect(of(SPECIAL)).toEqual([
      ["2026-02-17", "Chinese New Year"],
      ["2026-04-04", "Holy Saturday"],
      ["2026-08-21", "Ninoy Aquino Day"],
      ["2026-10-31", "All Saints' Day Eve"],
      ["2026-11-01", "All Saints' Day"],
      ["2026-12-08", "Feast of the Immaculate Conception of Mary"],
      ["2026-12-24", "Christmas Eve"],
      ["2026-12-31", "Last Day of The Year"],
    ]);
  });

  it("keeps the source's own name beside the preset one", () => {
    const { rows } = buildPreview({ year: 2026, reply: REPLY_2026 });

    const renamed = rows
      .filter((row) => row.sourceName !== row.name)
      .map(({ date, sourceName, name }) => [date, sourceName, name]);
    expect(renamed).toEqual([
      ["2026-04-09", "Day of Valor", "Araw ng Kagitingan"],
      ["2026-05-01", "Labour Day", "Labor Day"],
    ]);
  });

  it("marks a row whose date already has a holiday with that holiday's name and type", () => {
    const listed = [
      // As the database gives them: the date at 00:00 UTC
      {
        date: new Date("2026-12-25T00:00:00Z"),
        name: "Pasko",
        type: "Special Working",
      },
      // A listed date the source doesn't have changes nothing
      {
        date: new Date("2026-11-02T00:00:00Z"),
        name: "All Souls' Day",
        type: SPECIAL,
      },
    ];

    const { rows } = buildPreview({ year: 2026, reply: REPLY_2026, listed });

    expect(rows).toHaveLength(18);
    expect(rows.filter((row) => row.listed)).toStrictEqual([
      {
        date: "2026-12-25",
        sourceName: "Christmas Day",
        name: "Christmas Day",
        type: REGULAR,
        listed: { name: "Pasko", type: "Special Working" },
      },
    ]);
  });
});

describe("the Regular holidays the source's list doesn't have", () => {
  const without = (...names) =>
    REPLY_2026.filter((row) => !names.includes(row.name));

  it("lists Rizal Day when the reply has no Rizal Day", () => {
    const preview = buildPreview({
      year: 2026,
      reply: without("Rizal Day"),
    });

    expect(preview.missingRegular).toEqual(["Rizal Day"]);
    expect(preview.rows).toHaveLength(17);
    expect(preview.leftOut).toBe(0);
  });

  it("lists them by the name they are saved under, in the table's order", () => {
    const preview = buildPreview({
      year: 2026,
      reply: without("Rizal Day", "Labour Day", "Day of Valor"),
    });

    expect(preview.missingRegular).toEqual([
      "Araw ng Kagitingan",
      "Labor Day",
      "Rizal Day",
    ]);
  });

  it("lists all ten for an empty reply, and never Eid'l Fitr or Eid'l Adha", () => {
    const preview = buildPreview({ year: 2026, reply: [] });

    expect(preview).toStrictEqual({
      year: 2026,
      rows: [],
      missingRegular: config.REGULAR_HOLIDAYS.map(({ name }) => name),
      leftOut: 0,
    });
    expect(preview.missingRegular).toHaveLength(10);
    expect(preview.missingRegular.join(" ")).not.toMatch(/eid/i);
  });

  it("still lists Rizal Day when its only row is one that is left out, or is named by part", () => {
    const regional = buildPreview({
      year: 2026,
      reply: [
        ...without("Rizal Day"),
        sourceRow("2026-12-30", "Rizal Day", { nationalHoliday: false }),
      ],
    });
    expect(regional.missingRegular).toEqual(["Rizal Day"]);
    expect(regional.leftOut).toBe(1);

    const byPart = buildPreview({
      year: 2026,
      reply: [
        ...without("Rizal Day"),
        sourceRow("2026-12-30", "Rizal Day Eve"),
      ],
    });
    expect(byPart.missingRegular).toEqual(["Rizal Day"]);
    expect(byPart.rows.at(-2)).toMatchObject({
      date: "2026-12-30",
      name: "Rizal Day Eve",
      type: SPECIAL,
    });
  });
});

describe("cleaning the source's reply", () => {
  const DATES_2026 = REPLY_2026.map(({ date }) => date);

  it.each([
    [
      "a row for another country",
      sourceRow("2026-07-04", "Independence Day", { countryCode: "US" }),
    ],
    [
      "a row with no country",
      sourceRow("2026-07-04", "A Day", { countryCode: undefined }),
    ],
    [
      "a regional row (nationalHoliday false)",
      sourceRow("2026-06-24", "Manila Day", { nationalHoliday: false }),
    ],
    ["February 30", sourceRow("2026-02-30", "A Day")],
    ["month 13", sourceRow("2026-13-01", "A Day")],
    ["a date in another format", sourceRow("07/04/2026", "A Day")],
    ["a date with a time", sourceRow("2026-07-04T00:00:00", "A Day")],
    ["a date that is not text", sourceRow(20260704, "A Day")],
    ["no date", sourceRow(undefined, "A Day")],
    ["a 2027 date in a 2026 import", sourceRow("2027-01-01", "New Year's Day")],
    [
      "a 2025 date in a 2026 import",
      sourceRow("2025-12-31", "Last Day of The Year"),
    ],
    ["an empty name", sourceRow("2026-07-04", "")],
    ["a name of spaces only", sourceRow("2026-07-04", "   ")],
    ["a name that is not text", sourceRow("2026-07-04", 5)],
    ["no name", sourceRow("2026-07-04", undefined)],
    ["null instead of a row", null],
    ["text instead of a row", "2026-07-04"],
    ["a list instead of a row", ["2026-07-04", "A Day"]],
  ])("leaves out %s, and counts it", (label, bad) => {
    const { rows, leftOut } = cleanSourceRows(
      [REPLY_2026[0], bad, ...REPLY_2026.slice(1)],
      2026,
    );

    expect(leftOut).toBe(1);
    expect(rows.map(({ date }) => date)).toEqual(DATES_2026);
  });

  it("counts every row it leaves out", () => {
    const preview = buildPreview({
      year: 2026,
      reply: [
        ...REPLY_2026,
        sourceRow("2026-06-24", "Manila Day", { nationalHoliday: false }),
        sourceRow("2026-07-04", "Independence Day", { countryCode: "US" }),
        sourceRow("2026-02-30", "A Day"),
      ],
    });

    expect(preview.leftOut).toBe(3);
    expect(preview.rows).toStrictEqual(PREVIEW_2026);
    expect(preview.missingRegular).toEqual([]);
  });

  it("keeps the first of two rows on one date, and counts the second as left out", () => {
    const { rows, leftOut } = cleanSourceRows(
      [
        sourceRow("2026-12-30", "Rizal Day"),
        sourceRow("2026-12-30", "Company Day"),
        sourceRow("2026-12-31", "Last Day of The Year"),
      ],
      2026,
    );

    expect(rows).toStrictEqual([
      { date: "2026-12-30", sourceName: "Rizal Day" },
      { date: "2026-12-31", sourceName: "Last Day of The Year" },
    ]);
    expect(leftOut).toBe(1);
  });

  it("a left-out row doesn't take its date: a good row after it on the same date is kept", () => {
    const { rows, leftOut } = cleanSourceRows(
      [
        sourceRow("2026-12-30", "Rizal Day", { nationalHoliday: false }),
        sourceRow("2026-12-30", "Rizal Day"),
      ],
      2026,
    );

    expect(rows).toStrictEqual([
      { date: "2026-12-30", sourceName: "Rizal Day" },
    ]);
    expect(leftOut).toBe(1);
  });

  it("keeps a row that doesn't say whether it is national, and one with a list of no regions", () => {
    const { rows, leftOut } = cleanSourceRows(
      [
        sourceRow("2026-12-30", "Rizal Day", { nationalHoliday: undefined }),
        sourceRow("2026-12-31", "Last Day of The Year", {
          subdivisionCodes: [],
        }),
      ],
      2026,
    );

    expect(rows.map(({ date }) => date)).toEqual(["2026-12-30", "2026-12-31"]);
    expect(leftOut).toBe(0);
  });

  it("gives the rows oldest first whatever the source's order, with the name trimmed", () => {
    const { rows } = cleanSourceRows(
      [
        sourceRow("2026-12-30", "  Rizal Day "),
        sourceRow("2026-01-01", "New Year's Day"),
        sourceRow("2026-06-12", "Independence Day"),
      ],
      2026,
    );

    expect(rows).toStrictEqual([
      { date: "2026-01-01", sourceName: "New Year's Day" },
      { date: "2026-06-12", sourceName: "Independence Day" },
      { date: "2026-12-30", sourceName: "Rizal Day" },
    ]);
  });

  it("gives no rows for something that is not a list", () => {
    expect(cleanSourceRows({ value: REPLY_2026 }, 2026)).toStrictEqual({
      rows: [],
      leftOut: 0,
    });
    expect(cleanSourceRows(null, 2026)).toStrictEqual({ rows: [], leftOut: 0 });
  });
});

describe("the call to the source", () => {
  it("asks once, for exactly the year's address, with a signal and nothing else: no body, no headers", async () => {
    const timeout = jest.spyOn(AbortSignal, "timeout");
    sourceAnswers(REPLY_2027);

    const reply = await fetchSourceHolidays(2027);

    expect(reply).toStrictEqual(REPLY_2027);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [address, options] = fetchSpy.mock.calls[0];
    expect(fetchSpy.mock.calls[0]).toHaveLength(2);
    expect(address).toBe(ADDRESS_2027);
    expect(Object.keys(options)).toEqual(["signal"]);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.signal.aborted).toBe(false);
    // The 10-second limit
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledWith(10000);
  });

  it("puts only the year into the address", () => {
    expect(sourceAddress(2026)).toBe(ADDRESS_2026);
    expect(sourceAddress(2027)).toBe(ADDRESS_2027);
  });

  it("throws when the source doesn't answer, answers anything but 200, or answers something that is not a list", async () => {
    sourceFails(new TypeError("fetch failed"));
    await expect(fetchSourceHolidays(2027)).rejects.toThrow(/fetch failed/);

    sourceFails(new DOMException("The operation timed out", "TimeoutError"));
    await expect(fetchSourceHolidays(2027)).rejects.toThrow(/no answer in/);

    sourceGives(jsonReply(REPLY_2027, 404));
    await expect(fetchSourceHolidays(2027)).rejects.toThrow(/answered 404/);

    sourceGives(jsonReply({ value: REPLY_2027 }));
    await expect(fetchSourceHolidays(2027)).rejects.toThrow(/not a list/);
  });

  it("the default fake refuses a call nobody planned", async () => {
    plannedCalls += 1;

    await expect(fetchSourceHolidays(2027)).rejects.toThrow(
      /real network in a test/,
    );
  });
});

describe("the two years an import may be for", () => {
  it("are this Manila year and the next", () => {
    expect(importYears("2026-11-13")).toEqual([2026, 2027]);
    expect(importYears("2026-12-31")).toEqual([2026, 2027]);
    expect(importYears("2027-01-01")).toEqual([2027, 2028]);
    // From the pinned clock
    expect(importYears()).toEqual([2026, 2027]);
  });

  it("change at midnight in Manila, not at midnight UTC", () => {
    // 23:59:59 on December 31, 2026 in Manila
    pinNow("2026-12-31T15:59:59Z");
    expect(importYears()).toEqual([2026, 2027]);
    // 00:00:00 on January 1, 2027 in Manila: still December 31 in UTC
    pinNow("2026-12-31T16:00:00Z");
    expect(importYears()).toEqual([2027, 2028]);
  });

  it("a year is taken as four digits of text or as a whole number, and has to be one of the two", () => {
    expect(checkImportYear("2026")).toStrictEqual({ year: 2026 });
    expect(checkImportYear("2027")).toStrictEqual({ year: 2027 });
    expect(checkImportYear(2027)).toStrictEqual({ year: 2027 });

    for (const year of ["2025", "2028", 2025, 2028, "1800", "9999"]) {
      expect([year, checkImportYear(year)]).toEqual([
        year,
        { error: YEAR_WINDOW },
      ]);
    }
    for (const year of [
      undefined,
      null,
      "",
      "27",
      "20277",
      "abcd",
      " 2027",
      "2027.0",
      "-2027",
      2027.5,
      -2027,
      27,
      NaN,
      true,
      ["2027"],
      { year: 2027 },
    ]) {
      expect([year, checkImportYear(year)]).toEqual([
        year,
        { error: YEAR_FORMAT },
      ]);
    }

    expect(checkImportYear("2026", "2027-01-01")).toStrictEqual({
      error: "Holidays can be imported for 2027 or 2028 only.",
    });
    expect(checkImportYear("2028", "2027-01-01")).toStrictEqual({ year: 2028 });
  });
});

describe("the checks of a Save, without the database", () => {
  it("gives the rows ready to save, oldest first, the dates at 00:00 UTC and the names trimmed", () => {
    const checked = checkImport({
      year: 2027,
      holidays: [
        { date: "2027-12-25", name: " Christmas Day ", type: REGULAR },
        { date: "2027-01-01", name: "New Year's Day", type: REGULAR },
        {
          date: "2027-11-01",
          name: "All Saints' Day",
          type: "Special Working",
        },
      ],
    });

    expect(checked).toStrictEqual({
      year: 2027,
      rows: [
        {
          key: "2027-01-01",
          date: new Date("2027-01-01T00:00:00Z"),
          name: "New Year's Day",
          type: REGULAR,
        },
        {
          key: "2027-11-01",
          date: new Date("2027-11-01T00:00:00Z"),
          name: "All Saints' Day",
          type: "Special Working",
        },
        {
          key: "2027-12-25",
          date: new Date("2027-12-25T00:00:00Z"),
          name: "Christmas Day",
          type: REGULAR,
        },
      ],
    });
  });

  it("refuses a request that is not there at all with the year message", () => {
    for (const body of [undefined, null, "2027", 2027, []]) {
      expect(checkImport(body)).toStrictEqual({ error: YEAR_FORMAT });
    }
  });

  it("uses the Add form's own checks and messages for a row", () => {
    expect(isCalendarDay("2027-02-28")).toBe(true);
    expect(isCalendarDay("2027-02-29")).toBe(false);
    expect(isCalendarDay("2028-02-29")).toBe(true);
    expect(checkHoliday({})).toStrictEqual({ error: BAD_DATE });
    expect(checkHoliday({ date: "2027-01-01" })).toStrictEqual({
      error: NO_NAME,
    });
    expect(
      checkHoliday({ date: "2027-01-01", name: "New Year's Day" }),
    ).toStrictEqual({ error: BAD_TYPE });
  });

  it("writes a date as MM/DD/YY in a message", () => {
    expect(toShortDate("2027-04-09")).toBe("04/09/27");
    expect(toShortDate("2026-12-31")).toBe("12/31/26");
  });

  it("words the message of a Save for one, for several, and with skipped dates", () => {
    expect(importMessage(2027, 16)).toBe("Saved 16 holidays for 2027.");
    expect(importMessage(2027, 1)).toBe("Saved 1 holiday for 2027.");
    expect(importMessage(2026, 2, [])).toBe("Saved 2 holidays for 2026.");
    expect(importMessage(2027, 15, ["2027-04-09"])).toBe(
      "Saved 15 holidays for 2027. Skipped 1 that already had a holiday: 04/09/27.",
    );
    expect(importMessage(2027, 1, ["2027-04-09", "2027-05-01"])).toBe(
      "Saved 1 holiday for 2027. Skipped 2 that already had a holiday: 04/09/27, 05/01/27.",
    );
  });
});

describe("/api/holidays: the import", () => {
  const PASSWORD = "Password123!";
  const DENIED = {
    message: "You do not have access to this page",
    code: "PAGE_ACCESS_DENIED",
  };
  const ADMIN_ONLY = { message: "Admin access required" };
  // A database fault's own text: never in a reply
  const RAW_DETAIL = "E11000 raw detail holidays.$date_1 at db-host:27017";

  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    // The unique index on the date has to exist before the tests that rely on it
    await Holiday.init();
  });

  afterEach(async () => {
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
  const preview = (token, query = "?year=2027") =>
    request(app).get(`/api/holidays/import-preview${query}`).set(as(token));
  const save = (token, body) =>
    request(app).post("/api/holidays/import").set(as(token)).send(body);
  const list = (token, query = "") =>
    request(app).get(`/api/holidays${query}`).set(as(token));
  const add = (token, body) =>
    request(app).post("/api/holidays").set(as(token)).send(body);
  const remove = (token, id) =>
    request(app).delete(`/api/holidays/${id}`).set(as(token));

  // Saved straight to the model, as a holiday that is already on the list
  const saveHoliday = (date, name = "Holiday", type = REGULAR) =>
    Holiday.create({ date: new Date(`${date}T00:00:00Z`), name, type });

  // Everything stored, oldest first, as plain values
  const stored = async () =>
    (await Holiday.find().sort({ date: 1 }).lean()).map((holiday) => ({
      date: holiday.date.toISOString(),
      name: holiday.name,
      type: holiday.type,
      source: holiday.source,
      createdBy: holiday.createdBy ? String(holiday.createdBy) : null,
    }));
  const storedDays = async () =>
    (await stored()).map(({ date }) => date.slice(0, 10));

  const expectRefused = async (res, message, status = 400) => {
    expect([res.status, res.body]).toEqual([status, { message }]);
    expect(await Holiday.countDocuments()).toBe(0);
  };

  describe("GET /api/holidays/import-preview", () => {
    it("answers the year's rows with their presets, and saves nothing", async () => {
      const { token } = await superAdmin();
      sourceAnswers(REPLY_2027);

      const res = await preview(token, "?year=2027");

      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        year: 2027,
        rows: PREVIEW_2027,
        missingRegular: [],
        leftOut: 0,
      });
      expect(res.body.rows).toHaveLength(18);
      expect(res.body.rows.filter(({ type }) => type === REGULAR)).toHaveLength(
        10,
      );
      expect(await Holiday.countDocuments()).toBe(0);
    });

    it("asks the source once, for that year and PH only", async () => {
      const { token } = await superAdmin();
      sourceAnswers(REPLY_2027);

      await preview(token, "?year=2027");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [address, options] = fetchSpy.mock.calls[0];
      expect(address).toBe(ADDRESS_2027);
      expect(Object.keys(options)).toEqual(["signal"]);
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    it("offers this year too, past dates included", async () => {
      const { token } = await superAdmin();
      sourceAnswers(REPLY_2026);

      const res = await preview(token, "?year=2026");

      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        year: 2026,
        rows: PREVIEW_2026,
        missingRegular: [],
        leftOut: 0,
      });
      expect(fetchSpy.mock.calls[0][0]).toBe(ADDRESS_2026);
      // January 1 is long past on November 13
      expect(res.body.rows[0]).toMatchObject({
        date: "2026-01-01",
        listed: null,
      });
    });

    it("marks the dates that already have a holiday with its name and type, and leaves the list as it was", async () => {
      const { token } = await superAdmin();
      await saveHoliday("2027-04-09", "Araw ng Kagitingan", REGULAR);
      await saveHoliday(
        "2027-12-31",
        "Year-end Company Day",
        "Special Working",
      );
      // Not the source's dates, or not this year: no row for them
      await saveHoliday("2027-11-02", "All Souls' Day", SPECIAL);
      await saveHoliday("2026-12-25", "Christmas Day", REGULAR);
      const before = await stored();
      sourceAnswers(REPLY_2027);

      const res = await preview(token, "?year=2027");

      expect(res.status).toBe(200);
      expect(res.body.rows).toHaveLength(18);
      expect(res.body.rows.filter((row) => row.listed)).toStrictEqual([
        {
          date: "2027-04-09",
          sourceName: "Day of Valor",
          name: "Araw ng Kagitingan",
          type: REGULAR,
          listed: { name: "Araw ng Kagitingan", type: REGULAR },
        },
        {
          date: "2027-12-31",
          sourceName: "Last Day of The Year",
          name: "Last Day of The Year",
          type: SPECIAL,
          listed: { name: "Year-end Company Day", type: "Special Working" },
        },
      ]);
      expect(res.body.rows.filter((row) => row.listed === null)).toHaveLength(
        16,
      );
      expect(await stored()).toStrictEqual(before);
    });

    it("says which Regular holidays the list doesn't have and how many rows were left out", async () => {
      const { token } = await superAdmin();
      sourceAnswers([
        ...REPLY_2027.filter(({ name }) => name !== "Rizal Day"),
        sourceRow("2027-06-24", "Manila Day", { nationalHoliday: false }),
        sourceRow("2028-01-01", "New Year's Day"),
      ]);

      const res = await preview(token, "?year=2027");

      expect(res.status).toBe(200);
      expect(res.body.rows).toHaveLength(17);
      expect(res.body.missingRegular).toEqual(["Rizal Day"]);
      expect(res.body.leftOut).toBe(2);
    });

    it("lets an Admin with the Calendar tick preview", async () => {
      const { token } = await adminWithCalendar();
      sourceAnswers(REPLY_2027);

      const res = await preview(token);

      expect(res.status).toBe(200);
      expect(res.body.rows).toHaveLength(18);
    });

    describe("who may preview: a refused caller never causes a call to the source", () => {
      it("refuses an Admin without the Calendar tick: 403 PAGE_ACCESS_DENIED", async () => {
        const { token } = await adminWithoutCalendar();

        const res = await preview(token);

        expect(res.status).toBe(403);
        expect(res.body).toEqual(DENIED);
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it("refuses an Admin with no ticks stored at all", async () => {
        const { token } = await account("hr.new", "Admin");

        const res = await preview(token);

        expect(res.status).toBe(403);
        expect(res.body).toEqual(DENIED);
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it("refuses an Employee: 403, even one with the employee Calendar page", async () => {
        const { token } = await employee({
          pageAccess: ["dashboard", "calendar"],
        });

        const res = await preview(token);

        expect(res.status).toBe(403);
        expect(res.body).toEqual(ADMIN_ONLY);
        expect(res.body).not.toHaveProperty("rows");
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it("refuses a request without a sign-in token: 401", async () => {
        const res = await request(app).get(
          "/api/holidays/import-preview?year=2027",
        );

        expect(res.status).toBe(401);
        expect(res.body).not.toHaveProperty("rows");
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it("checks who is asking before the year: no hint about the year to a refused caller", async () => {
        const { token } = await adminWithoutCalendar();
        const { token: employeeToken } = await employee();

        for (const query of ["", "?year=abcd", "?year=2031"]) {
          const admin = await preview(token, query);
          expect([query, admin.status, admin.body]).toEqual([
            query,
            403,
            DENIED,
          ]);
          const staff = await preview(employeeToken, query);
          expect([query, staff.status, staff.body]).toEqual([
            query,
            403,
            ADMIN_ONLY,
          ]);
          const nobody = await request(app).get(
            `/api/holidays/import-preview${query}`,
          );
          expect([query, nobody.status]).toEqual([query, 401]);
        }
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it("takes the tick away on the Admin's next request, without a new sign-in", async () => {
        const { user, token } = await adminWithCalendar();
        sourceAnswers(REPLY_2027);
        expect((await preview(token)).status).toBe(200);

        await User.updateOne({ _id: user._id }, { pageAccess: ["employees"] });

        const res = await preview(token);
        expect(res.status).toBe(403);
        expect(res.body).toEqual(DENIED);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe("the year: checked before anything goes out", () => {
      it.each([
        ["no year", ""],
        ["two digits", "?year=27"],
        ["five digits", "?year=20277"],
        ["letters", "?year=abcd"],
        ["an empty year", "?year="],
        ["a year with a decimal point", "?year=2027.0"],
        ["a year with a space", "?year=%202027"],
        ["a negative year", "?year=-2027"],
        ["a full date", "?year=2027-01-01"],
        ["the year sent twice", "?year=2026&year=2027"],
        ["the year sent as a list", "?year[]=2027"],
        ["an address in place of the year", "?year=2027%2F..%2F..%2Fx"],
      ])("refuses %s", async (label, query) => {
        const { token } = await superAdmin();

        const res = await preview(token, query);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: YEAR_FORMAT });
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it.each([
        ["last year", "2025"],
        ["the year after next", "2028"],
        ["a far year (a slip of the year arrows)", "2031"],
        ["a year the source doesn't have", "1800"],
        ["year 0000", "0000"],
      ])("refuses %s, naming the two years it can be", async (label, year) => {
        const { token } = await superAdmin();

        const res = await preview(token, `?year=${year}`);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ message: YEAR_WINDOW });
        expect(fetchSpy).not.toHaveBeenCalled();
      });

      it("moves with today: 2026 and 2027 on December 31, 2026; 2027 and 2028 from January 1, 2027 (Manila)", async () => {
        // 23:59:59 on December 31, 2026 in Manila
        pinNow("2026-12-31T15:59:59Z");
        const { token } = await superAdmin();

        sourceAnswers(REPLY_2026);
        expect((await preview(token, "?year=2026")).status).toBe(200);
        sourceAnswers(REPLY_2027);
        expect((await preview(token, "?year=2027")).status).toBe(200);
        const tooLate = await preview(token, "?year=2028");
        expect([tooLate.status, tooLate.body]).toEqual([
          400,
          { message: YEAR_WINDOW },
        ]);

        // One second later: 00:00:00 on January 1, 2027 in Manila (16:00 UTC, still
        // December 31 there)
        pinNow("2026-12-31T16:00:00Z");

        const tooOld = await preview(token, "?year=2026");
        expect([tooOld.status, tooOld.body]).toEqual([
          400,
          { message: "Holidays can be imported for 2027 or 2028 only." },
        ]);
        sourceAnswers(REPLY_2027);
        expect((await preview(token, "?year=2027")).status).toBe(200);
        sourceAnswers([]);
        const next = await preview(token, "?year=2028");
        expect(next.status).toBe(200);
        expect(next.body.year).toBe(2028);

        expect(fetchSpy.mock.calls.map(([address]) => address)).toEqual([
          ADDRESS_2026,
          ADDRESS_2027,
          ADDRESS_2027,
          "https://nagerholidays.com/api/v4/Holidays/PH/2028",
        ]);
      });
    });

    describe("the source is down", () => {
      const junk = (count) =>
        Array.from({ length: count }, (unused, index) =>
          sourceRow("2027-02-30", `Row ${index + 1}`),
        );

      it.each([
        [
          "doesn't answer (a network error)",
          () => sourceFails(new TypeError("fetch failed")),
        ],
        [
          "takes longer than the limit (a TimeoutError)",
          () =>
            sourceFails(
              new DOMException(
                "The operation was aborted due to timeout",
                "TimeoutError",
              ),
            ),
        ],
        [
          "is cut off (an AbortError)",
          () =>
            sourceFails(
              new DOMException("This operation was aborted", "AbortError"),
            ),
        ],
        [
          "answers 500",
          () => sourceGives(jsonReply({ title: "Internal Server Error" }, 500)),
        ],
        [
          "answers 404",
          () => sourceGives(jsonReply({ title: "Unknown country code" }, 404)),
        ],
        [
          "answers 400",
          () =>
            sourceGives(
              jsonReply(
                { title: "One or more validation errors occurred." },
                400,
              ),
            ),
        ],
        [
          "answers 204 with nothing",
          () => sourceGives(new Response(null, { status: 204 })),
        ],
        [
          "answers 201 with a good list",
          () => sourceGives(jsonReply(REPLY_2027, 201)),
        ],
        [
          "answers a JSON object",
          () => sourceGives(jsonReply({ value: REPLY_2027 })),
        ],
        ["answers JSON null", () => sourceGives(jsonReply(null))],
        ["answers JSON text", () => sourceGives(jsonReply("2027"))],
        [
          "answers a list of 101 rows",
          () => sourceGives(jsonReply([...REPLY_2027, ...junk(83)])),
        ],
        [
          "answers something that is not JSON (json() throws)",
          () =>
            sourceGives(
              new Response("<html>Down for maintenance</html>", {
                status: 200,
              }),
            ),
        ],
        [
          "answers nothing at all with 200",
          () => sourceGives(new Response("", { status: 200 })),
        ],
      ])(
        "when the source %s: 502 with the one message, nothing saved",
        async (label, plan) => {
          const { token } = await superAdmin();
          await saveHoliday("2027-04-09", "Araw ng Kagitingan");
          const before = await stored();
          const log = quietLog();
          plan();

          const res = await preview(token, "?year=2027");

          expect(res.status).toBe(502);
          expect(res.body).toStrictEqual({ message: SOURCE_DOWN });
          expect(fetchSpy).toHaveBeenCalledTimes(1);
          expect(await stored()).toStrictEqual(before);
          // The reason is logged on the server, not sent
          expect(log).toHaveBeenCalledTimes(1);
        },
      );

      it("takes a list of exactly 100 rows", async () => {
        const { token } = await superAdmin();
        sourceAnswers([...REPLY_2027, ...junk(82)]);

        const res = await preview(token, "?year=2027");

        expect(res.status).toBe(200);
        expect(res.body.rows).toHaveLength(18);
        expect(res.body.leftOut).toBe(82);
      });

      it("asks again on the next click (no retry, nothing kept), and manual Add still works meanwhile", async () => {
        const { token } = await superAdmin();
        quietLog();
        sourceFails(new TypeError("fetch failed"));

        expect((await preview(token)).status).toBe(502);
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        const added = await add(token, NEW_YEAR_2027);
        expect(added.status).toBe(201);

        sourceAnswers(REPLY_2027);
        const again = await preview(token);
        expect(again.status).toBe(200);
        expect(again.body.rows[0].listed).toStrictEqual({
          name: "New Year's Day",
          type: REGULAR,
        });
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      });
    });

    it("answers 500 with the fixed message only when the list can't be read, and logs the fault", async () => {
      const { token } = await superAdmin();
      const log = quietLog();
      sourceAnswers(REPLY_2027);
      jest.spyOn(Holiday, "find").mockImplementation(() => {
        throw new Error(RAW_DETAIL);
      });

      const res = await preview(token, "?year=2027");

      expect(res.status).toBe(500);
      expect(res.body).toStrictEqual({ message: "Error reading the holidays" });
      expect(JSON.stringify(res.body)).not.toContain("raw detail");
      expect(
        log.mock.calls.some((args) =>
          args.some((arg) => String(arg?.message ?? arg).includes(RAW_DETAIL)),
        ),
      ).toBe(true);
    });
  });

  describe("POST /api/holidays/import", () => {
    it("saves the ticked rows: 201, 'Saved 16 holidays for 2027.', each stored at 00:00 UTC as Imported with who saved it", async () => {
      const { user, token } = await superAdmin();

      const res = await save(token, { year: 2027, holidays: SIXTEEN_2027 });

      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual([
        "message",
        "saved",
        "skipped",
      ]);
      expect(res.body.message).toBe("Saved 16 holidays for 2027.");
      expect(res.body.skipped).toStrictEqual([]);
      expect(res.body.saved).toHaveLength(16);
      expect(
        res.body.saved.map(({ id, ...rest }) => {
          expect(mongoose.isValidObjectId(id)).toBe(true);
          return rest;
        }),
      ).toStrictEqual(
        SIXTEEN_2027.map((row) => ({ ...row, source: "Imported" })),
      );

      expect(await stored()).toStrictEqual(
        SIXTEEN_2027.map(({ date, name, type }) => ({
          date: `${date}T00:00:00.000Z`,
          name,
          type,
          source: "Imported",
          createdBy: String(user._id),
        })),
      );

      // The list gives them exactly as the Save did
      const listed = await list(token, "?year=2027");
      expect(listed.body).toStrictEqual(res.body.saved);
    });

    it("saves one: 'Saved 1 holiday for 2027.'", async () => {
      const { token } = await superAdmin();

      const res = await save(token, { year: 2027, holidays: [NEW_YEAR_2027] });

      expect(res.status).toBe(201);
      expect(res.body).toStrictEqual({
        message: "Saved 1 holiday for 2027.",
        saved: [
          {
            id: String((await Holiday.findOne().lean())._id),
            ...NEW_YEAR_2027,
            source: "Imported",
          },
        ],
        skipped: [],
      });
    });

    it("saves this year's rows too, past dates included", async () => {
      const { token } = await superAdmin();

      const res = await save(token, {
        year: 2026,
        holidays: ticked(PREVIEW_2026),
      });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Saved 18 holidays for 2026.");
      expect(await storedDays()).toEqual(REPLY_2026.map(({ date }) => date));
    });

    it("saves the name and type as the Admin left them in the preview, not as the source or the table has them", async () => {
      const { token } = await superAdmin();

      const res = await save(token, {
        year: 2027,
        holidays: [
          { date: "2027-12-31", name: "Year-end Day", type: "Special Working" },
          { date: "2027-12-24", name: "Christmas Eve", type: REGULAR },
          { date: "2027-05-01", name: "Labour Day", type: SPECIAL },
        ],
      });

      expect(res.status).toBe(201);
      expect(
        (await stored()).map(({ date, name, type }) => [
          date.slice(0, 10),
          name,
          type,
        ]),
      ).toEqual([
        ["2027-05-01", "Labour Day", SPECIAL],
        ["2027-12-24", "Christmas Eve", REGULAR],
        ["2027-12-31", "Year-end Day", "Special Working"],
      ]);
    });

    it("gives the saved holidays oldest first whatever the order sent, trims names, and ignores any other field", async () => {
      const { user, token } = await superAdmin();
      const someoneElse = String(new mongoose.Types.ObjectId());

      const res = await save(token, {
        year: "2027",
        createdBy: someoneElse,
        source: "Manual",
        holidays: [
          { date: "2027-12-25", name: "  Christmas Day ", type: REGULAR },
          {
            date: "2027-01-01",
            name: "New Year's Day",
            type: REGULAR,
            source: "Manual",
            createdBy: someoneElse,
            _id: someoneElse,
            sourceName: "New Year's Day",
            listed: null,
          },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Saved 2 holidays for 2027.");
      expect(res.body.saved.map(({ date, name }) => [date, name])).toEqual([
        ["2027-01-01", "New Year's Day"],
        ["2027-12-25", "Christmas Day"],
      ]);
      const saved = await Holiday.find().sort({ date: 1 }).lean();
      expect(saved.map(({ source }) => source)).toEqual([
        "Imported",
        "Imported",
      ]);
      for (const holiday of saved) {
        expect(String(holiday.createdBy)).toBe(String(user._id));
        expect(String(holiday._id)).not.toBe(someoneElse);
        expect(holiday).not.toHaveProperty("sourceName");
        expect(holiday).not.toHaveProperty("listed");
      }
    });

    it("takes 40 rows", async () => {
      const { token } = await superAdmin();
      const holidays = Array.from({ length: 40 }, (unused, index) => ({
        date:
          index < 31
            ? `2027-01-${String(index + 1).padStart(2, "0")}`
            : `2027-03-${String(index - 30).padStart(2, "0")}`,
        name: `Day ${index + 1}`,
        type: SPECIAL,
      }));

      const res = await save(token, { year: 2027, holidays });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Saved 40 holidays for 2027.");
      expect(await Holiday.countDocuments()).toBe(40);
    });

    it("lets an Admin with the Calendar tick save, and records it as the one who saved", async () => {
      const { user, token } = await adminWithCalendar();

      const res = await save(token, { year: 2027, holidays: [NEW_YEAR_2027] });

      expect(res.status).toBe(201);
      expect(await stored()).toStrictEqual([
        {
          date: "2027-01-01T00:00:00.000Z",
          name: "New Year's Day",
          type: REGULAR,
          source: "Imported",
          createdBy: String(user._id),
        },
      ]);
    });

    it("never asks the source: the rows are trusted as the Add form's", async () => {
      const { token } = await superAdmin();

      // Not a name or a date Nager.Date has
      const res = await save(token, {
        year: 2027,
        holidays: [
          { date: "2027-07-15", name: "Company Day", type: "Special Working" },
        ],
      });

      expect(res.status).toBe(201);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    describe("dates that already have a holiday", () => {
      it("skips a taken date and names it as MM/DD/YY, saving the rest", async () => {
        const { token } = await superAdmin();
        await saveHoliday(
          "2027-04-09",
          "Araw ng Kagitingan (by hand)",
          SPECIAL,
        );
        const rows = ALL_2027.filter(({ date }) => date !== "2027-12-24");
        expect(rows).toHaveLength(17);

        const res = await save(token, { year: 2027, holidays: rows });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe(
          "Saved 16 holidays for 2027. Skipped 1 that already had a holiday: 04/09/27.",
        );
        expect(res.body.skipped).toStrictEqual(["2027-04-09"]);
        expect(res.body.saved.map(({ date }) => date)).toEqual(
          SIXTEEN_2027.map(({ date }) => date),
        );
        expect(await Holiday.countDocuments()).toBe(17);
        // The holiday that was there is as it was
        const kept = await Holiday.findOne({
          date: new Date("2027-04-09T00:00:00Z"),
        }).lean();
        expect([kept.name, kept.type, kept.source, kept.createdBy]).toEqual([
          "Araw ng Kagitingan (by hand)",
          SPECIAL,
          "Manual",
          null,
        ]);
      });

      it("words the plan's example: 15 saved, 1 skipped", async () => {
        const { token } = await superAdmin();
        await saveHoliday("2027-04-09", "Araw ng Kagitingan");
        const rows = ALL_2027.filter(
          ({ date }) => date !== "2027-12-24" && date !== "2027-12-31",
        );

        const res = await save(token, { year: 2027, holidays: rows });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe(
          "Saved 15 holidays for 2027. Skipped 1 that already had a holiday: 04/09/27.",
        );
      });

      it("names several skipped dates oldest first, with commas", async () => {
        const { token } = await superAdmin();
        await saveHoliday("2027-12-25", "Christmas Day");
        await saveHoliday("2027-04-09", "Araw ng Kagitingan");
        await saveHoliday("2027-05-01", "Labor Day");

        const res = await save(token, {
          year: 2027,
          // Sent newest first
          holidays: [...ALL_2027].reverse(),
        });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe(
          "Saved 15 holidays for 2027. Skipped 3 that already had a holiday: 04/09/27, 05/01/27, 12/25/27.",
        );
        expect(res.body.skipped).toStrictEqual([
          "2027-04-09",
          "2027-05-01",
          "2027-12-25",
        ]);
        expect(await Holiday.countDocuments()).toBe(18);
      });

      it("answers 409 and saves nothing when every ticked date is taken", async () => {
        const { token } = await superAdmin();
        await saveHoliday("2027-01-01", "New Year (by hand)");
        await saveHoliday("2027-12-25", "Christmas (by hand)");
        const before = await stored();

        const res = await save(token, {
          year: 2027,
          holidays: [
            NEW_YEAR_2027,
            { date: "2027-12-25", name: "Christmas Day", type: REGULAR },
          ],
        });

        expect(res.status).toBe(409);
        expect(res.body).toStrictEqual({ message: ALL_TAKEN });
        expect(await stored()).toStrictEqual(before);
      });

      it("a second Save of the same rows saves nothing more: 409", async () => {
        const { token } = await superAdmin();
        const body = { year: 2027, holidays: SIXTEEN_2027 };
        expect((await save(token, body)).status).toBe(201);
        const before = await stored();

        const res = await save(token, body);

        expect(res.status).toBe(409);
        expect(res.body).toStrictEqual({ message: ALL_TAKEN });
        expect(await stored()).toStrictEqual(before);
      });

      // What the route gets when it looks for taken dates and finds none, although one
      // is taken: another request saved it after this one looked, so only the unique
      // index on the date is left to refuse it
      const lookedTooEarly = () =>
        jest.spyOn(Holiday, "find").mockReturnValueOnce({
          select: () => ({ lean: async () => [] }),
        });

      it("skips a date taken at the same moment (the unique index refuses it): 201, not 500", async () => {
        const { token } = await superAdmin();
        await saveHoliday("2027-04-09", "Araw ng Kagitingan");
        const log = quietLog();
        lookedTooEarly();

        const res = await save(token, {
          year: 2027,
          holidays: ALL_2027.filter(({ date }) => date <= "2027-05-01"),
        });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe(
          "Saved 6 holidays for 2027. Skipped 1 that already had a holiday: 04/09/27.",
        );
        expect(res.body.skipped).toStrictEqual(["2027-04-09"]);
        expect(await Holiday.countDocuments()).toBe(7);
        expect(log).not.toHaveBeenCalled();
      });

      it("answers 409, not 500, when every date was taken at the same moment", async () => {
        const { token } = await superAdmin();
        await saveHoliday("2027-01-01", "New Year's Day");
        const log = quietLog();
        lookedTooEarly();

        const res = await save(token, {
          year: 2027,
          holidays: [NEW_YEAR_2027],
        });

        expect(res.status).toBe(409);
        expect(res.body).toStrictEqual({ message: ALL_TAKEN });
        expect(await Holiday.countDocuments()).toBe(1);
        expect(log).not.toHaveBeenCalled();
      });

      it("two Saves of the same rows at once save each date once, and neither answers 500", async () => {
        const { token } = await superAdmin();
        const { token: otherToken } = await adminWithCalendar();
        const body = { year: 2027, holidays: SIXTEEN_2027 };
        const days = SIXTEEN_2027.map(({ date }) => date);

        const replies = await Promise.all([
          save(token, body),
          save(otherToken, body),
        ]);

        expect(await storedDays()).toEqual(days);
        for (const res of replies) {
          expect([201, 409]).toContain(res.status);
          if (res.status === 201) {
            // Every row is accounted for: saved by this request or skipped
            expect(
              [
                ...res.body.saved.map(({ date }) => date),
                ...res.body.skipped,
              ].sort(),
            ).toEqual(days);
          } else {
            expect(res.body).toStrictEqual({ message: ALL_TAKEN });
          }
        }
        // Each date was saved by exactly one of the two
        expect(
          replies
            .flatMap((res) => (res.body.saved || []).map(({ date }) => date))
            .sort(),
        ).toEqual(days);
      });
    });

    describe("refusals: nothing is saved", () => {
      it.each([
        ["no list", { year: 2027 }],
        ["an empty list", { year: 2027, holidays: [] }],
        [
          "a holiday instead of a list",
          { year: 2027, holidays: NEW_YEAR_2027 },
        ],
        ["text instead of a list", { year: 2027, holidays: "2027-01-01" }],
        ["a number instead of a list", { year: 2027, holidays: 16 }],
        ["null instead of a list", { year: 2027, holidays: null }],
      ])(
        "refuses %s: 'Tick at least one holiday to save.'",
        async (label, body) => {
          const { token } = await superAdmin();

          await expectRefused(await save(token, body), NOTHING_TICKED);
        },
      );

      it("refuses 41 rows, good ones included", async () => {
        const { token } = await superAdmin();
        const holidays = Array.from({ length: 41 }, (unused, index) => ({
          date:
            index < 31
              ? `2027-01-${String(index + 1).padStart(2, "0")}`
              : `2027-03-${String(index - 30).padStart(2, "0")}`,
          name: `Day ${index + 1}`,
          type: SPECIAL,
        }));

        await expectRefused(
          await save(token, { year: 2027, holidays }),
          TOO_MANY,
        );
      });

      it.each([
        ["no year", undefined],
        ["two digits", "27"],
        ["two digits as a number", 27],
        ["five digits", 20277],
        ["letters", "abcd"],
        ["an empty year", ""],
        ["a year with a decimal part", 2027.5],
        ["a negative year", -2027],
        ["null", null],
        ["true", true],
        ["a list holding the year", [2027]],
        ["an object", { value: 2027 }],
      ])(
        "refuses %s as the year: 'Enter the year as four digits.'",
        async (label, year) => {
          const { token } = await superAdmin();

          await expectRefused(
            await save(token, { year, holidays: SIXTEEN_2027 }),
            YEAR_FORMAT,
          );
        },
      );

      it.each([
        ["last year", 2025, { ...NEW_YEAR_2027, date: "2025-01-01" }],
        ["the year after next", 2028, { ...NEW_YEAR_2027, date: "2028-01-01" }],
        [
          "the year after next, as text",
          "2028",
          { ...NEW_YEAR_2027, date: "2028-01-01" },
        ],
        ["a far year", 2031, { ...NEW_YEAR_2027, date: "2031-01-01" }],
      ])(
        "refuses %s, naming the two years it can be",
        async (label, year, row) => {
          const { token } = await superAdmin();

          await expectRefused(
            await save(token, { year, holidays: [row] }),
            YEAR_WINDOW,
          );
        },
      );

      it("the two years move with today, as on the preview", async () => {
        // 00:00 on January 1, 2027 in Manila
        pinNow("2026-12-31T16:00:00Z");
        const { token } = await superAdmin();

        await expectRefused(
          await save(token, {
            year: 2026,
            holidays: [{ ...NEW_YEAR_2027, date: "2026-12-31" }],
          }),
          "Holidays can be imported for 2027 or 2028 only.",
        );

        const res = await save(token, {
          year: 2028,
          holidays: [{ ...NEW_YEAR_2027, date: "2028-01-01" }],
        });
        expect(res.status).toBe(201);
        expect(res.body.message).toBe("Saved 1 holiday for 2028.");
      });

      // The third row of three is the bad one; the other two could be saved
      const withThird = (row) => ({
        year: 2027,
        holidays: [
          NEW_YEAR_2027,
          { date: "2027-12-25", name: "Christmas Day", type: REGULAR },
          row,
        ],
      });

      it.each([
        ["no date", { name: "A Day", type: REGULAR }],
        ["an empty date", { date: "", name: "A Day", type: REGULAR }],
        [
          "a date in another format",
          { date: "04/09/2027", name: "A Day", type: REGULAR },
        ],
        ["February 30", { date: "2027-02-30", name: "A Day", type: REGULAR }],
        [
          "February 29 of a year that has none",
          { date: "2027-02-29", name: "A Day", type: REGULAR },
        ],
        [
          "a date with a time",
          { date: "2027-04-09T00:00:00Z", name: "A Day", type: REGULAR },
        ],
        [
          "a date that is a number",
          { date: 20270409, name: "A Day", type: REGULAR },
        ],
        ["null instead of a row", null],
        ["text instead of a row", "2027-04-09"],
        ["a list instead of a row", ["2027-04-09", "A Day", REGULAR]],
      ])(
        "refuses %s, naming the row by its place: 'Row 3: Enter the date as a valid date.'",
        async (label, row) => {
          const { token } = await superAdmin();

          await expectRefused(
            await save(token, withThird(row)),
            `Row 3: ${BAD_DATE}`,
          );
        },
      );

      it.each([
        ["no name", { date: "2027-04-09", type: REGULAR }],
        ["an empty name", { date: "2027-04-09", name: "", type: REGULAR }],
        [
          "a name of spaces only",
          { date: "2027-04-09", name: "   ", type: REGULAR },
        ],
        [
          "a name that is a number",
          { date: "2027-04-09", name: 5, type: REGULAR },
        ],
      ])(
        "refuses %s, naming the row by its date: '04/09/27: Name the holiday.'",
        async (label, row) => {
          const { token } = await superAdmin();

          await expectRefused(
            await save(token, withThird(row)),
            `04/09/27: ${NO_NAME}`,
          );
        },
      );

      it.each([
        ["no type", { date: "2027-04-09", name: "Araw ng Kagitingan" }],
        [
          "a type that isn't on the list",
          {
            date: "2027-04-09",
            name: "Araw ng Kagitingan",
            type: "Company Holiday",
          },
        ],
        [
          "the type as the screen shows it",
          {
            date: "2027-04-09",
            name: "Araw ng Kagitingan",
            type: "Regular Holiday",
          },
        ],
        [
          "a type in the wrong case",
          { date: "2027-04-09", name: "Araw ng Kagitingan", type: "regular" },
        ],
      ])(
        "refuses %s, naming the row by its date: '04/09/27: Choose a holiday type.'",
        async (label, row) => {
          const { token } = await superAdmin();

          await expectRefused(
            await save(token, withThird(row)),
            `04/09/27: ${BAD_TYPE}`,
          );
        },
      );

      it("names the first bad row when the first one is bad: 'Row 1: ...'", async () => {
        const { token } = await superAdmin();

        await expectRefused(
          await save(token, {
            year: 2027,
            holidays: [{ date: "2027-13-01", name: "A Day", type: REGULAR }],
          }),
          `Row 1: ${BAD_DATE}`,
        );
      });

      it("refuses a date outside the year: '01/01/28 is not in 2027.'", async () => {
        const { token } = await superAdmin();

        await expectRefused(
          await save(
            token,
            withThird({ ...NEW_YEAR_2027, date: "2028-01-01" }),
          ),
          "01/01/28 is not in 2027.",
        );
        // The other allowed year is still not this import's year
        await expectRefused(
          await save(
            token,
            withThird({ ...NEW_YEAR_2027, date: "2026-12-31" }),
          ),
          "12/31/26 is not in 2027.",
        );
      });

      it("refuses a date that is there twice, whatever the names: '04/09/27 is ticked twice.'", async () => {
        const { token } = await superAdmin();

        await expectRefused(
          await save(token, {
            year: 2027,
            holidays: [
              { date: "2027-04-09", name: "Araw ng Kagitingan", type: REGULAR },
              NEW_YEAR_2027,
              { date: "2027-04-09", name: "Day of Valor", type: SPECIAL },
            ],
          }),
          "04/09/27 is ticked twice.",
        );
      });

      it("checks in order: who, the year, the list, the rows top to bottom, a date outside the year, a date twice, then taken dates", async () => {
        const { token } = await superAdmin();
        const { token: noTick } = await adminWithoutCalendar();
        const good = (date) => ({ date, name: "A Day", type: REGULAR });
        const fortyOneBad = Array.from({ length: 41 }, () => ({}));

        // Who is asking, before anything about the request
        const denied = await save(noTick, { year: "x", holidays: fortyOneBad });
        expect([denied.status, denied.body]).toEqual([403, DENIED]);

        // The year: its shape, then the two years, before the list
        await expectRefused(
          await save(token, { year: "x", holidays: fortyOneBad }),
          YEAR_FORMAT,
        );
        await expectRefused(await save(token, { year: 2031 }), YEAR_WINDOW);

        // The list, before any row
        await expectRefused(
          await save(token, { year: 2027, holidays: fortyOneBad }),
          TOO_MANY,
        );

        // The rows top to bottom: the first bad row is the one named
        await expectRefused(
          await save(token, {
            year: 2027,
            holidays: [
              good("2027-01-01"),
              { date: "2027-04-09", name: "A Day", type: "Company Holiday" },
              { date: "2027-02-30", name: "", type: "" },
            ],
          }),
          `04/09/27: ${BAD_TYPE}`,
        );
        // Within a row: the date, then the name, then the type
        await expectRefused(
          await save(token, {
            year: 2027,
            holidays: [{ date: "2027-02-30", name: " ", type: "x" }],
          }),
          `Row 1: ${BAD_DATE}`,
        );
        await expectRefused(
          await save(token, {
            year: 2027,
            holidays: [{ date: "2027-04-09", name: " ", type: "x" }],
          }),
          `04/09/27: ${NO_NAME}`,
        );

        // A bad row further down is named before a date outside the year or a date twice
        await expectRefused(
          await save(token, {
            year: 2027,
            holidays: [
              good("2028-01-01"),
              good("2027-04-09"),
              good("2027-04-09"),
              { date: "2027-05-01", name: "", type: REGULAR },
            ],
          }),
          `05/01/27: ${NO_NAME}`,
        );
        // A date outside the year, before a date twice
        await expectRefused(
          await save(token, {
            year: 2027,
            holidays: [
              good("2027-04-09"),
              good("2027-04-09"),
              good("2028-01-01"),
            ],
          }),
          "01/01/28 is not in 2027.",
        );

        // With holidays already on those dates, the request's own faults still come first
        await saveHoliday("2027-04-09", "Araw ng Kagitingan");
        const twice = await save(token, {
          year: 2027,
          holidays: [good("2027-04-09"), good("2027-04-09")],
        });
        expect([twice.status, twice.body]).toEqual([
          400,
          { message: "04/09/27 is ticked twice." },
        ]);
        const badRow = await save(token, {
          year: 2027,
          holidays: [good("2027-04-09"), { date: "2027-05-01" }],
        });
        expect([badRow.status, badRow.body]).toEqual([
          400,
          { message: `05/01/27: ${NO_NAME}` },
        ]);
        // Last: the date is taken
        const taken = await save(token, {
          year: 2027,
          holidays: [good("2027-04-09")],
        });
        expect([taken.status, taken.body]).toEqual([
          409,
          { message: ALL_TAKEN },
        ]);
        expect(await Holiday.countDocuments()).toBe(1);
      });

      it("refuses a request that is not JSON fields at all", async () => {
        const { token } = await superAdmin();

        await expectRefused(await save(token, undefined), YEAR_FORMAT);
        await expectRefused(await save(token, [NEW_YEAR_2027]), YEAR_FORMAT);
      });
    });

    describe("who may save", () => {
      const body = { year: 2027, holidays: SIXTEEN_2027 };

      it("refuses an Admin without the Calendar tick: 403 PAGE_ACCESS_DENIED, nothing saved", async () => {
        const { token } = await adminWithoutCalendar();

        const res = await save(token, body);

        expect(res.status).toBe(403);
        expect(res.body).toEqual(DENIED);
        expect(await Holiday.countDocuments()).toBe(0);
      });

      it("refuses an Admin with no ticks stored at all", async () => {
        const { token } = await account("hr.new", "Admin");

        const res = await save(token, body);

        expect(res.status).toBe(403);
        expect(res.body).toEqual(DENIED);
        expect(await Holiday.countDocuments()).toBe(0);
      });

      it("refuses an Employee: 403, even one with the employee Calendar page", async () => {
        const { token } = await employee({
          pageAccess: ["dashboard", "calendar"],
        });

        const res = await save(token, body);

        expect(res.status).toBe(403);
        expect(res.body).toEqual(ADMIN_ONLY);
        expect(await Holiday.countDocuments()).toBe(0);
      });

      it("refuses a request without a sign-in token: 401", async () => {
        const res = await request(app).post("/api/holidays/import").send(body);

        expect(res.status).toBe(401);
        expect(await Holiday.countDocuments()).toBe(0);
      });

      it("checks who is asking before what was sent: no hint about the request or the list", async () => {
        const { token } = await adminWithoutCalendar();
        await saveHoliday("2027-01-01", "New Year's Day");

        for (const sent of [
          {},
          { year: 2031, holidays: [] },
          { year: 2027, holidays: [{ date: "2027-02-30" }] },
          { year: 2027, holidays: [NEW_YEAR_2027] },
        ]) {
          const res = await save(token, sent);
          expect([res.status, res.body]).toEqual([403, DENIED]);
        }
        expect(await Holiday.countDocuments()).toBe(1);
      });

      it("takes the tick away on the Admin's next request, without a new sign-in", async () => {
        const { user, token } = await adminWithCalendar();
        expect(
          (await save(token, { year: 2027, holidays: [NEW_YEAR_2027] })).status,
        ).toBe(201);

        await User.updateOne({ _id: user._id }, { pageAccess: ["employees"] });

        const res = await save(token, body);
        expect(res.status).toBe(403);
        expect(res.body).toEqual(DENIED);
        expect(await Holiday.countDocuments()).toBe(1);
      });
    });

    describe("a database fault: 500 with the fixed message only", () => {
      const expectPlainServerError = (res, log) => {
        expect(res.status).toBe(500);
        expect(res.body).toStrictEqual({
          message: "Error saving the holidays",
        });
        expect(JSON.stringify(res.body)).not.toContain("raw detail");
        // Logged on the server instead
        expect(
          log.mock.calls.some((args) =>
            args.some((arg) =>
              String(arg?.message ?? arg).includes(RAW_DETAIL),
            ),
          ),
        ).toBe(true);
      };

      it("when the taken dates can't be read: nothing saved", async () => {
        const { token } = await superAdmin();
        const log = quietLog();
        jest.spyOn(Holiday, "find").mockImplementation(() => {
          throw new Error(RAW_DETAIL);
        });

        const res = await save(token, { year: 2027, holidays: SIXTEEN_2027 });

        expectPlainServerError(res, log);
        expect(await Holiday.countDocuments()).toBe(0);
      });

      it("when a holiday can't be stored (not because its date is taken)", async () => {
        const { token } = await superAdmin();
        const log = quietLog();
        jest
          .spyOn(Holiday, "create")
          .mockRejectedValueOnce(new Error(RAW_DETAIL));

        const res = await save(token, { year: 2027, holidays: SIXTEEN_2027 });

        expectPlainServerError(res, log);
        expect(await Holiday.countDocuments()).toBe(0);
      });
    });
  });

  describe("the source mark", () => {
    it("manual Add stores Manual and answers it, whatever the request says", async () => {
      const { token } = await superAdmin();

      const res = await add(token, { ...NEW_YEAR_2027, source: "Imported" });

      expect(res.status).toBe(201);
      expect(res.body.holiday).toStrictEqual({
        id: String((await Holiday.findOne().lean())._id),
        ...NEW_YEAR_2027,
        source: "Manual",
      });
      expect((await stored())[0].source).toBe("Manual");
    });

    it("a holiday saved before the mark existed reads as Manual in the list", async () => {
      const { token } = await employee();
      // Straight into the collection, as DED-2 stored it: no `source` at all
      await Holiday.collection.insertOne({
        date: new Date("2026-12-25T00:00:00Z"),
        name: "Christmas Day",
        type: REGULAR,
        createdBy: null,
      });
      const raw = await Holiday.collection.findOne({});
      expect(raw).not.toHaveProperty("source");

      const res = await list(token);

      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual([
        {
          id: String(raw._id),
          date: "2026-12-25",
          name: "Christmas Day",
          type: REGULAR,
          source: "Manual",
        },
      ]);
      // Reading it changed nothing
      expect(await Holiday.collection.findOne({})).not.toHaveProperty("source");
    });

    it("the list gives each holiday's source: Imported for an imported one, Manual for the rest", async () => {
      const { token } = await superAdmin();
      const { token: employeeToken } = await employee();
      expect((await add(token, NEW_YEAR_2027)).status).toBe(201);
      expect(
        (
          await save(token, {
            year: 2027,
            holidays: [
              NEW_YEAR_2027,
              { date: "2027-12-25", name: "Christmas Day", type: REGULAR },
            ],
          })
        ).status,
      ).toBe(201);
      // A mark nobody knows (typed into the database by hand) reads as Manual
      await Holiday.collection.insertOne({
        date: new Date("2027-12-30T00:00:00Z"),
        name: "Rizal Day",
        type: REGULAR,
        source: "Seeded",
      });

      for (const caller of [token, employeeToken]) {
        const res = await list(caller, "?year=2027");
        expect(res.status).toBe(200);
        expect(res.body.map(({ date, source }) => [date, source])).toEqual([
          ["2027-01-01", "Manual"],
          ["2027-12-25", "Imported"],
          ["2027-12-30", "Manual"],
        ]);
        for (const holiday of res.body) {
          expect(Object.keys(holiday).sort()).toEqual([
            "date",
            "id",
            "name",
            "source",
            "type",
          ]);
        }
      }
    });

    it("the model marks a holiday Manual unless told Imported, and refuses any other mark", async () => {
      const plain = await saveHoliday("2027-01-01");
      expect(plain.source).toBe("Manual");

      const imported = await Holiday.create({
        date: new Date("2027-01-02T00:00:00Z"),
        name: "A Day",
        type: REGULAR,
        source: "Imported",
      });
      expect(imported.source).toBe("Imported");

      await expect(
        Holiday.create({
          date: new Date("2027-01-03T00:00:00Z"),
          name: "A Day",
          type: REGULAR,
          source: "Seeded",
        }),
      ).rejects.toThrow(/source/);
      expect(await Holiday.countDocuments()).toBe(2);
    });

    it("an imported holiday is removed like any other, and its date is free again", async () => {
      const { token } = await superAdmin();
      const saved = await save(token, {
        year: 2027,
        holidays: [NEW_YEAR_2027],
      });
      expect(saved.status).toBe(201);

      const removed = await remove(token, saved.body.saved[0].id);
      expect(removed.status).toBe(200);
      expect(removed.body).toEqual({ message: "Holiday removed." });
      expect(await Holiday.countDocuments()).toBe(0);

      const again = await add(token, NEW_YEAR_2027);
      expect(again.status).toBe(201);
      expect(again.body.holiday.source).toBe("Manual");
    });
  });

  describe("the route names", () => {
    it("'import' and 'import-preview' are never read as a holiday's id", async () => {
      const { token } = await superAdmin();
      await saveHoliday("2027-01-01");

      // Removing by those names finds no holiday and removes none
      for (const name of ["import", "import-preview"]) {
        const res = await remove(token, name);
        expect([name, res.status, res.body]).toEqual([
          name,
          404,
          { message: "Holiday not found." },
        ]);
      }
      expect(await Holiday.countDocuments()).toBe(1);

      // The list is still the list, and the preview is not the list
      const listed = await list(token);
      expect(Array.isArray(listed.body)).toBe(true);
      sourceAnswers(REPLY_2027);
      const res = await preview(token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(false);
      expect(res.body.rows).toHaveLength(18);
    });

    it("no message of the import names the highest admin role", async () => {
      const { token } = await superAdmin();
      const { token: employeeToken } = await employee();
      const { token: adminToken } = await adminWithoutCalendar();
      await saveHoliday("2027-01-01");
      quietLog();
      sourceFails(new TypeError("fetch failed"));

      const replies = [
        await request(app).get("/api/holidays/import-preview?year=2027"),
        await preview(employeeToken),
        await preview(adminToken),
        await preview(token, "?year=x"),
        await preview(token, "?year=2031"),
        await preview(token),
        await request(app).post("/api/holidays/import").send({}),
        await save(employeeToken, {}),
        await save(adminToken, {}),
        await save(token, {}),
        await save(token, { year: 2031 }),
        await save(token, { year: 2027 }),
        await save(token, { year: 2027, holidays: [{}] }),
        await save(token, { year: 2027, holidays: [{ date: "2027-01-01" }] }),
        await save(token, { year: 2027, holidays: [NEW_YEAR_2027] }),
        await save(token, {
          year: 2027,
          holidays: [{ ...NEW_YEAR_2027, date: "2027-01-02" }],
        }),
      ];

      for (const res of replies) {
        expect(typeof res.body.message).toBe("string");
        expect(res.body.message).not.toMatch(/super\s*admin/i);
      }
    });
  });
});
