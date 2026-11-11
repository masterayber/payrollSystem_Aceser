// Display helpers for the 13th month pay the server sends (/api/thirteenth-month).
// Every amount is computed on the server; nothing here adds up or prorates pay.
import { MONTHS, manilaToday } from "./cutoff";

// The portal started counting 13th month pay in 2026
export const FIRST_THIRTEENTH_MONTH_YEAR = 2026;

export const FLAG_LABELS = {
  NO_BASIC_PAY: "Pay needs an update",
  NO_START_DATE: "Start date missing",
  NO_LAST_DAY: "Last working day missing",
};

export const flagLabels = (flags = []) =>
  flags.map((flag) => FLAG_LABELS[flag] || flag);

export const CUTOFF_NOTE =
  "Cut-offs run from the 11th to the 25th and from the 26th to the 10th of the next month; the one that crosses New Year is split at December 31, so January 1 to 10 and December 26 to 31 together make the year-end cut-off.";

export const currentManilaYear = () => Number(manilaToday().slice(0, 4));

// Year dropdown, newest first: the current Manila year down to 2026
export const getThirteenthMonthYearOptions = () => {
  const options = [];
  for (
    let year = Math.max(currentManilaYear(), FIRST_THIRTEENTH_MONTH_YEAR);
    year >= FIRST_THIRTEENTH_MONTH_YEAR;
    year -= 1
  ) {
    options.push({ label: String(year), value: String(year) });
  }
  return options;
};

// "2026-11-04" as "November 4, 2026" (month "long") or "Nov 4, 2026" (month "short")
export const formatDateKey = (key, month = "long") =>
  key
    ? new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", {
        month,
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

export const asOfNote = (asOf) => `As of ${formatDateKey(asOf)}.`;

// `payHistoryStart` is the server's date key for the day pay changes started being
// recorded; before it, the basic pay on record is used
export const basisNote = (payHistoryStart) => {
  const since = payHistoryStart ? ` (${formatDateKey(payHistoryStart)})` : "";
  return `Uses the basic pay in force on each working day, and the basic pay on record for days before pay changes started being recorded${since}. Absences are not deducted yet; deductions come with payroll.`;
};

export const YEAR_END_NOTE =
  "1–10 and 26–31: the two parts of the year-end cut-off, worth one cut-off together.";

// Same rule as the server's `kind`: a cut-off is computed once it has ended (its last
// day is before the as-of date) and projected until then, including on its last day.
// Only used to style the totals row; each employee's cells use the server's `kind`.
export const isProjectedCutoff = (cutoff, asOf) => cutoff.end >= asOf;

// Column label: "1st" or "2nd", or the days of a year-end part ("1–10" in January,
// "26–31" in December)
export const cutoffColumnLabel = (cutoff) =>
  cutoff.half === "yearEnd"
    ? `${Number(cutoff.start.slice(8, 10))}–${Number(cutoff.end.slice(8, 10))}`
    : cutoff.half;

// The 25 cut-off columns grouped by month for the two-row header:
// [{ month, label, cutoffs }]; a month can have 2 or 3 columns
export const groupCutoffsByMonth = (cutoffs = []) =>
  cutoffs.reduce((groups, cutoff) => {
    const last = groups[groups.length - 1];
    if (last && last.month === cutoff.month) {
      last.cutoffs.push(cutoff);
    } else {
      groups.push({
        month: cutoff.month,
        label: MONTHS[Number(cutoff.month.slice(5, 7)) - 1],
        cutoffs: [cutoff],
      });
    }
    return groups;
  }, []);

export const incompleteNote = (count) =>
  `${count} incomplete, not in the totals`;

// "Totals (12 employees)"; `employees` is the number of complete rows counted
export const totalsLabel = (employees = 0) =>
  `Totals (${employees} ${employees === 1 ? "employee" : "employees"})`;
