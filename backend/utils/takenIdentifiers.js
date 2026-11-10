// "Is this username, email or Employee ID already used by someone else?", ignoring
// case, for every route that saves one (sign-up, Add Employee, Edit Employee, Settings
// General). A person keeping their own value, even in a new case, is not refused.
// /api/admins keeps its own check in routes/admins.js (same messages).
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const { ignoreCase } = require("./ignoreCase");

const TAKEN_MESSAGES = {
  username: "Username is already taken.",
  email: "Email is already registered.",
  employeeId: "Employee ID already exists.",
};

// Only non-empty text is looked up; a missing, blank or odd value is left to the
// route's existing behaviour
const isText = (value) => typeof value === "string" && value !== "";

// The first of "username", "email" or "employeeId" that someone other than the account
// `exceptUserId` already uses, or null. `email` may be one value or a list (Settings
// saves the Auth email and the Employee record's email). A username is looked up on
// the Auth records; an email on the Auth records and the Employee records; an Employee
// ID on the Employee records. Without `exceptUserId` (a new account) every record
// counts.
const takenField = async ({ username, email, employeeId } = {}, exceptUserId) => {
  const otherAccounts = exceptUserId ? { _id: { $ne: exceptUserId } } : {};
  const otherEmployees = exceptUserId ? { userId: { $ne: exceptUserId } } : {};

  if (
    isText(username) &&
    (await User.exists({ username: ignoreCase(username), ...otherAccounts }))
  ) {
    return "username";
  }

  const emails = [...new Set([].concat(email).filter(isText))];
  for (const value of emails) {
    const used =
      (await User.exists({ email: ignoreCase(value), ...otherAccounts })) ||
      (await Employee.exists({ email: ignoreCase(value), ...otherEmployees }));
    if (used) return "email";
  }

  if (
    isText(employeeId) &&
    (await Employee.exists({
      employeeId: ignoreCase(employeeId),
      ...otherEmployees,
    }))
  ) {
    return "employeeId";
  }

  return null;
};

// The refusal message for the first value taken by someone else, or null
const takenRefusal = async (values, exceptUserId) => {
  const field = await takenField(values, exceptUserId);
  return field ? TAKEN_MESSAGES[field] : null;
};

module.exports = { TAKEN_MESSAGES, takenField, takenRefusal };
