// Deductions > Government-Mandated Deductions: the plain rules behind the card and its
// modals (DED-3). No React here, so Jest can test it against the server's own rules
// (backend/tests/deductionTablesScreen.test.js).
//
// The card reads GET /api/deductions/tables: one entry per kind, in the order SSS,
// PhilHealth, Pag-IBIG, Withholding tax, each { kind, label, off, current, drafts,
// upcoming, history, lastCheckedOn, checkOverdue, blocksPayslips }
// (backend/utils/deductionTables.js kindSummaries). The screen checks nothing itself:
// the form sends what was typed and the server's message is shown as it is. Only the
// Super Admin writes; an Admin with the Deductions tick reads the same card.
import { formatPeso } from "./money";
import { isSuperAdmin } from "./roles";

// The four kinds, in the server's order (backend/utils/deductionTables.js KINDS)
export const KINDS = [
  { key: "sss", label: "SSS" },
  { key: "philhealth", label: "PhilHealth" },
  { key: "pagibig", label: "Pag-IBIG" },
  { key: "tax", label: "Withholding tax" },
];

// "SSS" for "sss"; the value as it is for anything else
export const kindLabel = (kind) =>
  KINDS.find((one) => one.key === kind)?.label || String(kind || "");

export const STATUS = { DRAFT: "Draft", CONFIRMED: "Confirmed" };

// What the brackets are read against (the server's BASES), the default first
export const BASE_OPTIONS = [
  { value: "monthlyBasic", label: "Monthly basic pay" },
  { value: "cutoffGross", label: "Cut-off gross pay" },
];

// When it is taken (the server's DEDUCT_ON), the default first
export const DEDUCT_ON_OPTIONS = [
  { value: "both", label: "Half on each cut-off" },
  { value: "1st", label: "Whole on the 1st cut-off" },
  { value: "2nd", label: "Whole on the 2nd cut-off" },
];

const optionLabel = (options, value) =>
  options.find((option) => option.value === value)?.label || String(value || "");

export const baseLabel = (base) => optionLabel(BASE_OPTIONS, base);
export const deductOnLabel = (deductOn) =>
  optionLabel(DEDUCT_ON_OPTIONS, deductOn);

// Shown under a confirmed version in place of Edit: the server's own words for the
// refusal (MESSAGES.confirmedLocked)
export const LOCKED_NOTE =
  "A confirmed table can't be changed. Add a new version with a later date.";

export const READ_ONLY_NOTE =
  "View only. The main account adds, confirms and checks these tables.";

export const LOAD_ERROR = "Could not load the deduction tables. Reload the page.";

// Adding, editing, deleting, confirming, marking as checked and switching off: the
// Super Admin only (the server's requireSuperAdmin)
export const canWriteTables = (userData) => isSuperAdmin(userData?.role);

// ---- Dates and figures for display ----

// "2026-11-26" -> "Nov 26, 2026", read as the key's own day whatever the PC's time
// zone; "" for no date, and a value that is not a "YYYY-MM-DD" key as it is
export const formatDayKey = (dateKey) => {
  if (!dateKey) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey).slice(0, 10));
  if (!match) return String(dateKey);
  const [year, month, day] = match.slice(1).map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

// A rate as typed: 4.5 -> "4.5%"
export const rateText = (rate) => `${Number(rate) || 0}%`;

// One side's share in a row: "₱400.00", "5%", or "₱400.00 + 5%"; "₱0.00" when both are 0
export const shareText = (fixed, rate) => {
  const hasFixed = Number(fixed) > 0;
  const hasRate = Number(rate) > 0;
  if (hasFixed && hasRate) return `${formatPeso(fixed)} + ${rateText(rate)}`;
  if (hasRate) return rateText(rate);
  return formatPeso(Number(fixed) || 0);
};

// "and above" for the open last row
export const upToText = (upTo) =>
  upTo === null || upTo === undefined ? "and above" : formatPeso(upTo);

// The excess a row's rates are applied to; "" for a row with no rate
export const excessText = (row) =>
  Number(row?.employeeRate) > 0 || Number(row?.employerRate) > 0
    ? formatPeso(Number(row.excessOver) || 0)
    : "";

// ---- The card's rows ----

// The status of a kind: { label, tone }, tone a badge colour ("ok", "waiting", "missing",
// "off"). Switched off first; then the version in force; then a Draft waiting to be
// confirmed; then a confirmed version that starts later; else no table.
export const kindStatus = (summary) => {
  if (!summary) return { label: "No table", tone: "missing" };
  if (summary.off) return { label: "Switched off", tone: "off" };
  if (summary.current) return { label: "Confirmed", tone: "ok" };
  if ((summary.drafts || []).length > 0) {
    return { label: "Draft waiting", tone: "waiting" };
  }
  const next = (summary.upcoming || [])[0];
  if (next) {
    return { label: `Starts ${formatDayKey(next.effectiveFrom)}`, tone: "waiting" };
  }
  return { label: "No table", tone: "missing" };
};

// Badges after the status: a Draft waiting next to a version in force, a check that is
// due, and the next confirmed version while one is in force
export const kindNotes = (summary) => {
  if (!summary || !summary.current) return [];
  const notes = [];
  if ((summary.drafts || []).length > 0) {
    notes.push({ label: "Draft waiting", tone: "waiting" });
  }
  if (summary.checkOverdue) notes.push({ label: "Check due", tone: "missing" });
  const next = (summary.upcoming || [])[0];
  if (next) {
    notes.push({
      label: `Next from ${formatDayKey(next.effectiveFrom)}`,
      tone: "ok",
    });
  }
  return notes;
};

// The kinds that stop a payslip from being issued today, by label
export const blockingKinds = (summaries) =>
  (Array.isArray(summaries) ? summaries : [])
    .filter((summary) => summary?.blocksPayslips)
    .map((summary) => summary.label || kindLabel(summary.kind));

const listText = (labels) =>
  labels.length <= 1
    ? labels.join("")
    : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;

// The banner over the card; "" when nothing blocks payslips
export const blockingText = (summaries) => {
  const labels = blockingKinds(summaries);
  if (labels.length === 0) return "";
  const verb = labels.length === 1 ? "has" : "have";
  return `${listText(labels)} ${verb} no confirmed table in force today. Payslips can't be issued until each has one or is switched off.`;
};

// The kinds switched off, as keys
export const offKinds = (summaries) =>
  (Array.isArray(summaries) ? summaries : [])
    .filter((summary) => summary?.off)
    .map((summary) => summary.kind);

// True when the kind has any version at all, so "View" has something to show
export const hasVersions = (summary) =>
  Boolean(
    summary &&
      (summary.current ||
        (summary.drafts || []).length ||
        (summary.upcoming || []).length ||
        (summary.history || []).length),
  );

// Every version of a kind as the detail panel lists them: in force, then the later
// confirmed ones, then the Drafts, then the past ones. Each { table, place, label }.
export const versionsOf = (summary) => {
  if (!summary) return [];
  const list = [];
  if (summary.current) {
    list.push({ table: summary.current, place: "current", label: "In force" });
  }
  (summary.upcoming || []).forEach((table) =>
    list.push({ table, place: "upcoming", label: "Upcoming" }),
  );
  (summary.drafts || []).forEach((table) =>
    list.push({ table, place: "draft", label: "Draft" }),
  );
  (summary.history || []).forEach((table) =>
    list.push({ table, place: "history", label: "Past" }),
  );
  return list;
};

// "SSS table from Nov 1, 2026"
export const versionName = (table) =>
  `${table?.label || kindLabel(table?.kind)} table from ${formatDayKey(table?.effectiveFrom)}`;

// ---- The table form ----

const ROW_FIELDS = [
  "over",
  "upTo",
  "employeeFixed",
  "employeeRate",
  "employerFixed",
  "employerRate",
  "excessOver",
];

// A form row: every figure as the text in its box
export const emptyRow = (over = "") => ({
  over: String(over),
  upTo: "",
  employeeFixed: "",
  employeeRate: "",
  employerFixed: "",
  employerRate: "",
  excessOver: "",
});

// A new table's form: one row starting at 0
export const emptyForm = (kind = "") => ({
  kind,
  effectiveFrom: "",
  source: "",
  base: BASE_OPTIONS[0].value,
  deductOn: DEDUCT_ON_OPTIONS[0].value,
  rows: [emptyRow("0")],
});

const boxText = (value) =>
  value === null || value === undefined ? "" : String(value);

// The fields a blank box saves as 0: a saved 0 shows as an empty box again, as typed
const BLANK_IS_ZERO = new Set([
  "employeeFixed",
  "employeeRate",
  "employerFixed",
  "employerRate",
  "excessOver",
]);

const rowToForm = (row) =>
  Object.fromEntries(
    ROW_FIELDS.map((field) => {
      const value = row?.[field];
      const blank = BLANK_IS_ZERO.has(field) && Number(value) === 0;
      return [field, blank ? "" : boxText(value)];
    }),
  );

// The form for a Draft being edited: every field from the saved table
export const formFromTable = (table) => ({
  kind: table?.kind || "",
  effectiveFrom: table?.effectiveFrom || "",
  source: table?.source || "",
  base: table?.base || BASE_OPTIONS[0].value,
  deductOn: table?.deductOn || DEDUCT_ON_OPTIONS[0].value,
  rows:
    Array.isArray(table?.rows) && table.rows.length > 0
      ? table.rows.map(rowToForm)
      : [emptyRow("0")],
});

// The form for a new version of a kind: the rows, base and timing of the version it
// follows (to change what the new issuance changed), a blank date and source, since
// those are the new issuance's own
export const formForNewVersion = (kind, after) =>
  after
    ? { ...formFromTable(after), kind, effectiveFrom: "", source: "" }
    : emptyForm(kind);

// A row added under the last one starts where the last one ends
export const addRow = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  const last = list[list.length - 1];
  return [...list, emptyRow(last ? last.upTo : list.length === 0 ? "0" : "")];
};

export const removeRow = (rows, index) =>
  (Array.isArray(rows) ? rows : []).filter((_, at) => at !== index);

// What POST and PUT /api/deductions/tables get: the figures as typed (trimmed; the server
// reads a blank as 0, and a blank "up to" as an open row)
export const tableBody = (form) => ({
  kind: form?.kind || "",
  effectiveFrom: form?.effectiveFrom || "",
  source: typeof form?.source === "string" ? form.source : "",
  base: form?.base || "",
  deductOn: form?.deductOn || "",
  rows: (Array.isArray(form?.rows) ? form.rows : []).map((row) =>
    Object.fromEntries(
      ROW_FIELDS.map((field) => [field, String(row?.[field] ?? "").trim()]),
    ),
  ),
});
