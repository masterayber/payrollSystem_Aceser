// Pay items (DED-4): an earning or a deduction typed in for one employee, such as a
// Company Loan paid back in instalments or an allowance on every cut-off. Plain
// functions, so the rules can be tested without the database; the records live in
// models/payItem.js and the routes in routes/deductions.js. The frontend keeps a copy of
// the lists and messages (frontend/src/utils/payItems.js), so keep the names in step.
// - Money is pesos as a Number, rounded to the centavo with roundCentavos.
// - A cut-off is written as toCutoffValue gives it: "2026-12-1st" is December 11 to 25,
//   "2026-12-2nd" is December 26 to January 10.
// - `paid` is the sum of the item's lines on issued payslips. There are no payslips
//   until DED-6, so the routes pass 0 for now; every rule here takes it as given.
// - The stored status is Active, Paused or Stopped. "Completed" is worked out: an
//   instalment item whose balance is 0, or a one-off item that has landed.

const { toDateKey } = require("./leaveCredits");
const { roundCentavos } = require("./thirteenthMonth");
const { parseCutoffValue } = require("./cutoff");

const KINDS = ["deduction", "earning"];

// The types each kind can be, in the order the form lists them
const TYPES = {
  deduction: [
    "SSS Loan",
    "Pag-IBIG Loan",
    "Company Loan",
    "Cash Advance",
    "Other deduction",
  ],
  earning: ["Overtime", "Allowance", "Pay adjustment", "Other earning"],
};

// How often it lands: one time, until the total is paid, or on every matching cut-off
// until it is stopped
const REPEATS = ["once", "instalments", "untilStopped"];

// Which cut-offs it lands on: every one, or only the 1st or the 2nd of each month
const SCHEDULES = ["every", "1st", "2nd"];

const STATUS = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  STOPPED: "Stopped",
  // Worked out, never stored
  COMPLETED: "Completed",
};
const STORED_STATUSES = [STATUS.ACTIVE, STATUS.PAUSED, STATUS.STOPPED];
const ALL_STATUSES = [...STORED_STATUSES, STATUS.COMPLETED];

const MAX_LABEL_LENGTH = 60;
const MAX_NOTE_LENGTH = 200;

const MESSAGES = {
  employeeNotFound: "Employee not found.",
  notFound: "Item not found.",

  kind: "Choose earning or deduction.",
  type: "Choose a type from the list.",
  label: `Enter a label of ${MAX_LABEL_LENGTH} characters or fewer.`,
  note: `Enter a note of ${MAX_NOTE_LENGTH} characters or fewer.`,
  amount: "Enter an amount more than 0.",
  repeat: "Choose how it repeats: once, in instalments or until stopped.",
  totalMissing: "Enter the total to be paid in instalments.",
  totalTooSmall: "The total can't be less than one instalment.",
  totalOnlyInstalments: "Only an item paid in instalments has a total.",
  totalBelowPaid: "The total can't be less than what is already paid.",
  schedule:
    "Choose which cut-offs it lands on: every cut-off, the 1st or the 2nd.",
  startCutoff: "Choose the cut-off it starts on.",
  taxable: "Choose whether the earning is taxable.",
  fixedField:
    "Only the amount, total, schedule, label and note can be changed. Stop this item and add a new one instead.",
  statusChoice: "Choose Paused or Active.",
  statusAlone: "Pause or resume an item on its own, with no other change.",
  nothingChanged: "Nothing was changed.",
  statusFilter: "Choose a status from the list.",

  alreadyPaused: "This item is already paused.",
  alreadyActive: "This item is already active.",
  alreadyStopped: "This item is already stopped.",
  stoppedLocked: "A stopped item can't be changed.",
  completedLocked: "This item is fully paid and can't be changed.",
  onPayslip: "This item is on an issued payslip. Stop it instead.",
  changedMeanwhile:
    "This item was changed by someone else just now. Load it again.",

  savedDeduction: "Deduction saved.",
  savedEarning: "Earning saved.",
  updated: "Item updated.",
  paused: "Paused.",
  resumed: "Resumed.",
  stopped: "Stopped.",
  deleted: "Deleted.",
};

// ---- Who has pay items ----

// Rule 1: the people on payroll are Employee-role accounts that are Active, or Resigned
// with a last working day. Admin accounts, Pending and Inactive never are. `account` is
// the Auth record ({ role, status }), `job` the job description from Settings.
const isPayrollPerson = (account, job = {}) => {
  if (!account || account.role !== "Employee") return false;
  if (account.status === "Active") return true;
  return account.status === "Resigned" && Boolean(toDateKey(job?.resignationDate));
};

// ---- Cut-offs ----

const CUTOFF_PATTERN = /^20\d{2}-(0[1-9]|1[0-2])-(1st|2nd)$/;

// A cut-off value as toCutoffValue writes it, from 2000 to 2099
const isCutoffValue = (value) =>
  typeof value === "string" && CUTOFF_PATTERN.test(value);

// The cut-off's place in time (one more for each cut-off later), or null for a value
// that is not one. Two cut-offs compare by it.
const cutoffIndex = (value) => {
  if (!isCutoffValue(value)) return null;
  const { year, monthIndex, half } = parseCutoffValue(value);
  return year * 24 + monthIndex * 2 + (half === "2nd" ? 1 : 0);
};

// ---- Worked-out figures ----

const paidAmount = (paid) =>
  typeof paid === "number" && Number.isFinite(paid) && paid > 0 ? paid : 0;

const isInstalments = (item) => item?.repeat === "instalments";

// What is left to pay on an instalment item (total less paid, never below 0); null for
// an item with no total (one-off and until stopped)
const balanceOf = (item, paid = 0) => {
  if (!isInstalments(item) || typeof item.total !== "number") return null;
  return roundCentavos(Math.max(0, item.total - paidAmount(paid)));
};

// The status the screen shows. "Completed" is worked out and wins over the stored one:
// an instalment item whose balance is 0, or a one-off item that has landed. Otherwise
// the stored Active, Paused or Stopped.
const statusOf = (item, paid = 0) => {
  if (isInstalments(item) && balanceOf(item, paid) === 0) {
    return STATUS.COMPLETED;
  }
  if (item?.repeat === "once" && paidAmount(paid) > 0) return STATUS.COMPLETED;
  return STORED_STATUSES.includes(item?.status) ? item.status : STATUS.ACTIVE;
};

// Rule 14: what the item gives on the cut-off `cutoffValue`, 0 when it doesn't land.
// It lands only when it is Active (not Paused, Stopped or Completed), the cut-off is on
// or after its start cut-off, and its schedule matches the cut-off's half ("every"
// matches both). Then:
// - "once": the amount, while nothing is paid yet (it lands on the first payslip that
//   carries it, and never again);
// - "instalments": the amount, or what is left of the total when that is less, so the
//   last instalment is the remainder; 0 once the balance is 0;
// - "untilStopped": the amount on every matching cut-off.
const amountOn = (item, cutoffValue, paid = 0) => {
  if (!item || statusOf(item, paid) !== STATUS.ACTIVE) return 0;

  const at = cutoffIndex(cutoffValue);
  const from = cutoffIndex(item.startCutoff);
  if (at === null || from === null || at < from) return 0;

  const { half } = parseCutoffValue(cutoffValue);
  if (item.schedule !== "every" && item.schedule !== half) return 0;

  const amount = roundCentavos(item.amountPerCutoff || 0);
  if (item.repeat === "once") return paidAmount(paid) > 0 ? 0 : amount;
  if (isInstalments(item)) {
    return roundCentavos(Math.min(amount, balanceOf(item, paid) ?? 0));
  }
  if (item.repeat === "untilStopped") return amount;
  return 0;
};

// Rule 15: an item can be deleted only while it is on no issued payslip (nothing paid);
// after that it can only be stopped
const canDelete = (paid = 0) => paidAmount(paid) === 0;

// The open loan balance of one employee's items: the balances of the deduction items
// paid in instalments that are Active or Paused (not Stopped, not Completed), added up.
// `paidOf` gives an item's paid amount: a function of the item, or a Map from its id.
const loansOf = (items, paidOf = () => 0) => {
  const paidFor =
    typeof paidOf === "function"
      ? paidOf
      : (item) => paidOf?.get?.(String(item._id)) || 0;

  const open = (Array.isArray(items) ? items : []).filter((item) => {
    if (item?.kind !== "deduction" || !isInstalments(item)) return false;
    const status = statusOf(item, paidFor(item));
    return status === STATUS.ACTIVE || status === STATUS.PAUSED;
  });
  return roundCentavos(
    open.reduce((sum, item) => sum + (balanceOf(item, paidFor(item)) || 0), 0),
  );
};

// ---- Checking what the form sends ----

const MONEY_PATTERN = /^\d+(\.\d+)?$/;

// An amount as sent: a number, or the digits typed in a box ("6000", "1000.50"),
// rounded to the centavo. undefined for a blank one; NaN for anything that is not a
// number ("abc", "6,000", "-5" as text, true).
const money = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? roundCentavos(value) + 0 : NaN;
  }
  if (typeof value !== "string") return NaN;
  const typed = value.trim();
  if (typed === "") return undefined;
  return MONEY_PATTERN.test(typed) ? roundCentavos(Number(typed)) + 0 : NaN;
};

const isPositive = (amount) => typeof amount === "number" && amount > 0;

// A label or note as sent: trimmed text, "" when blank; null when it is not text or is
// too long
const shortText = (value, max) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  const typed = value.trim();
  return typed.length > max ? null : typed;
};

const plain = (body) =>
  body && typeof body === "object" && !Array.isArray(body) ? body : {};

// The total of an instalment item: { total } or { error }
const checkTotal = (value, amount) => {
  const total = money(value);
  if (!isPositive(total)) return { error: MESSAGES.totalMissing };
  if (total < amount) return { error: MESSAGES.totalTooSmall };
  return { total };
};

// Checks a new item as the form sends it ({ kind, type, label?, note?, amountPerCutoff,
// total?, repeat, schedule, startCutoff, taxable? }), in the order the form lists its
// fields. Returns { error } or { fields } ready to save (who it is for, who made it and
// its status are the route's). `total` is set for instalments only (null otherwise; a
// total sent with another repeat is refused). `taxable` is for earnings, true unless
// false is sent; a deduction is never taxable (false, whatever is sent).
const checkItem = (body) => {
  const input = plain(body);

  if (!KINDS.includes(input.kind)) return { error: MESSAGES.kind };
  const { kind } = input;
  if (!TYPES[kind].includes(input.type)) return { error: MESSAGES.type };

  const label = shortText(input.label, MAX_LABEL_LENGTH);
  if (label === null) return { error: MESSAGES.label };
  const note = shortText(input.note, MAX_NOTE_LENGTH);
  if (note === null) return { error: MESSAGES.note };

  const amountPerCutoff = money(input.amountPerCutoff);
  if (!isPositive(amountPerCutoff)) return { error: MESSAGES.amount };

  if (!REPEATS.includes(input.repeat)) return { error: MESSAGES.repeat };
  const { repeat } = input;

  let total = null;
  if (repeat === "instalments") {
    const checked = checkTotal(input.total, amountPerCutoff);
    if (checked.error) return { error: checked.error };
    ({ total } = checked);
  } else if (money(input.total) !== undefined) {
    return { error: MESSAGES.totalOnlyInstalments };
  }

  if (!SCHEDULES.includes(input.schedule)) return { error: MESSAGES.schedule };
  if (!isCutoffValue(input.startCutoff)) return { error: MESSAGES.startCutoff };

  let taxable = false;
  if (kind === "earning") {
    if (input.taxable === undefined || input.taxable === null) taxable = true;
    else if (typeof input.taxable === "boolean") taxable = input.taxable;
    else return { error: MESSAGES.taxable };
  }

  return {
    fields: {
      kind,
      type: input.type,
      label,
      note,
      amountPerCutoff,
      total,
      repeat,
      schedule: input.schedule,
      startCutoff: input.startCutoff,
      taxable,
    },
  };
};

// What can't change once an item is saved (stop it and add a new one instead). Sending
// the saved value again is fine, so a form can send every field.
const FIXED_FIELDS = ["kind", "type", "repeat", "startCutoff"];

// Checks a change to a saved item (PATCH): either an edit of the amount, total
// (instalments only), schedule, label and note, or `status: "Paused"` / `"Active"` to
// pause or resume it, never both at once. `paid` is the item's paid amount.
// Returns { error, status } (status 409 for the item's state, 400 otherwise) or
// { fields, action }: the fields that differ from the saved ones, and "edit", "pause"
// or "resume". In order:
// 1. a Stopped or Completed item can't be changed (409);
// 2. a fixed field sent with another value is refused;
// 3. each editable field sent is checked as for a new item; for instalments the total
//    can't be less than one instalment, nor than what is already paid;
// 4. a status is Paused or Active, sent alone; the same status again is 409;
// 5. a body that changes nothing is refused.
const checkChange = (body, item, paid = 0) => {
  const input = plain(body);
  const conflict = (error) => ({ error, status: 409 });
  const invalid = (error) => ({ error, status: 400 });

  const current = statusOf(item, paid);
  if (current === STATUS.STOPPED) return conflict(MESSAGES.stoppedLocked);
  if (current === STATUS.COMPLETED) return conflict(MESSAGES.completedLocked);

  const differs = (field) =>
    input[field] !== undefined && input[field] !== item[field];
  if (FIXED_FIELDS.some(differs)) return invalid(MESSAGES.fixedField);
  if (item.kind === "earning" && differs("taxable")) {
    return invalid(MESSAGES.fixedField);
  }

  const sent = {};
  if (input.amountPerCutoff !== undefined) {
    const amount = money(input.amountPerCutoff);
    if (!isPositive(amount)) return invalid(MESSAGES.amount);
    sent.amountPerCutoff = amount;
  }
  if (input.label !== undefined) {
    const label = shortText(input.label, MAX_LABEL_LENGTH);
    if (label === null) return invalid(MESSAGES.label);
    sent.label = label;
  }
  if (input.note !== undefined) {
    const note = shortText(input.note, MAX_NOTE_LENGTH);
    if (note === null) return invalid(MESSAGES.note);
    sent.note = note;
  }
  if (input.schedule !== undefined) {
    if (!SCHEDULES.includes(input.schedule)) return invalid(MESSAGES.schedule);
    sent.schedule = input.schedule;
  }

  if (isInstalments(item)) {
    const amount = sent.amountPerCutoff ?? item.amountPerCutoff;
    if (input.total !== undefined) {
      const checked = checkTotal(input.total, amount);
      if (checked.error) return invalid(checked.error);
      sent.total = checked.total;
    }
    const total = sent.total ?? item.total;
    if (total < amount) return invalid(MESSAGES.totalTooSmall);
    if (total < paidAmount(paid)) return invalid(MESSAGES.totalBelowPaid);
  } else if (input.total !== undefined && money(input.total) !== undefined) {
    return invalid(MESSAGES.totalOnlyInstalments);
  }

  const fields = Object.fromEntries(
    Object.entries(sent).filter(([field, value]) => value !== (item[field] ?? "")),
  );

  if (input.status !== undefined) {
    if (input.status !== STATUS.PAUSED && input.status !== STATUS.ACTIVE) {
      return invalid(MESSAGES.statusChoice);
    }
    if (Object.keys(fields).length > 0) return invalid(MESSAGES.statusAlone);
    if (input.status === item.status) {
      return conflict(
        input.status === STATUS.PAUSED
          ? MESSAGES.alreadyPaused
          : MESSAGES.alreadyActive,
      );
    }
    return {
      fields: { status: input.status },
      action: input.status === STATUS.PAUSED ? "pause" : "resume",
    };
  }

  if (Object.keys(fields).length === 0) return invalid(MESSAGES.nothingChanged);
  return { fields, action: "edit" };
};

// Checks the ?status= filter of the item list: { status } (null when not sent) or
// { error }
const checkStatusFilter = (value) => {
  if (value === undefined || value === null || value === "") {
    return { status: null };
  }
  return ALL_STATUSES.includes(value)
    ? { status: value }
    : { error: MESSAGES.statusFilter };
};

// ---- What the screen gets ----

const joinName = (employee) =>
  [employee?.firstName, employee?.lastName]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");

// One item as the screen gets it, with its worked-out paid amount, balance and status.
// `employee` is the person's Employee record ({ firstName, lastName, employeeId }). No
// account id of who made or stopped it is sent.
const itemReply = (item, { paid = 0, employee } = {}) => ({
  id: String(item._id),
  userId: String(item.userId),
  employeeId: employee?.employeeId || "",
  name: joinName(employee),
  kind: item.kind,
  type: item.type,
  label: item.label || "",
  note: item.note || "",
  amountPerCutoff: item.amountPerCutoff,
  total: isInstalments(item) ? item.total ?? null : null,
  paid: roundCentavos(paidAmount(paid)),
  balance: balanceOf(item, paid),
  repeat: item.repeat,
  schedule: item.schedule,
  startCutoff: item.startCutoff,
  taxable: item.kind === "earning" ? item.taxable !== false : false,
  status: statusOf(item, paid),
  createdAt: item.createdAt || null,
  stoppedAt: item.stoppedAt || null,
});

module.exports = {
  KINDS,
  TYPES,
  REPEATS,
  SCHEDULES,
  STATUS,
  STORED_STATUSES,
  ALL_STATUSES,
  MAX_LABEL_LENGTH,
  MAX_NOTE_LENGTH,
  MESSAGES,
  isPayrollPerson,
  isCutoffValue,
  cutoffIndex,
  money,
  checkItem,
  checkChange,
  checkStatusFilter,
  balanceOf,
  statusOf,
  amountOn,
  canDelete,
  loansOf,
  itemReply,
};
