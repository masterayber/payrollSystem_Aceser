// Deductions > Employee Deduction Log: the plain rules behind the card and its boxes
// (DED-4). No React here, so Jest can test it against the server's own lists and
// messages (backend/tests/payItemsScreen.test.js).
//
// The card reads GET /api/deductions/log: one row per employee on the caller's pay list,
// { userId, employeeId, firstName, lastName, status, resignationDate, withholdingTax,
// deductions, loans, itemCount, ownRecord }. A row opens that employee's pay items
// (GET /api/deductions/items?userId=), each { id, kind, type, label, note,
// amountPerCutoff, total, paid, balance, repeat, schedule, startCutoff, taxable, status }.
// The form checks the same things the server checks first, with the server's own words,
// so a typing slip is caught before the request; the server still decides and its reply
// is shown as it is.
import { activeFirst } from "./employees";
import {
  getCutoffFor,
  getCutoffLabel,
  getNextCutoff,
  getPreviousCutoff,
  manilaToday,
  parseCutoffValue,
  toCutoffValue,
} from "./cutoff";
import { formatPeso } from "./money";

export const DASH = "—";

// ---- The lists (the server's KINDS, TYPES, REPEATS, SCHEDULES, STATUS) ----

export const KIND_OPTIONS = [
  { value: "deduction", label: "Deduction" },
  { value: "earning", label: "Earning" },
];

export const TYPES = {
  deduction: [
    "SSS Loan",
    "Pag-IBIG Loan",
    "Company Loan",
    "Cash Advance",
    "Other deduction",
  ],
  earning: ["Overtime", "Allowance", "Pay adjustment", "Other earning"],
};

export const REPEAT_OPTIONS = [
  { value: "once", label: "Once" },
  { value: "instalments", label: "In instalments" },
  { value: "untilStopped", label: "Until stopped" },
];

export const SCHEDULE_OPTIONS = [
  { value: "every", label: "Every cut-off" },
  { value: "1st", label: "1st cut-off (11th to 25th)" },
  { value: "2nd", label: "2nd cut-off (26th to 10th)" },
];

export const STATUS = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  STOPPED: "Stopped",
  COMPLETED: "Completed",
};

// The badge colour of each status (the Deductions page's badge tones)
const STATUS_TONE = {
  Active: "ok",
  Paused: "waiting",
  Stopped: "off",
  Completed: "off",
};

export const statusTone = (status) => STATUS_TONE[status] || "off";

// ---- The server's words (backend/utils/payItems.js MESSAGES) ----

// The longest label and note the server keeps (MAX_LABEL_LENGTH, MAX_NOTE_LENGTH)
export const MAX_LABEL_LENGTH = 60;
export const MAX_NOTE_LENGTH = 200;

export const MESSAGES = {
  type: "Choose a type from the list.",
  label: `Enter a label of ${MAX_LABEL_LENGTH} characters or fewer.`,
  note: `Enter a note of ${MAX_NOTE_LENGTH} characters or fewer.`,
  amount: "Enter an amount more than 0.",
  totalMissing: "Enter the total to be paid in instalments.",
  totalTooSmall: "The total can't be less than one instalment.",
  startCutoff: "Choose the cut-off it starts on.",
};

// ---- The screen's own words ----

export const LOG_LOAD_ERROR =
  "Could not load the employee deduction log. Reload the page.";
export const ITEMS_LOAD_ERROR =
  "Could not load this employee's pay items. Close this box and try again.";
export const OWN_RECORD_NOTE =
  "This is your own employee record. You can view its pay items, but another admin adds or changes them.";
export const NO_ITEMS = "No pay items yet.";
export const NO_LOG_ROWS = "No employees on your pay list yet.";
export const NO_SEARCH_MATCH = "No employees match your search.";

const optionLabel = (options, value) =>
  options.find((option) => option.value === value)?.label || String(value || "");

export const kindLabel = (kind) => optionLabel(KIND_OPTIONS, kind);
export const repeatLabel = (repeat) => optionLabel(REPEAT_OPTIONS, repeat);
export const scheduleLabel = (schedule) =>
  optionLabel(SCHEDULE_OPTIONS, schedule);

// The types offered for a kind; none for an unknown kind
export const typesFor = (kind) => TYPES[kind] || [];

// ---- Figures and names for display ----

// "₱6,000.00"; a dash for no figure (withholding tax and deductions are null until
// payslips are issued, and a one-off item has no total)
export const moneyText = (value) =>
  value === null || value === undefined || value === "" || !Number.isFinite(Number(value))
    ? DASH
    : formatPeso(Number(value));

// "Angelica Cruz"
export const employeeName = (row) =>
  [row?.firstName, row?.lastName].filter(Boolean).join(" ");

// "None", "1 item", "3 items"
export const itemCountText = (count) => {
  const number = Number(count) || 0;
  if (number === 0) return "None";
  return number === 1 ? "1 item" : `${number} items`;
};

// "Company Loan: Laptop" when it has a label, else the type
export const itemName = (item) =>
  item?.label ? `${item.type}: ${item.label}` : String(item?.type || "");

// "December 2026 1st Cut-off" for "2026-12-1st"; the value as it is if it is not one
export const cutoffText = (value) => {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(1st|2nd)$/.exec(String(value));
  if (!match) return String(value);
  const cutoff = parseCutoffValue(String(value));
  if (cutoff.monthIndex < 0 || cutoff.monthIndex > 11) return String(value);
  return getCutoffLabel(cutoff);
};

// ---- The log's rows ----

// Active employees first, then the Resigned ones, each in the server's order
export const orderLogRows = (rows) =>
  activeFirst(Array.isArray(rows) ? rows.filter(Boolean) : []);

const searchable = (row) => {
  const first = String(row?.firstName ?? "");
  const last = String(row?.lastName ?? "");
  return [
    String(row?.employeeId ?? ""),
    `${first} ${last}`,
    `${last} ${first}`,
    `${last}, ${first}`,
  ].map((text) => text.toLowerCase());
};

// The rows whose Employee ID or name holds the search, any case; every row for an
// empty search. A missing ID or name never throws.
export const filterLogRows = (rows, query) => {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const words = String(query ?? "").trim().toLowerCase();
  if (!words) return list;
  return list.filter((row) =>
    searchable(row).some((text) => text.includes(words)),
  );
};

// ---- What can be done to an item ----

// Edit, Pause or Resume, Stop and Delete. None on the Admin's own record (the server
// refuses it). Active: edit, pause, stop. Paused: edit, resume, stop. Stopped and
// Completed: nothing but Delete. Delete only while nothing was paid on an issued payslip
// (the server refuses it after that: "Stop it instead").
export const itemActions = (item, { ownRecord = false } = {}) => {
  const none = {
    edit: false,
    pause: false,
    resume: false,
    stop: false,
    delete: false,
  };
  if (!item || ownRecord) return none;
  const unpaid = !(Number(item.paid) > 0);
  const status = item.status;
  const open = status === STATUS.ACTIVE || status === STATUS.PAUSED;
  return {
    edit: open,
    pause: status === STATUS.ACTIVE,
    resume: status === STATUS.PAUSED,
    stop: open,
    delete: unpaid && status !== STATUS.COMPLETED,
  };
};

// ---- The start cut-off ----

// The cut-offs an item can start on, oldest first: the one before today's (its payslip
// may not be issued yet), today's, and the next four. `keep` (an edited item's own start)
// is added when it is not among them, so the box always shows it.
export const startCutoffOptions = ({
  today = manilaToday(),
  before = 1,
  after = 4,
  keep = "",
} = {}) => {
  const current = getCutoffFor(today);
  const list = [];
  let earlier = current;
  for (let step = 0; step < before; step += 1) {
    earlier = getPreviousCutoff(earlier);
    list.unshift(earlier);
  }
  list.push(current);
  let later = current;
  for (let step = 0; step < after; step += 1) {
    later = getNextCutoff(later);
    list.push(later);
  }
  const options = list.map((cutoff) => ({
    value: toCutoffValue(cutoff),
    label: getCutoffLabel(cutoff),
  }));
  if (keep && !options.some((option) => option.value === keep)) {
    options.unshift({ value: keep, label: cutoffText(keep) });
  }
  return options;
};

export const currentCutoffValue = (today = manilaToday()) =>
  toCutoffValue(getCutoffFor(today));

// ---- The form ----

// A new item: a deduction in instalments on every cut-off, from today's cut-off
export const emptyItemForm = (today = manilaToday()) => ({
  kind: "deduction",
  type: "",
  label: "",
  note: "",
  amountPerCutoff: "",
  total: "",
  repeat: "instalments",
  schedule: "every",
  startCutoff: currentCutoffValue(today),
  taxable: true,
});

const boxText = (value) =>
  value === null || value === undefined ? "" : String(value);

// The form for an item being edited
export const formFromItem = (item) => ({
  kind: item?.kind || "deduction",
  type: item?.type || "",
  label: item?.label || "",
  note: item?.note || "",
  amountPerCutoff: boxText(item?.amountPerCutoff),
  total: boxText(item?.total),
  repeat: item?.repeat || "once",
  schedule: item?.schedule || "every",
  startCutoff: item?.startCutoff || "",
  taxable: item?.taxable !== false,
});

// A different kind offers other types and the taxable box only for earnings
export const changeKind = (form, kind) => ({
  ...form,
  kind,
  type: typesFor(kind).includes(form?.type) ? form.type : "",
  taxable: true,
});

// A typed amount as the server reads it: digits with an optional decimal part
// ("6000", "1000.50"), rounded to the centavo; NaN for a blank box or anything else
// ("6,000", "-5", "1e3")
const MONEY_PATTERN = /^\d+(\.\d+)?$/;

const amountOf = (text) => {
  const typed = String(text ?? "").trim();
  if (!MONEY_PATTERN.test(typed)) return Number.NaN;
  return Math.round(Number(typed) * 100) / 100;
};

const textLength = (value) => String(value ?? "").trim().length;

const isInstalments = (form) => form?.repeat === "instalments";

// The first thing wrong with the form, in the server's words and in the server's order
// (type, label, note, amount, total, start); "" when it can be sent
export const checkItemForm = (form) => {
  if (!typesFor(form?.kind).includes(form?.type)) return MESSAGES.type;
  if (textLength(form?.label) > MAX_LABEL_LENGTH) return MESSAGES.label;
  if (textLength(form?.note) > MAX_NOTE_LENGTH) return MESSAGES.note;
  const amount = amountOf(form?.amountPerCutoff);
  if (!Number.isFinite(amount) || amount <= 0) return MESSAGES.amount;
  if (isInstalments(form)) {
    const total = amountOf(form?.total);
    if (!Number.isFinite(total) || total <= 0) return MESSAGES.totalMissing;
    if (total < amount) return MESSAGES.totalTooSmall;
  }
  if (!/^20\d{2}-(0[1-9]|1[0-2])-(1st|2nd)$/.test(String(form?.startCutoff || ""))) {
    return MESSAGES.startCutoff;
  }
  return "";
};

// A number when it is one, else the text as typed, so the server names the slip
const sentAmount = (text) => {
  const amount = amountOf(text);
  return Number.isFinite(amount) ? amount : String(text ?? "").trim();
};

// What POST /api/deductions/items gets. The total only for instalments, taxable only
// for earnings.
export const itemBody = (form, userId) => {
  const body = {
    userId,
    kind: form?.kind || "",
    type: form?.type || "",
    label: String(form?.label ?? "").trim(),
    note: String(form?.note ?? "").trim(),
    amountPerCutoff: sentAmount(form?.amountPerCutoff),
    repeat: form?.repeat || "",
    schedule: form?.schedule || "",
    startCutoff: form?.startCutoff || "",
  };
  if (isInstalments(form)) body.total = sentAmount(form?.total);
  if (form?.kind === "earning") body.taxable = form?.taxable !== false;
  return body;
};

// What PATCH /api/deductions/items/:id gets: only what can be changed after it is saved
export const itemChanges = (form) => {
  const changes = {
    label: String(form?.label ?? "").trim(),
    note: String(form?.note ?? "").trim(),
    amountPerCutoff: sentAmount(form?.amountPerCutoff),
    schedule: form?.schedule || "",
  };
  if (isInstalments(form)) changes.total = sentAmount(form?.total);
  return changes;
};

// The fallback after a save with no message in the reply
export const savedText = (kind, editing) => {
  if (editing) return "Item updated.";
  return kind === "earning" ? "Earning saved." : "Deduction saved.";
};
