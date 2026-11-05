// Pay periods (cut-offs), the backend copy of frontend/src/utils/cutoff.js (Node can't
// require the frontend's ES module). backend/tests/cutoff.test.js runs one table of
// cases against both copies, so keep them in step.
//   1st cut-off of a month: the 11th to the 25th
//   2nd cut-off of a month: the 26th to the 10th of the next month
// Dates are "YYYY-MM-DD" strings in Manila time. A cut-off is { year, monthIndex, half },
// with half "1st" or "2nd".

const pad = (n) => String(n).padStart(2, "0");

// Date.UTC rolls over month 12 and day overflow, so December's 2nd cut-off ends in January
const dateKey = (year, monthIndex, day) =>
  new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);

// The cut-off a "YYYY-MM-DD" date falls in; the 1st-10th belong to the previous month's 2nd
const getCutoffFor = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const monthIndex = month - 1;

  if (day >= 11 && day <= 25) return { year, monthIndex, half: "1st" };
  if (day >= 26) return { year, monthIndex, half: "2nd" };
  return monthIndex === 0
    ? { year: year - 1, monthIndex: 11, half: "2nd" }
    : { year, monthIndex: monthIndex - 1, half: "2nd" };
};

// First and last day, both included, as "YYYY-MM-DD"
const getCutoffRange = ({ year, monthIndex, half }) =>
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
const toCutoffValue = ({ year, monthIndex, half }) =>
  `${year}-${pad(monthIndex + 1)}-${half}`;

const parseCutoffValue = (value) => {
  const [year, month, half] = value.split("-");
  return { year: Number(year), monthIndex: Number(month) - 1, half };
};

// A calendar year's pay periods for 13th month pay, oldest first: 25 parts, January 1 to
// December 31. The cut-off that crosses New Year (Dec 26 to Jan 10) is split at
// December 31, and a year's two pieces of it (Jan 1-10 and Dec 26-31) make up its
// **year-end cut-off**, worth one cut-off. So a year is:
//   - "YYYY-01-yearEnd": Jan 1 to Jan 10 (first part of the year-end cut-off)
//   - 23 ordinary cut-offs, "YYYY-01-1st" (Jan 11-25) to "YYYY-12-1st" (Dec 11-25)
//   - "YYYY-12-yearEnd": Dec 26 to Dec 31 (second part of the year-end cut-off)
// Each is { cutoff, month, half, start, end }, half "1st", "2nd" or "yearEnd".
const YEAR_END = "yearEnd";

const calendarYearCutoffs = (year) => {
  const yearEnd = (monthIndex, startDay, endDay) => ({
    cutoff: `${year}-${pad(monthIndex + 1)}-${YEAR_END}`,
    month: `${year}-${pad(monthIndex + 1)}`,
    half: YEAR_END,
    start: dateKey(year, monthIndex, startDay),
    end: dateKey(year, monthIndex, endDay),
  });

  const cutoffs = [yearEnd(0, 1, 10)];
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    for (const half of ["1st", "2nd"]) {
      // December's 2nd cut-off is split: its Dec 26-31 days are this year's year-end
      // part, its Jan 1-10 days belong to the next year
      if (monthIndex === 11 && half === "2nd") continue;
      const cutoff = { year, monthIndex, half };
      cutoffs.push({
        cutoff: toCutoffValue(cutoff),
        month: `${year}-${pad(monthIndex + 1)}`,
        half,
        ...getCutoffRange(cutoff),
      });
    }
  }
  cutoffs.push(yearEnd(11, 26, 31));
  return cutoffs;
};

module.exports = {
  getCutoffFor,
  getCutoffRange,
  toCutoffValue,
  parseCutoffValue,
  YEAR_END,
  calendarYearCutoffs,
};
