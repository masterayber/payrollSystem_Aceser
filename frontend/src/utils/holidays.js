// The company holiday types, in the order the Calendar form lists them.
// This is the copy of backend/config/holidays.js; backend/tests/holidays.test.js runs
// one table against both files, so a change here needs the same change there.
//   name: as saved and stored
//   nonWorking: a paid day off, so a Monday-to-Friday day of this type is never LWOP;
//     "Special Working" is an ordinary working day
// Plain module with no imports: Jest loads it from backend/tests/ as well.

export const HOLIDAY_TYPES = [
  { name: "Regular", nonWorking: true },
  { name: "Special Non-Working", nonWorking: true },
  { name: "Special Working", nonWorking: false },
];

export const HOLIDAY_TYPE_NAMES = HOLIDAY_TYPES.map(({ name }) => name);

// True only for a string that is exactly one of the names above
export const isHolidayType = (type) =>
  typeof type === "string" && HOLIDAY_TYPE_NAMES.includes(type);

// True only for the two non-working types; false for "Special Working", no type, or any other value
export const isNonWorkingHoliday = (type) =>
  HOLIDAY_TYPES.some(
    ({ name, nonWorking }) => nonWorking && name === type,
  );

// The type as the Calendar screen shows it: "Regular Holiday", "Special Non-Working Holiday",
// "Special Working Holiday". A value that is not on the list is shown as it is.
export const holidayTypeLabel = (type) =>
  isHolidayType(type) ? `${type} Holiday` : String(type || "");

// The three types for the Calendar form's dropdown
export const HOLIDAY_TYPE_OPTIONS = HOLIDAY_TYPE_NAMES.map((name) => ({
  label: holidayTypeLabel(name),
  value: name,
}));

// The "YYYY-MM-DD" key of a holiday's date (a date with a time part is cut at the "T")
export const holidayDateKey = (date) => String(date || "").slice(0, 10);

// The list from GET /api/holidays as { "YYYY-MM-DD": holiday }, for one look-up per day
export const holidaysByDate = (holidays) => {
  const byDate = {};
  (Array.isArray(holidays) ? holidays : []).forEach((holiday) => {
    const key = holidayDateKey(holiday?.date);
    if (key) byDate[key] = holiday;
  });
  return byDate;
};

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// The key's own year, month and day, or null when it is not a real "YYYY-MM-DD" date.
// Read with Date.UTC, so the browser's time zone can't move the day.
const keyParts = (dateKey) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(holidayDateKey(dateKey));
  if (!match) return null;

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, weekday: date.getUTCDay() };
};

// "2026-01-01" -> "Thursday"; "" for a key that is not a date
export const holidayDayName = (dateKey) => {
  const parts = keyParts(dateKey);
  return parts ? WEEKDAY_NAMES[parts.weekday] : "";
};

// "2026-01-01" -> "01/01/26" (the Calendar lists' MM/DD/YY); a key that is not a date is shown as it is
export const formatHolidayDate = (dateKey) => {
  const parts = keyParts(dateKey);
  if (!parts) return holidayDateKey(dateKey);

  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(parts.month)}/${pad(parts.day)}/${pad(parts.year % 100)}`;
};
