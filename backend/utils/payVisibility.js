// Whose basic pay a caller may see (the pay list, rules 18 to 23). Every reply that
// carries pay goes through here.
// - The Super Admin sees all pay; its view can't be limited.
// - An Admin sees pay only for the employees in its `payAccess` (the ids the Super
//   Admin chose, plus the employees it added itself). Empty or missing means none. The
//   list opens no page: the routes keep their own page guards.
// - An Employee sees only its own pay.
// Pure functions, no database: `currentUser` is req.currentUser from loadCurrentUser
// (it carries `_id`, `role`, `pageAccess` and `payAccess`, read fresh on every request,
// so a change to the list applies on the Admin's next request). Ids are compared as
// strings.
const { isAdminRole, isSuperAdmin } = require("../config/roles");
const { canUseAdminPage } = require("./pageAccess");

const PAY_NOT_SHARED = {
  message: "This employee's pay is not shared with you.",
  code: "PAY_NOT_SHARED",
};

// One employee's 13th month, refused for any reason (no such employee, an admin
// account, not listed for the year, no "thirteenth-month" tick, not on the pay list):
// always this body, so the reply never tells whether the person exists
const EMPLOYEE_NOT_FOUND = { message: "Employee not found." };

// The action tick that opens 13th month figures to an Admin
const THIRTEENTH_MONTH_KEY = "thirteenth-month";

const idSet = (ids) =>
  new Set(
    (Array.isArray(ids) ? ids : [])
      .filter((id) => id != null)
      .map((id) => String(id)),
  );

// { all: true } for the Super Admin; otherwise { all: false, ids } with the account
// ids whose pay the caller may see
const payScope = (currentUser) => {
  if (!currentUser) return { all: false, ids: new Set() };
  if (isSuperAdmin(currentUser.role)) return { all: true, ids: new Set() };
  if (isAdminRole(currentUser.role)) {
    return { all: false, ids: idSet(currentUser.payAccess) };
  }
  return { all: false, ids: idSet([currentUser._id]) };
};

// True when the scope may see the pay of the account `userId`
const canSeePay = (scope, userId) =>
  Boolean(
    scope &&
      (scope.all === true ||
        (userId != null && scope.ids instanceof Set && scope.ids.has(String(userId)))),
  );

// True when the caller may see the 13th month of the account `userId`: the Super Admin
// always; an Admin only with the "thirteenth-month" tick and the person on its pay list.
// The page guards ("reports", "employees") stay on the routes.
const canSeeThirteenthMonth = (currentUser, userId) =>
  isAdminRole(currentUser?.role) &&
  canUseAdminPage(currentUser, THIRTEENTH_MONTH_KEY) &&
  canSeePay(payScope(currentUser), userId);

// The "Pay needs an update" flag (`payNotSet`) as a reply shows it, for someone whose
// pay the caller may see:
// `payNotSet: true` when the stored flag is set (a self sign-up, still on its starting
// 0) or there is no basic pay; otherwise the key is left out. Returns a copy.
const withPayFlag = (job) => {
  const { payNotSet, ...rest } = job || {};
  return payNotSet === true || rest.basicPay == null
    ? { ...rest, payNotSet: true }
    : rest;
};

// A copy of a job description with the pay taken out: `basicPay: null` and
// `payHidden: true`, so a screen shows "Restricted" instead of blank or 0. The "Pay
// needs an update" flag goes too: it would tell whether a pay is set.
const redactJob = (job) => {
  const { payNotSet, ...rest } = job || {};
  return { ...rest, basicPay: null, payHidden: true };
};

// The job description as the scope may see it: with its "Pay needs an update" flag, or
// redacted
const jobFor = (scope, userId, job) =>
  canSeePay(scope, userId) ? withPayFlag(job) : redactJob(job);

// A Settings record (plain object) with `general.jobDescription` swapped for `pick(job)`.
// A record without `general` has no pay to show or hide.
const withJob = (settings, pick) => {
  if (!settings?.general) return settings;
  return {
    ...settings,
    general: {
      ...settings.general,
      jobDescription: pick(settings.general.jobDescription),
    },
  };
};

// A Settings record (plain object) as the scope may see it: with its "Pay needs an
// update" flag, or with its `general.jobDescription` redacted
const settingsFor = (scope, userId, settings) =>
  withJob(settings, (job) => jobFor(scope, userId, job));

// The caller's own Settings record: its pay kept, with the "Pay needs an update" flag
// (Settings > General, and the sign-in and /me replies)
const ownSettings = (settings) => withJob(settings, withPayFlag);

// The 13th month report rows the scope may see; the rest are left out (their totals
// are then worked out from the rows kept)
const visibleThirteenthRows = (rows, scope) =>
  (Array.isArray(rows) ? rows : []).filter((row) => canSeePay(scope, row?.userId));

// True when a request body carries a basic pay. Missing, null, "" and spaces only
// mean "not sent" (the Add Employee form sends "" when the field is left empty).
const sendsBasicPay = (body) => {
  const value = body?.basicPay;
  if (value === undefined || value === null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
};

module.exports = {
  PAY_NOT_SHARED,
  EMPLOYEE_NOT_FOUND,
  THIRTEENTH_MONTH_KEY,
  payScope,
  canSeePay,
  canSeeThirteenthMonth,
  withPayFlag,
  redactJob,
  jobFor,
  settingsFor,
  ownSettings,
  visibleThirteenthRows,
  sendsBasicPay,
};
