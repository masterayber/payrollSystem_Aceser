// The leave types an employee can file, in the order the Leave form lists them.
// This is the copy of backend/config/leaveTypes.js; backend/tests/leaveTypes.test.js runs
// one table against both files, so a change here needs the same change there.
//   name: as filed and stored      code: the day code on the Excel reports
//   usesCredits: draws on the VL or SL balance
//   paid: an approved day keeps its pay (the seven other types are paid until HR confirms each one)
// Plain module with no imports: Jest loads it from backend/tests/ as well.

export const LEAVE_TYPES = [
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

export const LEAVE_TYPE_NAMES = LEAVE_TYPES.map(({ name }) => name);

// The types that draw on a balance: Vacation Leave and Sick Leave
export const CREDIT_LEAVE_TYPES = LEAVE_TYPES.filter(
  ({ usesCredits }) => usesCredits,
).map(({ name }) => name);

// True only for a string that is exactly one of the names above
export const isLeaveType = (name) =>
  typeof name === "string" && LEAVE_TYPE_NAMES.includes(name);
