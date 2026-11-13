// The shape an email must have: something, an @, something, a dot, something, with no
// spaces. The same pattern as the screen's check (frontend/src/utils/adminAccounts.js
// EMAIL_SHAPE), so the server and the form refuse the same emails with the same words.
// Used on Admin accounts (/api/admins) and an Admin's own Settings > General; sign-up and
// Add/Edit Employee follow on Nov 20 (decision 3 of the 2026-11-13 Friday batch).
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMAIL_SHAPE_MESSAGE = "Enter a valid email address.";

// True when `value` is text shaped like an email once trimmed
const isEmailShape = (value) =>
  typeof value === "string" && EMAIL_SHAPE.test(value.trim());

module.exports = { EMAIL_SHAPE, EMAIL_SHAPE_MESSAGE, isEmailShape };
