// Pay periods (cut-offs). ACESER pays twice a month:
//   1st cut-off of a month: the 11th to the 25th
//   2nd cut-off of a month: the 26th to the 10th of the next month
// Dates are "YYYY-MM-DD" strings in Manila time, so a day never shifts with the
// browser's time zone. A cut-off is { year, monthIndex, half }, with half "1st" or "2nd".

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n) => String(n).padStart(2, "0");

// Date.UTC rolls over month 12 and day overflow, so December's 2nd cut-off ends in January
const dateKey = (year, monthIndex, day) =>
  new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);

// Any date or ISO string as a Manila "YYYY-MM-DD" ("en-CA" formats dates that way)
export const toManilaDate = (value) =>
  new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

export const manilaToday = () => toManilaDate(new Date());

// The cut-off a "YYYY-MM-DD" date falls in; the 1st-10th belong to the previous month's 2nd
export const getCutoffFor = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const monthIndex = month - 1;

  if (day >= 11 && day <= 25) return { year, monthIndex, half: "1st" };
  if (day >= 26) return { year, monthIndex, half: "2nd" };
  return monthIndex === 0
    ? { year: year - 1, monthIndex: 11, half: "2nd" }
    : { year, monthIndex: monthIndex - 1, half: "2nd" };
};

export const getPreviousCutoff = ({ year, monthIndex, half }) => {
  if (half === "2nd") return { year, monthIndex, half: "1st" };
  return monthIndex === 0
    ? { year: year - 1, monthIndex: 11, half: "2nd" }
    : { year, monthIndex: monthIndex - 1, half: "2nd" };
};

// First and last day, both included, as "YYYY-MM-DD"
export const getCutoffRange = ({ year, monthIndex, half }) =>
  half === "1st"
    ? {
        start: dateKey(year, monthIndex, 11),
        end: dateKey(year, monthIndex, 25),
      }
    : {
        start: dateKey(year, monthIndex, 26),
        end: dateKey(year, monthIndex + 1, 10),
      };

// The value dropdowns store, e.g. "2026-10-1st"
export const toCutoffValue = ({ year, monthIndex, half }) =>
  `${year}-${pad(monthIndex + 1)}-${half}`;

export const parseCutoffValue = (value) => {
  const [year, month, half] = value.split("-");
  return { year: Number(year), monthIndex: Number(month) - 1, half };
};

// "October 2026 1st Cut-off"
export const getCutoffLabel = ({ year, monthIndex, half }) =>
  `${MONTHS[monthIndex]} ${year} ${half} Cut-off`;

// Dropdown options, newest first: the current cut-off, then the ones before it.
// `since` (e.g. a hire date) stops the list at the cut-off that date falls in.
export const getCutoffOptions = ({
  count = 6,
  today = manilaToday(),
  since,
} = {}) => {
  const firstValue = since ? toCutoffValue(getCutoffFor(since)) : null;
  const options = [];
  let cutoff = getCutoffFor(today);

  while (options.length < count) {
    const value = toCutoffValue(cutoff);
    options.push({ value, label: getCutoffLabel(cutoff) });
    if (value === firstValue) break;
    cutoff = getPreviousCutoff(cutoff);
  }

  return options;
};
