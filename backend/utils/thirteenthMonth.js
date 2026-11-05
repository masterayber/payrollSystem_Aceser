// 13th month pay, built up per cut-off (PD 851: 1/12 of the basic salary earned from
// January 1 to December 31). Nothing is stored except the basic pay history: the figures
// are worked out from the pay in force each weekday, the start date and (for a resigned
// employee) the last working day.
// - A year is 25 parts (utils/cutoff.js calendarYearCutoffs): Jan 1-10, the 23 ordinary
//   cut-offs Jan 11-25 to Dec 11-25, and Dec 26-31. Jan 1-10 and Dec 26-31 together are
//   the year's year-end cut-off.
// - Each cut-off earns monthly basic / 2 / 12 (24 cut-offs = one month's basic). A part
//   earns, over its weekdays employed (Monday to Friday), the pay in force that day / 24,
//   divided by the weekdays of the whole cut-off (for the year-end cut-off, both parts'
//   weekdays added together).
// - Every part of the year counts, from the start date (Jan 1 when they started earlier)
//   to the last working day for a resigned employee. A part is "computed" once it has
//   ended (its end is before today, Manila), or, for a resigned employee, once the last
//   working day has passed (it is before today) even if the cut-off hasn't ended; it is
//   "projected" until then, and "none" when the employee wasn't employed on any of its
//   weekdays.
// - Days before the first pay history record use that record's amount; with no history,
//   the current basic pay (utils/basicPayHistory.js payInForce).
// - No deductions (absences, leave without pay).
// Only final amounts are rounded to the centavo.

const { THIRTEENTH_MONTH_FIRST_YEAR } = require("../config/payroll");
const { YEAR_END, calendarYearCutoffs } = require("./cutoff");
const { toDateKey, weekdaysBetween } = require("./leaveCredits");
const { payInForce } = require("./basicPayHistory");

const FLAGS = {
  NO_BASIC_PAY: "NO_BASIC_PAY",
  NO_START_DATE: "NO_START_DATE",
  NO_LAST_DAY: "NO_LAST_DAY",
};

// Flags that leave the row without any amounts (every flag, for now)
const BLOCKING_FLAGS = [
  FLAGS.NO_BASIC_PAY,
  FLAGS.NO_START_DATE,
  FLAGS.NO_LAST_DAY,
];

// Cut-offs in a year: one month's basic is 24 cut-offs' worth
const CUTOFFS_PER_YEAR = 24;

const roundCentavos = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

const isAmount = (value) =>
  value !== null && value !== undefined && Number.isFinite(value);

// The year's first and last day: January 1 to December 31
const yearRange = (year) => ({ start: `${year}-01-01`, end: `${year}-12-31` });

// The report's 25 columns for `year`, in date order: { cutoff, month, half, start, end,
// weekdays, cutoffWeekdays }. `weekdays` are the part's own; `cutoffWeekdays` the whole
// cut-off's (the same for an ordinary cut-off, both parts' added for the year-end one).
const yearColumns = (year) => {
  const parts = calendarYearCutoffs(year).map((part) => ({
    ...part,
    weekdays: weekdaysBetween(part.start, part.end).length,
  }));
  const yearEndWeekdays = parts
    .filter((part) => part.half === YEAR_END)
    .reduce((sum, part) => sum + part.weekdays, 0);

  return parts.map((part) => ({
    ...part,
    cutoffWeekdays: part.half === YEAR_END ? yearEndWeekdays : part.weekdays,
  }));
};

// The employment dates as keys. The last working day only counts for a Resigned account
// (reinstating clears it, and an Active account has none).
const employment = (job = {}, status) => ({
  startKey: toDateKey(job.startDate),
  lastKey: status === "Resigned" ? toDateKey(job.resignationDate) : "",
});

// Whether an account appears in the report for `year`. `account` is the Auth record
// ({ role, status }), `job` the job description from Settings.
// - Active: started on or before Dec 31 of the year, or no start date (flagged in the row).
// - Resigned: the last working day is from Jan 1 to Dec 31 of the year, or there is none
//   (flagged, and listed in every year).
// - Admins, Pending and Inactive accounts: never.
const isListed = (account, job = {}, year) => {
  if (!account || account.role !== "Employee") return false;
  const { start, end } = yearRange(year);
  const { startKey, lastKey } = employment(job, account.status);

  if (account.status === "Active") return !startKey || startKey <= end;
  if (account.status === "Resigned") {
    return !lastKey || (lastKey >= start && lastKey <= end);
  }
  return false;
};

// The weekdays of one part the employee was employed on. `part` is a column from
// yearColumns ({ start, end, weekdays, cutoffWeekdays }; a bare { start, end } counts as
// an ordinary cut-off); `job.resignationDate` is read as the last working day when set.
// Returns { weekdays, cutoffWeekdays, weekdaysEmployed, share, days }, share =
// weekdaysEmployed / cutoffWeekdays (0 to 1) and days the employed weekdays as keys;
// weekdaysEmployed and share are null (days empty) without a start date.
const cutoffShare = (job = {}, part) => {
  const weekdays =
    part.weekdays ?? weekdaysBetween(part.start, part.end).length;
  const cutoffWeekdays = part.cutoffWeekdays ?? weekdays;
  const startKey = toDateKey(job.startDate);
  if (!startKey) {
    return {
      weekdays,
      cutoffWeekdays,
      weekdaysEmployed: null,
      share: null,
      days: [],
    };
  }

  const lastKey = toDateKey(job.resignationDate);
  const from = startKey > part.start ? startKey : part.start;
  const to = lastKey && lastKey < part.end ? lastKey : part.end;
  const days = from <= to ? weekdaysBetween(from, to) : [];

  return {
    weekdays,
    cutoffWeekdays,
    weekdaysEmployed: days.length,
    share: cutoffWeekdays ? days.length / cutoffWeekdays : 0,
    days,
  };
};

// What a part earns, unrounded: the sum over the days employed of the pay in force that
// day / 24, divided by the weekdays of the whole cut-off. `payOn(dayKey)` gives the
// monthly basic on a day.
const partAmount = (days, cutoffWeekdays, payOn) =>
  cutoffWeekdays
    ? days.reduce((sum, day) => sum + payOn(day) / CUTOFFS_PER_YEAR, 0) /
      cutoffWeekdays
    : 0;

// One employee's 13th month for `year`, as of `todayKey`.
// `status` is the account status ("Active" or "Resigned"). `history` is the basic pay
// history ([{ amount, effectiveFrom, changedAt }], any order; empty means the current
// basic pay applies to every day).
// Returns { cutoffs (25), computed, projected, total, flags }; computed, projected and
// total are null when a flag blocks the row.
// Each part is { cutoff, start, end, weekdays, cutoffWeekdays, weekdaysEmployed, share,
// amount, kind }, kind "computed" | "projected" | "none" (not employed in it).
const thirteenthMonth = (
  job = {},
  { year, todayKey, status = "Active", history = [] } = {},
) => {
  const { startKey, lastKey } = employment(job, status);
  const hasBasicPay = isAmount(job.basicPay);

  const flags = [];
  if (!hasBasicPay) flags.push(FLAGS.NO_BASIC_PAY);
  if (!startKey) flags.push(FLAGS.NO_START_DATE);
  if (status === "Resigned" && !lastKey) flags.push(FLAGS.NO_LAST_DAY);

  // The employment as counted: no last working day unless the account is Resigned
  const employed = { startDate: startKey, resignationDate: lastKey };

  const blocked = flags.some((flag) => BLOCKING_FLAGS.includes(flag));
  // Shares are unknown without a start date, or for a Resigned account with no last day
  const sharesKnown = Boolean(startKey) && !(status === "Resigned" && !lastKey);
  const payOn = payInForce(history, job.basicPay);

  let computed = 0;
  let projected = 0;
  const cutoffs = yearColumns(year).map((part) => {
    const employedIn = cutoffShare(sharesKnown ? employed : {}, part);

    // A part the employee is employed in has its final amount once it has ended, or, for
    // a resigned employee, once the last working day has passed (they earn nothing after
    // it, so the cut-off they left in needn't wait for its end).
    let kind;
    if (employedIn.share === 0) kind = "none";
    else if (part.end < todayKey) kind = "computed";
    else if (lastKey && lastKey < todayKey) kind = "computed";
    else kind = "projected";

    let amount = null;
    if (!blocked) {
      amount = partAmount(employedIn.days, part.cutoffWeekdays, payOn);
      if (kind === "computed") computed += amount;
      if (kind === "projected") projected += amount;
    }

    return {
      cutoff: part.cutoff,
      start: part.start,
      end: part.end,
      weekdays: part.weekdays,
      cutoffWeekdays: part.cutoffWeekdays,
      weekdaysEmployed: employedIn.weekdaysEmployed,
      share: employedIn.share,
      amount: amount === null ? null : roundCentavos(amount),
      kind,
    };
  });

  return {
    cutoffs,
    computed: blocked ? null : roundCentavos(computed),
    projected: blocked ? null : roundCentavos(projected),
    total: blocked ? null : roundCentavos(computed + projected),
    flags,
  };
};

// The totals row: sums over the rows that aren't blocked (total !== null) of the figures
// as shown, so it adds up with the table. `employees` is how many rows it counts (for the
// DOLE report); `byCutoff` has one sum per column.
const reportTotals = (rows, columnCount) => {
  const complete = rows.filter((row) => row.total !== null);
  const sum = (values) =>
    roundCentavos(values.reduce((acc, value) => acc + (value || 0), 0));

  return {
    employees: complete.length,
    computed: sum(complete.map((row) => row.computed)),
    projected: sum(complete.map((row) => row.projected)),
    total: sum(complete.map((row) => row.total)),
    byCutoff: Array.from({ length: columnCount }, (_, i) =>
      sum(complete.map((row) => row.cutoffs[i]?.amount)),
    ),
  };
};

// The ?year= of a report: missing means the current year; otherwise a whole number
// from the first year to the current one. Returns { error } or { year }.
const checkYear = (value, currentYear) => {
  if (value === undefined || value === "") return { year: currentYear };
  const year = /^\d{4}$/.test(String(value)) ? Number(value) : NaN;
  if (
    !Number.isInteger(year) ||
    year < THIRTEENTH_MONTH_FIRST_YEAR ||
    year > currentYear
  ) {
    return {
      error: `Year must be from ${THIRTEENTH_MONTH_FIRST_YEAR} to ${currentYear}.`,
    };
  }
  return { year };
};

module.exports = {
  FLAGS,
  roundCentavos,
  yearColumns,
  isListed,
  cutoffShare,
  thirteenthMonth,
  reportTotals,
  checkYear,
};
