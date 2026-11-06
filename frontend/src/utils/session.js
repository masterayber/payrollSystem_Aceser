// Ending a signed-in session. Shared by UserContext.clearSession and the API response
// interceptor in api.js (which cannot use React context), so the storage keys, the
// messages and the redirect live in one place.

export const ROLE_CHANGED_CODE = "ROLE_CHANGED";
export const ROLE_CHANGED_MESSAGE =
  "Your role has changed. Please sign in again.";
const INACTIVE_MESSAGE = "session ended due to inactivity.";

// Set once a role-changed logout has started. Several requests can fail with
// ROLE_CHANGED at the same moment; only the first one alerts and redirects. The page
// reloads on "/", which resets this flag.
let roleChangeLogoutStarted = false;

// True when the server refused a request because the role in the token no longer
// matches the stored role.
export const isRoleChangedError = (error) =>
  error?.response?.status === 401 &&
  error.response.data?.code === ROLE_CHANGED_CODE;

// reason: "" (silent), "inactive" or "roleChanged".
export const endSession = (reason = "") => {
  if (roleChangeLogoutStarted) return;
  if (reason === "roleChanged") roleChangeLogoutStarted = true;

  localStorage.removeItem("token");
  localStorage.removeItem("userData");
  localStorage.removeItem("lastActivity");

  if (reason === "inactive") {
    window.alert(INACTIVE_MESSAGE);
  } else if (reason === "roleChanged") {
    window.alert(ROLE_CHANGED_MESSAGE);
  }
  window.location.replace("/");
};
