// Statutory deduction tables (DED-3): SSS, PhilHealth, Pag-IBIG and withholding tax.
// Plain functions, so the rules can be tested without the database; the records live in
// models/deductionTable.js and the routes in routes/deductions.js.
// - THE CODE HOLDS NO RATE AND NO BRACKET. Every figure is typed in by the Super Admin
//   from the official issuance, and nothing is seeded.
// - One record per version: a kind and the day it takes effect. A new table is a new
//   version with a later date, never an edit, so earlier payslips keep their figures.
// - A version is a Draft until the Super Admin confirms it, naming who checked it against
//   the official table. Only a Confirmed version is ever used for pay; a Draft never is.
// - The version in force on a day is the Confirmed one of that kind with the latest
//   effective date on or before it.
// - A table is rows of brackets. The row that holds the base gives two amounts, the
//   employee's and the employer's, each: fixed + rate % x (base - excessOver), rounded to
//   the centavo. A flat bracket has rate 0.
// - WHICH ROW HOLDS A BASE: a row holds every base OVER its `over` and UP TO its `upTo`
//   (over < base <= upTo). A base exactly on a boundary therefore belongs to the row that
//   ends there (the lower row), never to the row that starts there. The first row starts
//   at 0 and also holds a base of exactly 0, since no row is below it. The last row has
//   no `upTo` and holds every base above its `over`. A base below 0 has no row.

const { toDateKey } = require("./leaveCredits");
const { roundCentavos } = require("./thirteenthMonth");

// The four kinds, in the order the Deductions screen lists them
const KINDS = [
  { key: "sss", label: "SSS" },
  { key: "philhealth", label: "PhilHealth" },
  { key: "pagibig", label: "Pag-IBIG" },
  { key: "tax", label: "Withholding tax" },
];
const KIND_KEYS = KINDS.map((kind) => kind.key);

const isKind = (value) => typeof value === "string" && KIND_KEYS.includes(value);

// "SSS" for "sss"; "" for anything that is not a kind
const kindLabel = (kind) =>
  KINDS.find((one) => one.key === kind)?.label || "";

// What the brackets are read against: the monthly basic pay (the default), or the
// cut-off's gross pay
const BASES = ["monthlyBasic", "cutoffGross"];
const DEFAULT_BASE = "monthlyBasic";

// When it is taken: half on each cut-off (the default), or whole on the 1st or the 2nd
const DEDUCT_ON = ["both", "1st", "2nd"];
const DEFAULT_DEDUCT_ON = "both";

const STATUS = { DRAFT: "Draft", CONFIRMED: "Confirmed" };

const MAX_ROWS = 100;
const MAX_SOURCE_LENGTH = 200;
const MAX_CHECKER_LENGTH = 100;
// A rate is a percent of the base
const MAX_RATE = 100;
// A table is due for a re-check against the official one after this many months
const CHECK_EVERY_MONTHS = 6;

// "An SSS", "A PhilHealth", "A Pag-IBIG", "A Withholding tax"
const withArticle = (label) => `${label === "SSS" ? "An" : "A"} ${label}`;

const MESSAGES = {
  saved: "Table saved as a draft.",
  updated: "Draft updated.",
  deleted: "Draft deleted.",
  confirmed: "Table confirmed.",
  checked: "Marked as checked today.",
  offSaved: "Switched-off deductions saved.",

  badKind: "Choose SSS, PhilHealth, Pag-IBIG or Withholding tax.",
  badDate: "Enter the date the table takes effect as a valid date.",
  noSource: "Name the official issuance this table was copied from.",
  longSource: `Keep the issuance name to ${MAX_SOURCE_LENGTH} characters or fewer.`,
  badBase:
    "Choose what the table is read against: the monthly basic pay or the cut-off's gross pay.",
  badDeductOn:
    "Choose when it is taken: half on each cut-off, the 1st cut-off or the 2nd cut-off.",
  noRows: "Add at least one row.",
  tooManyRows: `Too many rows (${MAX_ROWS} at most).`,
  notNumber: (row) => `Row ${row}: enter every figure as a number.`,
  negative: "Amounts and rates can't be negative.",
  rateTooHigh: (row) =>
    `Row ${row}: a rate is a percent and can't be more than ${MAX_RATE}.`,
  rowEmpty: (row) => `Row ${row}: "up to" must be more than "over".`,
  firstRowFromZero: "Row 1 must start at 0, so every amount has a row.",
  rowEdges: (row) => `Row ${row} overlaps the row before it or leaves a gap.`,
  excessTooHigh: (row) =>
    `Row ${row}: the excess can't start above the row's "over" amount.`,
  lastRowOpen:
    'Leave "up to" empty on the last row, so it covers every higher amount.',
  taken: (kind, dateKey) =>
    `${withArticle(kindLabel(kind))} table already starts on ${dateKey}.`,

  notFound: "Table not found.",
  confirmedLocked:
    "A confirmed table can't be changed. Add a new version with a later date.",
  noCheckedWith: "Enter who checked this table against the official one.",
  longCheckedWith: `Keep the checker's name to ${MAX_CHECKER_LENGTH} characters or fewer.`,
  alreadyConfirmed: "This table is already confirmed.",
  draftNotChecked: "Only a confirmed table can be marked as checked.",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FIGURE_PATTERN = /^-?\d+(\.\d+)?$/;

// A "YYYY-MM-DD" string that is a real calendar day ("2026-02-30" is not)
const isCalendarDay = (value) =>
  typeof value === "string" &&
  DATE_PATTERN.test(value) &&
  toDateKey(`${value}T00:00:00Z`) === value;

const isOpen = (upTo) => upTo === null || upTo === undefined;

// ---- Reading a table ----

// The position in `rows` of the row that holds `base` (see WHICH ROW HOLDS A BASE at the
// top); -1 when no row does, or the base is not a number
const rowIndexFor = (rows, base) => {
  if (
    !Array.isArray(rows) ||
    typeof base !== "number" ||
    !Number.isFinite(base)
  ) {
    return -1;
  }
  return rows.findIndex((row, index) => {
    if (!row) return false;
    const aboveStart = index === 0 ? base >= row.over : base > row.over;
    return aboveStart && (isOpen(row.upTo) || base <= row.upTo);
  });
};

// fixed + rate % x excess, to the centavo
const share = (fixed, rate, excess) =>
  roundCentavos((fixed || 0) + ((rate || 0) * excess) / 100);

// What a table's rows give for a base: { row, employee, employer }, the amounts rounded
// to the centavo and `row` counted from 1; null when no row holds the base. The amount is
// the table's own: which cut-off it lands on, or its halves (`deductOn`), is the pay
// computation's business.
const bracketAmount = (rows, base) => {
  const index = rowIndexFor(rows, base);
  if (index === -1) return null;

  const row = rows[index];
  const excess = base - (row.excessOver || 0);
  return {
    row: index + 1,
    employee: share(row.employeeFixed, row.employeeRate, excess),
    employer: share(row.employerFixed, row.employerRate, excess),
  };
};

// The version of `kind` in force on `day` (a "YYYY-MM-DD" key or a Date): among `tables`,
// the Confirmed one with the latest effective date on or before that day. null when there
// is none: before the first version, or with only Drafts.
const tableInForce = (tables, kind, day) => {
  const dayKey = toDateKey(day);
  if (!dayKey || !Array.isArray(tables)) return null;

  let found = null;
  for (const table of tables) {
    if (table?.kind !== kind || table.status !== STATUS.CONFIRMED) continue;
    const from = toDateKey(table.effectiveFrom);
    if (!from || from > dayKey) continue;
    if (!found || from > toDateKey(found.effectiveFrom)) found = table;
  }
  return found;
};

// ---- Checking what the Super Admin sends ----

// A figure as sent: a number, or the digits typed in a box ("400", "2.5"). undefined for
// a blank one; NaN for anything that is not a number ("abc", "1,000", true).
const figure = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value + 0 : NaN;
  }
  if (typeof value !== "string") return NaN;
  const text = value.trim();
  if (text === "") return undefined;
  return FIGURE_PATTERN.test(text) ? Number(text) + 0 : NaN;
};

const FIXED_AND_RATE_FIELDS = [
  "employeeFixed",
  "employeeRate",
  "employerFixed",
  "employerRate",
  "excessOver",
];
const RATE_FIELDS = ["employeeRate", "employerRate"];

// Checks a table's rows, top to bottom; the first row with a problem decides the message.
// Returns { error } or { rows } ready to save: every figure a number, a blank fixed
// amount, rate or excess as 0, and a blank "up to" as null (allowed on the last row only).
// Per row, in this order:
// 1. every figure is a number, and "over" is filled;
// 2. nothing is negative;
// 3. a rate is 100 at most (it is a percent);
// 4. "up to" is more than "over";
// 5. row 1 starts at 0; every later row starts exactly where the row before it ends
//    (lower is an overlap, higher a gap; a row after an open row overlaps it);
// 6. the excess starts at or below the row's "over", so no amount can come out below its
//    fixed part.
// Then: the last row is open.
const checkRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: MESSAGES.noRows };
  }
  if (rows.length > MAX_ROWS) return { error: MESSAGES.tooManyRows };

  const clean = [];
  for (const [index, sent] of rows.entries()) {
    const number = index + 1;
    if (!sent || typeof sent !== "object" || Array.isArray(sent)) {
      return { error: MESSAGES.notNumber(number) };
    }

    const row = { over: figure(sent.over), upTo: figure(sent.upTo) ?? null };
    for (const field of FIXED_AND_RATE_FIELDS) {
      row[field] = figure(sent[field]) ?? 0;
    }
    const figures = Object.values(row).filter((value) => value !== null);

    if (row.over === undefined || figures.some(Number.isNaN)) {
      return { error: MESSAGES.notNumber(number) };
    }
    if (figures.some((value) => value < 0)) {
      return { error: MESSAGES.negative };
    }
    if (RATE_FIELDS.some((field) => row[field] > MAX_RATE)) {
      return { error: MESSAGES.rateTooHigh(number) };
    }
    if (row.upTo !== null && row.upTo <= row.over) {
      return { error: MESSAGES.rowEmpty(number) };
    }

    const previous = clean[index - 1];
    if (!previous) {
      if (row.over !== 0) return { error: MESSAGES.firstRowFromZero };
    } else if (previous.upTo === null || row.over !== previous.upTo) {
      return { error: MESSAGES.rowEdges(number) };
    }

    if (row.excessOver > row.over) {
      return { error: MESSAGES.excessTooHigh(number) };
    }
    clean.push(row);
  }

  if (clean[clean.length - 1].upTo !== null) {
    return { error: MESSAGES.lastRowOpen };
  }
  return { rows: clean };
};

// A choice from a list; a blank one is the default
const choice = (value, list, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  return list.includes(value) ? value : null;
};

// Checks a table as the form sends it, in the order the form lists its fields: the kind,
// the date, the source, what it is read against, when it is taken, the rows. Returns
// { error } or { fields } ready to save, the date as the Manila day at 00:00 UTC.
const checkTable = (body) => {
  const input =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};

  if (!isKind(input.kind)) return { error: MESSAGES.badKind };
  if (!isCalendarDay(input.effectiveFrom)) return { error: MESSAGES.badDate };

  const source = typeof input.source === "string" ? input.source.trim() : "";
  if (!source) return { error: MESSAGES.noSource };
  if (source.length > MAX_SOURCE_LENGTH) return { error: MESSAGES.longSource };

  const base = choice(input.base, BASES, DEFAULT_BASE);
  if (!base) return { error: MESSAGES.badBase };
  const deductOn = choice(input.deductOn, DEDUCT_ON, DEFAULT_DEDUCT_ON);
  if (!deductOn) return { error: MESSAGES.badDeductOn };

  const checked = checkRows(input.rows);
  if (checked.error) return { error: checked.error };

  return {
    fields: {
      kind: input.kind,
      effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00Z`),
      source,
      base,
      deductOn,
      rows: checked.rows,
    },
  };
};

// The kinds in a list, each once, in the order of KINDS; a stored value that is not a
// kind is dropped
const kindsIn = (list) =>
  KIND_KEYS.filter((key) => Array.isArray(list) && list.includes(key));

// Checks the kinds to switch off: a list (an empty one switches every kind back on) of
// kinds. Returns { error } or { kinds }, each once, in the order of KINDS.
const checkKinds = (kinds) => {
  if (!Array.isArray(kinds) || !kinds.every(isKind)) {
    return { error: MESSAGES.badKind };
  }
  return { kinds: kindsIn(kinds) };
};

// Checks who checked a table against the official one (HR or Accounting): a name.
// Returns { error } or { checkedWith }, trimmed.
const checkCheckedWith = (value) => {
  const checkedWith = typeof value === "string" ? value.trim() : "";
  if (!checkedWith) return { error: MESSAGES.noCheckedWith };
  if (checkedWith.length > MAX_CHECKER_LENGTH) {
    return { error: MESSAGES.longCheckedWith };
  }
  return { checkedWith };
};

// ---- What the screen gets ----

// The day `months` calendar months after a day, as a key; the month's last day when it
// has no such day (August 31 and 6 months is the last day of February)
const addMonths = (dayKey, months) => {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return toDateKey(date);
};

// True when a table's last check against the official one is over 6 months old on
// `todayKey`: checked on May 25, it is due from November 26. A table with no check on
// record is due.
const isCheckOverdue = (lastCheckedOn, todayKey) => {
  const checkedKey = toDateKey(lastCheckedOn);
  if (!checkedKey) return true;
  return addMonths(checkedKey, CHECK_EVERY_MONTHS) < todayKey;
};

const rowReply = (row) => ({
  over: row.over,
  upTo: isOpen(row.upTo) ? null : row.upTo,
  employeeFixed: row.employeeFixed || 0,
  employeeRate: row.employeeRate || 0,
  employerFixed: row.employerFixed || 0,
  employerRate: row.employerRate || 0,
  excessOver: row.excessOver || 0,
});

// A table as the screen gets it: the dates as "YYYY-MM-DD" keys, and people by name
// (`nameOf(accountId)`), never by account id.
const tableReply = (table, nameOf = () => "") => ({
  id: String(table._id),
  kind: table.kind,
  label: kindLabel(table.kind),
  effectiveFrom: toDateKey(table.effectiveFrom),
  source: table.source || "",
  base: table.base || DEFAULT_BASE,
  deductOn: table.deductOn || DEFAULT_DEDUCT_ON,
  rows: (table.rows || []).map(rowReply),
  status: table.status,
  confirmedBy: table.confirmedBy ? nameOf(table.confirmedBy) : "",
  confirmedAt: table.confirmedAt || null,
  checkedWith: table.checkedWith || "",
  lastCheckedOn: toDateKey(table.lastCheckedOn) || null,
  lastCheckedBy: table.lastCheckedBy ? nameOf(table.lastCheckedBy) : "",
  createdBy: table.createdBy ? nameOf(table.createdBy) : "",
  createdAt: table.createdAt || null,
});

const byDate = (a, b) =>
  toDateKey(a.effectiveFrom).localeCompare(toDateKey(b.effectiveFrom));

// The Government-Mandated card: one entry per kind, in the order of KINDS, from every
// stored table. `todayKey` is today in Manila; `off` the kinds switched off.
// - current: the Confirmed version in force today, or null
// - drafts: every Draft, earliest date first
// - upcoming: Confirmed versions that start after today, earliest first
// - history: Confirmed versions that started on or before today and are no longer in
//   force, latest first
// - lastCheckedOn: the current version's last check, or null
// - checkOverdue: the current version's last check is over 6 months old
// - blocksPayslips: there is no Confirmed version in force today, so no cut-off can be
//   issued
// A kind that is switched off never blocks payslips and is never due for a check.
const kindSummaries = (
  tables,
  { todayKey, off = [], nameOf = () => "" } = {},
) => {
  const all = Array.isArray(tables) ? tables : [];
  const reply = (table) => tableReply(table, nameOf);

  return KINDS.map(({ key, label }) => {
    const own = all.filter((table) => table.kind === key).sort(byDate);
    const confirmed = own.filter((table) => table.status === STATUS.CONFIRMED);
    const current = tableInForce(own, key, todayKey);
    const isOff = off.includes(key);
    const startsLater = (table) => toDateKey(table.effectiveFrom) > todayKey;

    return {
      kind: key,
      label,
      off: isOff,
      current: current ? reply(current) : null,
      drafts: own.filter((table) => table.status === STATUS.DRAFT).map(reply),
      upcoming: confirmed.filter(startsLater).map(reply),
      history: confirmed
        .filter((table) => !startsLater(table) && table !== current)
        .reverse()
        .map(reply),
      lastCheckedOn: current ? toDateKey(current.lastCheckedOn) || null : null,
      checkOverdue:
        !isOff && !!current && isCheckOverdue(current.lastCheckedOn, todayKey),
      blocksPayslips: !isOff && !current,
    };
  });
};

module.exports = {
  KINDS,
  KIND_KEYS,
  BASES,
  DEFAULT_BASE,
  DEDUCT_ON,
  DEFAULT_DEDUCT_ON,
  STATUS,
  MAX_ROWS,
  MAX_SOURCE_LENGTH,
  MAX_CHECKER_LENGTH,
  MAX_RATE,
  CHECK_EVERY_MONTHS,
  MESSAGES,
  isKind,
  kindLabel,
  isCalendarDay,
  rowIndexFor,
  bracketAmount,
  tableInForce,
  checkRows,
  checkTable,
  kindsIn,
  checkKinds,
  checkCheckedWith,
  addMonths,
  isCheckOverdue,
  tableReply,
  kindSummaries,
};
