// The company holiday types, in the order the Calendar form lists them. The only place
// the server spells them; frontend/src/utils/holidays.js is the copy, and
// backend/tests/holidays.test.js runs one table against both files, so a change here
// needs the same change there.
//   name: as saved and stored
//   nonWorking: a paid day off, so a Monday-to-Friday day of this type is never LWOP
//         (utils/payDays.js). "Special Working" is an ordinary working day. Whether each
//         type is paid without work still waits on HR: both non-working types are paid
//         until then.

const HOLIDAY_TYPES = [
  { name: "Regular", nonWorking: true },
  { name: "Special Non-Working", nonWorking: true },
  { name: "Special Working", nonWorking: false },
];

const HOLIDAY_TYPE_NAMES = HOLIDAY_TYPES.map(({ name }) => name);

// True only for a string that is exactly one of the names above
const isHolidayType = (name) =>
  typeof name === "string" && HOLIDAY_TYPE_NAMES.includes(name);

// True only for the two non-working types; false for "Special Working", no type, or any
// other value
const isNonWorkingHoliday = (type) =>
  HOLIDAY_TYPES.some(({ name, nonWorking }) => nonWorking && name === type);

module.exports = {
  HOLIDAY_TYPES,
  HOLIDAY_TYPE_NAMES,
  isHolidayType,
  isNonWorkingHoliday,
};
