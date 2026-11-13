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
export const SESSION_INACTIVE_MESSAGE = "Session ended due to inactivity.";

// Reasons that end the session with a message on the sign-in page. "inactive" is not in
// this list on purpose: it keeps its message each time it is asked to end the session.
const FORCED_LOGOUT_MESSAGES = {
  roleChanged: ROLE_CHANGED_MESSAGE,
  accountInactive: ACCOUNT_INACTIVE_MESSAGE,
};

// A message for the sign-in page that has to survive the redirect there (forced
// sign-out, inactivity, password reset). It is kept in sessionStorage for one page
// load only: the sign-in page takes it (reads and removes it) when it opens. Storage
// can be blocked or full, so every read and write is guarded; without storage the
// sign-in page simply opens without the message.
export const SIGN_IN_NOTICE_KEY = "signInNotice";
const NOTICE_TYPES = ["success", "warning", "error"];
const noticeType = (type) => (NOTICE_TYPES.includes(type) ? type : "warning");

// type: "warning" (yellow, the default), "success" (green) or "error" (red)
export const keepSignInNotice = (text, type = "warning") => {
  if (typeof text !== "string" || !text) return;
  try {
    sessionStorage.setItem(
      SIGN_IN_NOTICE_KEY,
      JSON.stringify({ type: noticeType(type), text }),
    );
  } catch {
    // Storage unavailable: the sign-in page opens without the message
  }
};

// The kept { type, text } message, or null when there is none. Removes it, so the next
// page load does not show it again.
export const takeSignInNotice = () => {
  let stored = null;
  try {
    stored = sessionStorage.getItem(SIGN_IN_NOTICE_KEY);
  } catch {
    return null;
  }
  try {
    sessionStorage.removeItem(SIGN_IN_NOTICE_KEY);
  } catch {
    // Could not remove it: still show it this once
  }
  if (!stored) return null;
  try {
    const notice = JSON.parse(stored);
    if (!notice || typeof notice.text !== "string" || !notice.text) return null;
    return { type: noticeType(notice.type), text: notice.text };
  } catch {
    return null;
  }
};

// Set once a forced logout (role changed, account no longer active) has started.
// Several requests can fail with the same code at the same moment; only the first one
// keeps its message and redirects. The page reloads on "/", which resets this flag.
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

  // Shown in a yellow box on the sign-in page after the reload
  if (reason === "inactive") {
    keepSignInNotice(SESSION_INACTIVE_MESSAGE);
  } else if (FORCED_LOGOUT_MESSAGES[reason]) {
    keepSignInNotice(FORCED_LOGOUT_MESSAGES[reason]);
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
