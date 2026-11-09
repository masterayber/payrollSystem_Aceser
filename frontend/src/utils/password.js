// The one password rule for every account, wherever a password is set (sign-up, Add
// and Edit Employee, change password, Forgot password reset): at least 8 characters,
// counted as typed (no trimming). Spaces only counts as blank. The server checks the
// same rule and refuses with the same words; this check only saves the round trip.
export const MIN_PASSWORD_LENGTH = 8;

// The hint shown near every new-password field
export const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters`;

const passwordMessage = (password, subject) => {
  if (typeof password !== "string" || password.trim() === "") {
    return `${subject} is required.`;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `${subject} must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
};

// An account's own new password (change password, Forgot password reset).
// Returns the message to show, or null when the password is fine.
export const checkNewPassword = (password) =>
  passwordMessage(password, "New password");

// A password typed at sign-up or for someone else (Add or Edit Employee).
// Returns the message to show, or null when the password is fine.
export const checkPassword = (password) => passwordMessage(password, "Password");
