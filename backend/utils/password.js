// Password rule. Pure functions, no database.
//
// One rule for every account, wherever a password is set (sign-up, change password,
// Forgot password reset, Add Employee, a password reset through Edit Employee):
// at least MIN_PASSWORD_LENGTH characters, counted as typed (spaces count, nothing is
// trimmed). No letter, number or special-character requirement. A blank password
// (not a string, or only spaces) is refused as required. Login is not checked here,
// so an older, shorter password still signs in until it is changed.

const MIN_PASSWORD_LENGTH = 8;

// How the field is named in the message:
// - "new":   the person's own new password (change password, Forgot password reset)
// - "plain": the form field is just "Password" (sign-up, and a password an admin
//            types for someone else on Add Employee and Edit Employee)
const LABELS = { new: "New password", plain: "Password" };

// The refusal message for a password being set, or null when it is accepted.
// `current` is given only by change password: the new one must differ from it
// (Forgot password and the admin forms pass none).
const checkNewPassword = ({ next, current, wording = "new" }) => {
  const label = LABELS[wording] || LABELS.new;

  if (typeof next !== "string" || next.trim() === "") {
    return `${label} is required.`;
  }
  if (next.length < MIN_PASSWORD_LENGTH) {
    return `${label} must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (current !== undefined && next === current) {
    return "New password must be different from the current one.";
  }
  return null;
};

// The forced-change rule: `mustChangePassword` becomes true only when an admin or the
// Super Admin sets someone else's password (Add Employee, a password reset through
// Edit Employee). A password the person sets themselves (change password, Forgot
// password reset, sign-up, or an admin setting their own) never forces a change.
// `setBy` is the signed-in account's id, `account` the id whose password is set.
const forcesPasswordChange = ({ setBy, account }) =>
  setBy != null && account != null && String(setBy) !== String(account);

module.exports = { MIN_PASSWORD_LENGTH, checkNewPassword, forcesPasswordChange };
