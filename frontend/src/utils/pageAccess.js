import { isSuperAdmin } from "./roles";

// Action ticks in `userData.allowedPages` (login and /me) that are not pages of
// their own. Mirrors the keys the server sends.
export const THIRTEENTH_MONTH = "thirteenth-month";

// The Super Admin always has every tick. Anyone else needs the key in
// allowedPages; when the list has not loaded, an action stays off (unlike
// PrivateRoute, which lets a page open), so the screen never calls a route the
// server would refuse.
export const hasTick = (userData, key) =>
  isSuperAdmin(userData?.role) ||
  (Array.isArray(userData?.allowedPages) && userData.allowedPages.includes(key));

// A page the user may open, the same test PrivateRoute uses (an unloaded list
// lets the page open; the server still guards its data)
export const hasPage = (userData, key) =>
  isSuperAdmin(userData?.role) ||
  !Array.isArray(userData?.allowedPages) ||
  userData.allowedPages.includes(key);

// 13th month figures (Reports section and the profile card)
export const canSeeThirteenthMonth = (userData) =>
  hasTick(userData, THIRTEENTH_MONTH);
