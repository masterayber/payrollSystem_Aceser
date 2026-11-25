// The holiday import: one year's Philippine holidays from Nager.Date, shown to an Admin
// as a preview and saved only when the Admin clicks Save (routes/holidays.js). Plain
// functions, so the rules can be tested without the database; only fetchSourceHolidays
// goes out to the network.
// - Which years: this Manila year and the next one, nothing else.
// - The source's reply is cleaned: a row is used only if it is for PH, is national, has a
//   real "YYYY-MM-DD" date inside the year and a name. The rest are left out and counted.
// - A name on the regular-holiday table (config/regularHolidays.js) is preset as Regular
//   under the table's name; every other name as Special Non-Working under its own name.
// - Save takes the Admin's rows as the Add form takes one holiday: the same checks and
//   the same messages, each with the row it is about.
// Also holds the Add form's own checks (isCalendarDay, checkHoliday), which the import
// applies to every row.

const { isHolidayType } = require("../config/holidays");
const {
  REGULAR_HOLIDAYS,
  REGULAR_TYPE,
  OTHER_TYPE,
  SOURCE_COUNTRY,
  SOURCE_URL,
  SOURCE_TIMEOUT_MS,
  MAX_SOURCE_ROWS,
  MAX_IMPORT_ROWS,
} = require("../config/regularHolidays");
const { toDateKey, manilaToday } = require("./leaveCredits");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_PATTERN = /^\d{4}$/;

const YEAR_FORMAT = "Enter the year as four digits.";
const NOTHING_TICKED = "Tick at least one holiday to save.";
const TOO_MANY = `Too many holidays in one import (${MAX_IMPORT_ROWS} at most).`;

// A "YYYY-MM-DD" string that is a real calendar day ("2026-02-30" is not: read as a date
// it rolls over to March 2, so the key has to come back unchanged)
const isCalendarDay = (value) =>
  typeof value === "string" &&
  DATE_PATTERN.test(value) &&
  toDateKey(`${value}T00:00:00Z`) === value;

// Checks a new holiday, in the order the form lists its fields. Returns { error } or
// { fields } ready to save, the date as the Manila day at 00:00 UTC.
const checkHoliday = ({ date, name, type } = {}) => {
  if (!isCalendarDay(date)) {
    return { error: "Enter the date as a valid date." };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { error: "Name the holiday." };
  }
  if (!isHolidayType(type)) {
    return { error: "Choose a holiday type." };
  }
  return {
    fields: { date: new Date(`${date}T00:00:00Z`), name: name.trim(), type },
  };
};

// "2027-04-09" as "04/09/27", the way the Calendar lists show a date
const toShortDate = (dateKey) =>
  `${dateKey.slice(5, 7)}/${dateKey.slice(8, 10)}/${dateKey.slice(2, 4)}`;

// A name as it is compared: lower case, spaces trimmed and collapsed, curly apostrophes
// made straight. Anything that isn't text compares as "".
const normaliseName = (value) =>
  typeof value === "string"
    ? value.replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ").trim().toLowerCase()
    : "";

// Every source name on the table (normalised) to the name it is saved under
const SAVED_NAME_OF = new Map(
  REGULAR_HOLIDAYS.flatMap(({ name, matches }) =>
    [name, ...matches].map((match) => [normaliseName(match), name]),
  ),
);

// The name and type the preview presets for a source name. The whole name has to match
// the table: "Christmas Eve" and "Christmas" are not "Christmas Day".
const presetFor = (sourceName) => {
  const savedName = SAVED_NAME_OF.get(normaliseName(sourceName));
  if (savedName) return { name: savedName, type: REGULAR_TYPE };
  return {
    name: typeof sourceName === "string" ? sourceName.trim() : "",
    type: OTHER_TYPE,
  };
};

// The two years an import may be for: this Manila year and the next
const importYears = (todayKey = manilaToday()) => {
  const thisYear = Number(todayKey.slice(0, 4));
  return [thisYear, thisYear + 1];
};

// Checks the year of an import: four digits (the text of a query, or a whole number in a
// JSON body), and one of the two years of importYears. Returns { error } or { year } as
// a number.
const checkImportYear = (value, todayKey = manilaToday()) => {
  const text =
    typeof value === "number" && Number.isInteger(value)
      ? String(value)
      : value;
  if (typeof text !== "string" || !YEAR_PATTERN.test(text)) {
    return { error: YEAR_FORMAT };
  }

  const year = Number(text);
  const [thisYear, nextYear] = importYears(todayKey);
  if (year !== thisYear && year !== nextYear) {
    return {
      error: `Holidays can be imported for ${thisYear} or ${nextYear} only.`,
    };
  }
  return { year };
};

// The address asked for one year. The year and "PH" are all that goes out.
const sourceAddress = (year) => SOURCE_URL.replace("{year}", String(year));

// Asks Nager.Date for one year's holidays: once, with a time limit, no headers of ours
// and no body. Resolves to the reply's list as it came; throws when the source does not
// answer in time, answers anything but 200, or answers something that is not a list of
// at most MAX_SOURCE_ROWS rows. The caller treats any throw as "the source is down".
const fetchSourceHolidays = async (year) => {
  try {
    const response = await fetch(sourceAddress(year), {
      signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
    });
    if (response.status !== 200) {
      // The reply's text is not read: let the connection go
      await response.body?.cancel().catch(() => {});
      throw new Error(`answered ${response.status}`);
    }

    const reply = await response.json();
    if (!Array.isArray(reply)) throw new Error("the reply is not a list");
    if (reply.length > MAX_SOURCE_ROWS) {
      throw new Error(`the reply has ${reply.length} rows`);
    }
    return reply;
  } catch (err) {
    const reason =
      err?.name === "TimeoutError"
        ? `no answer in ${SOURCE_TIMEOUT_MS} ms`
        : err?.message;
    throw new Error(`Holiday source (${sourceAddress(year)}): ${reason}`, {
      cause: err,
    });
  }
};

// Whether a row of the source's reply can be offered for `year`
const isUsableRow = (row, year) =>
  Boolean(row) &&
  typeof row === "object" &&
  row.countryCode === SOURCE_COUNTRY &&
  row.nationalHoliday !== false &&
  isCalendarDay(row.date) &&
  row.date.startsWith(`${year}-`) &&
  typeof row.name === "string" &&
  row.name.trim() !== "";

// The rows of a reply that can be offered, oldest first, as { date, sourceName }, and
// how many were left out: rows for another country, regional rows, rows with a bad date,
// a date outside the year or no name, and a second row on a date already used (the first
// row of a date is the one kept).
const cleanSourceRows = (reply, year) => {
  const byDate = new Map();
  let leftOut = 0;
  for (const row of Array.isArray(reply) ? reply : []) {
    if (!isUsableRow(row, year) || byDate.has(row.date)) {
      leftOut += 1;
    } else {
      byDate.set(row.date, { date: row.date, sourceName: row.name.trim() });
    }
  }
  const rows = [...byDate.values()].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  return { rows, leftOut };
};

// The preview of one year: what the Admin sees before anything is saved.
//   reply: the source's list (fetchSourceHolidays)
//   listed: the holidays already saved for that year ({ date, name, type })
// Returns { year, rows, missingRegular, leftOut }:
//   rows: { date, sourceName, name, type, listed }, oldest first; `name` and `type` are
//         the presets, `listed` is { name, type } of the holiday already on that date
//         (such a row can't be saved by the import) or null
//   missingRegular: the saved names of the table's holidays that no row matched, in the
//         table's order
//   leftOut: how many source rows were not offered
const buildPreview = ({ year, reply, listed = [] } = {}) => {
  const { rows: sourceRows, leftOut } = cleanSourceRows(reply, year);
  const listedOn = new Map(
    listed.map((holiday) => [toDateKey(holiday.date), holiday]),
  );

  const rows = sourceRows.map(({ date, sourceName }) => {
    const saved = listedOn.get(date);
    return {
      date,
      sourceName,
      ...presetFor(sourceName),
      listed: saved ? { name: saved.name, type: saved.type } : null,
    };
  });

  const found = new Set(
    rows.filter(({ type }) => type === REGULAR_TYPE).map(({ name }) => name),
  );
  const missingRegular = REGULAR_HOLIDAYS.map(({ name }) => name).filter(
    (name) => !found.has(name),
  );

  return { year, rows, missingRegular, leftOut };
};

// Checks a Save, { year, holidays: [{ date, name, type }] }, in this order:
// 1. the year (checkImportYear);
// 2. the list: there, a list, not empty; then not over MAX_IMPORT_ROWS;
// 3. every row, top to bottom, as the Add form checks one holiday (date, then name, then
//    type). The message starts with the row's date ("04/09/27: Name the holiday."), or
//    with its place in the list when the date itself is what is wrong ("Row 3: Enter the
//    date as a valid date.");
// 4. the first date that is not in the year;
// 5. the first date that is there twice.
// Any one of these refuses the whole Save. Returns { error } or { year, rows }, the rows
// as { key, date, name, type } oldest first: `key` the "YYYY-MM-DD" day, the rest ready
// to save. Whether a date already has a holiday is the route's check, after these.
const checkImport = (body, todayKey = manilaToday()) => {
  const { year: sentYear, holidays } =
    body && typeof body === "object" ? body : {};

  const checkedYear = checkImportYear(sentYear, todayKey);
  if (checkedYear.error) return checkedYear;
  const { year } = checkedYear;

  if (!Array.isArray(holidays) || holidays.length === 0) {
    return { error: NOTHING_TICKED };
  }
  if (holidays.length > MAX_IMPORT_ROWS) {
    return { error: TOO_MANY };
  }

  const rows = [];
  for (const [index, sent] of holidays.entries()) {
    const row = sent && typeof sent === "object" ? sent : {};
    const checked = checkHoliday(row);
    if (checked.error) {
      const label = isCalendarDay(row.date)
        ? toShortDate(row.date)
        : `Row ${index + 1}`;
      return { error: `${label}: ${checked.error}` };
    }
    rows.push({ key: row.date, ...checked.fields });
  }

  const outside = rows.find(({ key }) => !key.startsWith(`${year}-`));
  if (outside) {
    return { error: `${toShortDate(outside.key)} is not in ${year}.` };
  }

  const seen = new Set();
  for (const { key } of rows) {
    if (seen.has(key)) {
      return { error: `${toShortDate(key)} is ticked twice.` };
    }
    seen.add(key);
  }

  rows.sort((a, b) => (a.key < b.key ? -1 : 1));
  return { year, rows };
};

// The message of a Save that stored something: "Saved 16 holidays for 2027.", and when
// some dates were skipped, " Skipped 2 that already had a holiday: 04/09/27, 05/01/27."
const importMessage = (year, savedCount, skippedKeys = []) => {
  const saved = `Saved ${savedCount} ${savedCount === 1 ? "holiday" : "holidays"} for ${year}.`;
  if (skippedKeys.length === 0) return saved;
  return `${saved} Skipped ${skippedKeys.length} that already had a holiday: ${skippedKeys
    .map(toShortDate)
    .join(", ")}.`;
};

module.exports = {
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
};
