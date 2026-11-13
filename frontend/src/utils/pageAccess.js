import { isSuperAdmin } from "./roles";

const ADMIN = "Admin";

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

// ---- Settings tabs and the profile buttons by tick ----

export const SETTINGS_COMPANY = "settings-company";
export const SETTINGS_MANAGE = "settings-manage";
export const EMPLOYEE_ACCESS = "employee-access";

export const GENERAL_TAB = "general";

// Every admin Settings tab, in the order drawn. `tick`: shown only with that tick;
// `mainOnly`: shown only to the main account (a fixed rule, not a tick); neither:
// shown to every admin. The empty tabs (Employees, Payroll & Benefits, Attendance,
// System Log) are left out for every account until they have content.
const ADMIN_SETTINGS_TABS = [
  { name: "General", key: GENERAL_TAB },
  { name: "Company", key: "company", tick: SETTINGS_COMPANY },
  { name: "Manage", key: "manage", tick: SETTINGS_MANAGE },
  { name: "Accessibility", key: "accessibility" },
  { name: "Security & Privacy", key: "security", mainOnly: true },
  { name: "Admins", key: "admins", mainOnly: true },
  { name: "About", key: "about" },
];

// The tabs this admin sees, as { name, key }. Ticks follow hasTick, so an
// unloaded allowedPages keeps the tick tabs hidden.
export const adminSettingsTabs = (userData) =>
  ADMIN_SETTINGS_TABS.filter((tab) => {
    if (tab.mainOnly) return isSuperAdmin(userData?.role);
    if (tab.tick) return hasTick(userData, tab.tick);
    return true;
  }).map(({ name, key }) => ({ name, key }));

// The tab to draw: the selected one while it is in the list, otherwise General
// (a tab that disappears never leaves its panel on screen)
export const visibleSettingsTab = (tabs, selected) =>
  (tabs || []).some((tab) => tab.key === selected) ? selected : GENERAL_TAB;

// Delete Employee: the main account only (a fixed rule, not a tick)
export const canDeleteEmployee = (userData) => isSuperAdmin(userData?.role);

// The Page Access card on a profile and its request
export const canManageEmployeeAccess = (userData) =>
  hasTick(userData, EMPLOYEE_ACCESS);

// ---- Requests an admin screen makes on load, by tick ----

export const EMPLOYEES_PAGE = "employees";
export const ADMIN_FILING = "admin-filing";
export const LOGISTICS_PREFIX = "logistics-";

// A Logistics page key ("logistics-dashboard", ... "logistics-setup")
export const isLogisticsKey = (key) =>
  typeof key === "string" && key.startsWith(LOGISTICS_PREFIX);

// At least one Logistics page ticked (the Super Admin always): the server's
// requireAnyLogisticsPage. An unloaded allowedPages counts as none.
export const hasAnyLogisticsTick = (userData) =>
  isSuperAdmin(userData?.role) ||
  (Array.isArray(userData?.allowedPages) &&
    userData.allowedPages.some(isLogisticsKey));

// Every request an admin screen sends on load that the server guards with a tick,
// with the tick test it needs. The screen asks only when the test passes, so an
// Admin without the tick gets no 403 and no "could not load" text.
const LOAD_RULES = {
  // Dashboard, Pending Users: GET /api/auth/pending-users ("employees")
  pendingUsers: (userData) => hasTick(userData, EMPLOYEES_PAGE),
  // Employee profile, Leave Credits: GET /api/filing/leave-credits/:userId ("admin-filing")
  leaveCredits: (userData) => hasTick(userData, ADMIN_FILING),
  // Employee profile, Logistics projects: GET /api/logistics/projects?memberId= (any Logistics tick)
  logisticsProjects: hasAnyLogisticsTick,
  // Employee profile, Page Access card: GET /api/access/users/:userId ("employee-access")
  pageAccess: canManageEmployeeAccess,
};

export const ADMIN_LOAD_REQUESTS = Object.keys(LOAD_RULES);

// True when the screen may send the named request (see LOAD_RULES); false for an
// unknown name
export const canLoad = (userData, request) =>
  Object.hasOwn(LOAD_RULES, request) && Boolean(LOAD_RULES[request](userData));

// ---- An Admin's own linked employee ----

export const OWN_RECORD_NOTE =
  "This is your own record. Another Admin makes changes to it.";

// True when the signed-in Admin is linked to the employee account `userId`. The
// server refuses every change an Admin makes there (edit, resign or reinstate, page
// access), so the profile hides those buttons. The Super Admin has no linked employee.
export const isOwnLinkedEmployee = (userData, userId) =>
  Boolean(
    userData &&
      userData.role === ADMIN &&
      userData.linkedEmployeeId != null &&
      userId != null &&
      String(userData.linkedEmployeeId) === String(userId),
  );
