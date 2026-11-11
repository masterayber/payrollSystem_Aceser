// The leave types an employee can file, in the order the Leave form lists them. The only
// place the server spells them; frontend/src/utils/leaveTypes.js is the copy, and
// backend/tests/leaveTypes.test.js runs one table against both files, so a change here
// needs the same change there.
//   name: as filed and stored      code: the day code on the Excel reports
//   usesCredits: draws on the VL or SL balance (utils/leaveCredits.js)
//   paid: an approved day keeps its pay. Vacation and Sick Leave are paid and LWOP is not;
//         the seven other types are paid until HR confirms each one. Nothing reads this
//         flag yet (the pay computation will).
// Requests filed before this list keep their saved type: the leave application model
// takes any text, and only apply-leave and edit-leave check the list.

const LEAVE_TYPES = [
  { name: "Vacation Leave", code: "VL", usesCredits: true, paid: true },
  { name: "Sick Leave", code: "SL", usesCredits: true, paid: true },
  { name: "Maternity Leave", code: "ML", usesCredits: false, paid: true },
  { name: "Paternity Leave", code: "PL", usesCredits: false, paid: true },
  { name: "Solo Parent Leave", code: "SPL", usesCredits: false, paid: true },
  { name: "Study Leave", code: "STL", usesCredits: false, paid: true },
  { name: "10-Day VAWC Leave", code: "VAWC", usesCredits: false, paid: true },
  {
    name: "Special Leave Benefits for Women",
    code: "SLW",
    usesCredits: false,
    paid: true,
  },
  { name: "Adoption Leave", code: "AL", usesCredits: false, paid: true },
  {
    name: "Leave Without Pay (LWOP)",
    code: "LWOP",
    usesCredits: false,
    paid: false,
  },
];

const LEAVE_TYPE_NAMES = LEAVE_TYPES.map(({ name }) => name);

// The types that draw on a balance: Vacation Leave and Sick Leave
const CREDIT_LEAVE_TYPES = LEAVE_TYPES.filter(
  ({ usesCredits }) => usesCredits,
).map(({ name }) => name);

// True only for a string that is exactly one of the names above
const isLeaveType = (name) =>
  typeof name === "string" && LEAVE_TYPE_NAMES.includes(name);

module.exports = {
  LEAVE_TYPES,
  LEAVE_TYPE_NAMES,
  CREDIT_LEAVE_TYPES,
  isLeaveType,
};
