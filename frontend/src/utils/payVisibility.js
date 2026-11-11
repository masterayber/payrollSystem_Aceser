// Pay an Admin may not see (not on the Admin's pay list). The server sends
// `jobDescription.basicPay: null` with `payHidden: true` for such a person, and
// answers 403 with `code: "PAY_NOT_SHARED"` when an Admin tries to save it.
// A visible `basicPay: null` still means "no basic pay set".

export const PAY_NOT_SHARED = "PAY_NOT_SHARED";

export const RESTRICTED_LABEL = "Restricted";

export const RESTRICTED_TITLE = "This employee's pay is not shared with you.";

// Only an explicit `true` hides pay; a missing flag means the pay is shown
export const isPayHidden = (jobDescription) =>
  jobDescription?.payHidden === true;

// The badge for `payNotSet` (a self sign-up, who starts on a basic pay of 0, or no
// pay at all). The server marks it only for people whose pay the caller can see,
// never on a hidden row.
export const PAY_NOT_SET_LABEL = "Pay needs an update";

export const isPayNotSet = (jobDescription) =>
  jobDescription?.payNotSet === true && !isPayHidden(jobDescription);

// The "Pay needs an update" badge on a profile: only on someone else's record.
// Basic pay is not something people enter for themselves, so their own profile
// never shows it. Without both ids it is not shown.
export const showsPayNotSetBadge = (jobDescription, ownerId, viewerId) =>
  isPayNotSet(jobDescription) &&
  Boolean(ownerId) &&
  Boolean(viewerId) &&
  String(ownerId) !== String(viewerId);

// A basic pay as a number rounded to the centavo, or null when blank, so 15000,
// "15000", "15000.00" and "15,000" compare equal. Text that is not a number stays
// as typed, so it still counts as a change (and the server refuses it).
const normalisePay = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/,/g, "").trim();
  if (text === "") return null;
  const pay = Number(text);
  return Number.isFinite(pay) ? Math.round(pay * 100) / 100 : text;
};

// True when the basic pay field differs from the value loaded with the form. Only
// then is `basicPay` sent: the server clears `payNotSet` on any sent basic pay.
export const isPayChanged = (loadedPay, currentPay) =>
  normalisePay(loadedPay) !== normalisePay(currentPay);

// `/employees?filter=pay-not-set`: the Employees list shows only those people
export const PAY_NOT_SET_FILTER = "pay-not-set";

export const PAY_NOT_SET_PATH = `/employees?filter=${PAY_NOT_SET_FILTER}`;

// "1 employee's pay needs an update", "3 employees' pay needs an update"
export const payNotSetCountText = (count) =>
  count === 1
    ? "1 employee's pay needs an update"
    : `${count} employees' pay needs an update`;
