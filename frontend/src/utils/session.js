// Ending a signed-in session. Shared by UserContext.clearSession and the API response
// interceptor in api.js (which cannot use React context), so the storage keys, the
// messages and the redirect live in one place.

export const ROLE_CHANGED_CODE = "ROLE_CHANGED";
export const ROLE_CHANGED_MESSAGE =
  "Your role has changed. Please sign in again.";
export const ACCOUNT_INACTIVE_CODE = "ACCOUNT_INACTIVE";
export const ACCOUNT_INACTIVE_MESSAGE = "Your account is no longer active.";
export const PASSWORD_CHANGE_REQUIRED_CODE = "PASSWORD_CHANGE_REQUIRED";
export const CHANGE_PASSWORD_PATH = "/change-password";
const INACTIVE_MESSAGE = "session ended due to inactivity.";

// Reasons that end the session with an alert. "inactive" is not in this list on
// purpose: it keeps today's behaviour of alerting each time it is asked to.
const FORCED_LOGOUT_MESSAGES = {
  roleChanged: ROLE_CHANGED_MESSAGE,
  accountInactive: ACCOUNT_INACTIVE_MESSAGE,
};

// Set once a forced logout (role changed, account no longer active) has started.
// Several requests can fail with the same code at the same moment; only the first one
// alerts and redirects. The page reloads on "/", which resets this flag.
let forcedLogoutStarted = false;

// True when the server refused a request because the role in the token no longer
// matches the stored role.
export const isRoleChangedError = (error) =>
  error?.response?.status === 401 &&
  error.response.data?.code === ROLE_CHANGED_CODE;

// True when the server refused a request because the account is no longer Active
// (disabled or resigned) while it was signed in.
export const isAccountInactiveError = (error) =>
  error?.response?.status === 401 &&
  error.response.data?.code === ACCOUNT_INACTIVE_CODE;

// True when the server refused a request because the account still has to replace its
// temporary password.
export const isPasswordChangeRequiredError = (error) =>
  error?.response?.status === 403 &&
  error.response.data?.code === PASSWORD_CHANGE_REQUIRED_CODE;

// The endSession reason for an error that should end the session with a message, or
// "" when the error carries no such code.
export const sessionEndReason = (error) => {
  if (isRoleChangedError(error)) return "roleChanged";
  if (isAccountInactiveError(error)) return "accountInactive";
  return "";
};

// reason: "" (silent), "inactive", "roleChanged" or "accountInactive".
export const endSession = (reason = "") => {
  if (forcedLogoutStarted) return;
  if (FORCED_LOGOUT_MESSAGES[reason]) forcedLogoutStarted = true;

  localStorage.removeItem("token");
  localStorage.removeItem("userData");
  localStorage.removeItem("lastActivity");

  if (reason === "inactive") {
    window.alert(INACTIVE_MESSAGE);
  } else if (FORCED_LOGOUT_MESSAGES[reason]) {
    window.alert(FORCED_LOGOUT_MESSAGES[reason]);
  }
  window.location.replace("/");
};

// Set once the browser has been sent to the change-password screen. The page reloads
// there, which resets this flag.
let passwordRedirectStarted = false;

// The server says the account must change its password first: mark it in the stored
// userData (so the page guard keeps it on the screen after the reload) and send the
// browser to the change-password screen once. Nothing happens when already there.
export const requirePasswordChange = () => {
  try {
    const stored = JSON.parse(localStorage.getItem("userData"));
    if (stored && !stored.mustChangePassword) {
      localStorage.setItem(
        "userData",
        JSON.stringify({ ...stored, mustChangePassword: true }),
      );
    }
  } catch {
    // Unreadable userData: the page guard sends the browser to "/" instead
  }

  if (passwordRedirectStarted) return;
  if (window.location.pathname === CHANGE_PASSWORD_PATH) return;
  passwordRedirectStarted = true;
  window.location.replace(CHANGE_PASSWORD_PATH);
};
