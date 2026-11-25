// The holiday import (utils/holidayImport.js): where the year's Philippine holidays come
// from, and which of them are Regular holidays. Not in config/holidays.js: that file has a
// frontend copy and a test that keeps the two the same; nothing here is needed on a screen.

// The ten Regular holidays that have a fixed name. A source row whose name is one of
// `matches` (whole name; lower case, spaces trimmed and collapsed, curly apostrophes made
// straight: never by part, so "Christmas Eve" is not "Christmas Day") is preset as
// Regular and saved under `name`; every other row is preset as Special Non-Working under
// its own name. Eid'l Fitr and Eid'l Adha are Regular too, but the source doesn't list
// them: an Admin adds them by hand when they are declared.
//   name: as saved      matches: the source names it answers to
const REGULAR_HOLIDAYS = [
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
];

// The types the preview presets (names from config/holidays.js)
const REGULAR_TYPE = "Regular";
const OTHER_TYPE = "Special Non-Working";

// How a holiday got on the list: typed into the Add form, or saved by the import. A
// holiday saved before the import existed has no mark and reads as Manual.
const HOLIDAY_SOURCES = { MANUAL: "Manual", IMPORTED: "Imported" };

// Nager.Date, Community WebApi v4 (v3 ends on 2027-01-31). Only the country and the year
// go out, in the address: no headers of ours, no body.
const SOURCE_COUNTRY = "PH";
const SOURCE_URL = "https://nagerholidays.com/api/v4/Holidays/PH/{year}";
// How long the source may take to answer, in milliseconds. No retry, nothing cached.
const SOURCE_TIMEOUT_MS = 10000;
// A reply with more rows than this is not a year of holidays: the source counts as down
const MAX_SOURCE_ROWS = 100;
// The most holidays one Save may carry
const MAX_IMPORT_ROWS = 40;

module.exports = {
  REGULAR_HOLIDAYS,
  REGULAR_TYPE,
  OTHER_TYPE,
  HOLIDAY_SOURCES,
  SOURCE_COUNTRY,
  SOURCE_URL,
  SOURCE_TIMEOUT_MS,
  MAX_SOURCE_ROWS,
  MAX_IMPORT_ROWS,
};
