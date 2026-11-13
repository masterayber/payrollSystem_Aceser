// Pay days: what each day of a cut-off is for pay (rule 6 of the deductions plan). Pure
// functions on "YYYY-MM-DD" keys in Manila time; nothing is read from the database, the
// caller hands in the attendance rows and the holiday list it has loaded.
//
// Each day is exactly one kind. The first line that fits wins:
//   weekend      Saturday or Sunday: never a paid or an unpaid day, whatever row or
//                holiday it has
//   notEmployed  before the start date (the day the account was created when there is no
//                start date) or after a resigned employee's last working day: no pay
//   holiday      a holiday of a non-working type (config/holidays.js): paid, whatever the
//                attendance row says (none, Absent, an approved LWOP, a worked row).
//                "Special Working" is an ordinary working day: the lines below decide
//   worked       a row with a time in or a time out: paid in full, whatever its behavior
//   paidLeave    an On-Leave row whose leave type is paid (config/leaveTypes.js `paid`);
//                a type that isn't on the list (old data) counts as paid, since an
//                approved leave should not dock pay unless HR says so
//   unpaidLeave  an On-Leave row whose leave type is not paid (LWOP, today): unpaid
//   absent       an Absent row: unpaid
//   noRecord     a day before today with no row: unpaid, and flagged for the admin to check
//   undecided    anything left: today or a later day with no row yet, or a row with no
//                times that is neither On-Leave nor Absent (Pending). Neither paid nor
//                unpaid: the attendance sheet shows no LWOP for it, so pay does not dock it
// The unpaid kinds are exactly the days the attendance sheet shows LWOP
// (frontend/src/utils/reports/leaveCodes.js); backend/tests/payDays.test.js runs one table
// against both, so a change here needs the same change there.
//
//   employmentKeys({ job, status, createdAt })       -> { startKey, lastKey }
//   employedWeekdays({ startKey, lastKey }, { start, end }) -> ["YYYY-MM-DD", ...]
//   payDayKind({ dateKey, todayKey, record, holiday, isNotEmployed }) -> a kind
//   classifyPayDays({ range | cutoff, todayKey, employment, attendance, holidays })
//                                                     -> { days, summary, undecided }

const { LEAVE_TYPES } = require("../config/leaveTypes");
const { isNonWorkingHoliday } = require("../config/holidays");
const { getCutoffRange, parseCutoffValue } = require("./cutoff");
const { toDateKey, manilaToday, weekdaysBetween } = require("./leaveCredits");
const { cutoffShare } = require("./thirteenthMonth");

const DAY_KINDS = {
  WEEKEND: "weekend",
  NOT_EMPLOYED: "notEmployed",
  HOLIDAY: "holiday",
  WORKED: "worked",
  PAID_LEAVE: "paidLeave",
  UNPAID_LEAVE: "unpaidLeave",
  ABSENT: "absent",
  NO_RECORD: "noRecord",
  UNDECIDED: "undecided",
};

// The kinds that earn the day's pay, and the kinds that lose it. A weekend, a day not
// employed and an undecided day are in neither list.
const PAID_KINDS = [DAY_KINDS.HOLIDAY, DAY_KINDS.WORKED, DAY_KINDS.PAID_LEAVE];
const UNPAID_KINDS = [
  DAY_KINDS.UNPAID_LEAVE,
  DAY_KINDS.ABSENT,
  DAY_KINDS.NO_RECORD,
];

const isPaidKind = (kind) => PAID_KINDS.includes(kind);
const isUnpaidKind = (kind) => UNPAID_KINDS.includes(kind);

// Monday to Friday, read from the key itself
const isWeekday = (dateKey) => weekdaysBetween(dateKey, dateKey).length === 1;

// Every calendar day from start to end (both included), as "YYYY-MM-DD"
const daysBetween = (startKey, endKey) => {
  const days = [];
  for (
    let date = new Date(`${startKey}T00:00:00Z`);
    toDateKey(date) <= endKey;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    days.push(toDateKey(date));
  }
  return days;
};

// The Manila (UTC+8) day of a moment in time, e.g. the day an account was created
// ("" when missing or invalid). Start dates and attendance dates are saved as a day at
// 00:00 UTC and are read with toDateKey instead.
const manilaDateKey = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : "";
};

// The first and last day an employee is paid for, as keys ("" when there is none).
// `job` is the job description from Settings, `status` the account status and `createdAt`
// the day the account was created.
// - startKey: the start date; without one, the day the account was created, as the
//   attendance sheet does (frontend isNotEmployedOn). "" when neither is a date: every day
//   then counts as employed.
// - lastKey: the last working day, for a Resigned account only (reinstating clears it and
//   an Active account has none), as the 13th month counts it.
const employmentKeys = ({ job, status, createdAt } = {}) => ({
  startKey: toDateKey(job?.startDate) || manilaDateKey(createdAt),
  lastKey: status === "Resigned" ? toDateKey(job?.resignationDate) : "",
});

// The Monday-to-Friday days of a range the employee was employed on, from the start date
// to the last working day (both included). Counted by the 13th month's cutoffShare, so
// pay and the 13th month can't disagree about a part cut-off.
const employedWeekdays = ({ startKey, lastKey } = {}, { start, end }) =>
  cutoffShare(
    { startDate: startKey || start, resignationDate: lastKey },
    { start, end },
  ).days;

// A time in or out that was really recorded ("--:--" is how a screen shows none)
const hasTime = (value) => Boolean(value) && value !== "--:--";
const hasTimes = (record) => hasTime(record.timeIn) || hasTime(record.timeOut);

// Whether an approved leave of this type keeps its pay: the `paid` flag of the shared
// list. A type that isn't on the list, or a row with no type, is paid.
const isPaidLeaveType = (leaveType) =>
  LEAVE_TYPES.find(({ name }) => name === leaveType)?.paid !== false;

// The kind of one day. `record` is that day's attendance row ({ behavior, leaveType,
// timeIn, timeOut }) or nothing; `holiday` that date's holiday ({ type, name }) or
// nothing; `isNotEmployed` whether the day is outside the employment. The same
// arguments as the attendance sheet's isUnfiledAbsence and getLeaveMark.
const payDayKind = ({ dateKey, todayKey, record, holiday, isNotEmployed }) => {
  if (!isWeekday(dateKey)) return DAY_KINDS.WEEKEND;
  if (isNotEmployed) return DAY_KINDS.NOT_EMPLOYED;
  if (isNonWorkingHoliday(holiday?.type)) return DAY_KINDS.HOLIDAY;

  if (!record) {
    return dateKey < todayKey ? DAY_KINDS.NO_RECORD : DAY_KINDS.UNDECIDED;
  }
  if (hasTimes(record)) return DAY_KINDS.WORKED;
  if (record.behavior === "On-Leave") {
    return isPaidLeaveType(record.leaveType)
      ? DAY_KINDS.PAID_LEAVE
      : DAY_KINDS.UNPAID_LEAVE;
  }
  if (record.behavior === "Absent") return DAY_KINDS.ABSENT;
  return DAY_KINDS.UNDECIDED;
};

// When a day has more than one row (it shouldn't), the row that decides: one with a time
// first, then On-Leave, then Absent, in the order the kinds are checked
const rowRank = (row) => {
  if (hasTimes(row)) return 3;
  if (row.behavior === "On-Leave") return 2;
  if (row.behavior === "Absent") return 1;
  return 0;
};

const rowsByDay = (attendance) => {
  const byDay = new Map();
  for (const row of attendance) {
    const day = toDateKey(row.date);
    const kept = byDay.get(day);
    if (day && (!kept || rowRank(row) > rowRank(kept))) byDay.set(day, row);
  }
  return byDay;
};

// Every day of a range for one employee, and the figures a payslip keeps.
// - `range` is { start, end } as keys (both included); or give `cutoff`, a cut-off value
//   ("2026-10-1st") or object ({ year, monthIndex, half }), for its 11th-to-25th or
//   26th-to-10th range. For pay the cut-off that crosses New Year is one whole cut-off.
// - `todayKey` is today in Manila (the default).
// - `employment` is { startKey, lastKey } from employmentKeys.
// - `attendance` are this employee's rows ({ date, timeIn, timeOut, behavior, leaveType });
//   rows outside the range are ignored.
// - `holidays` is the holiday list ({ date, name, type }), dates as saved or as keys.
// Returns:
// - days: one entry per calendar day, oldest first: { day, kind, holiday, leaveType }.
//   `holiday` is that date's holiday as { name, type } whatever its type (null when
//   there is none); `leaveType` is set for the two leave kinds only.
// - summary: what the payslip stores as `days`: { cutoffWeekdays, employed, paid,
//   unpaid: [{ day, reason }], holidays, paidLeave }. cutoffWeekdays are the range's
//   Monday-to-Friday days and employed those the employee was employed on; paid counts
//   the holiday, worked and paid leave days; `reason` is the day's kind ("unpaidLeave",
//   "absent" or "noRecord"); holidays and paidLeave count the days of those two kinds.
// - undecided: the keys of the days that are neither paid nor unpaid yet, so
//   employed = paid + unpaid.length + undecided.length.
const classifyPayDays = ({
  range,
  cutoff,
  todayKey = manilaToday(),
  employment = {},
  attendance = [],
  holidays = [],
} = {}) => {
  const { start, end } =
    range ||
    getCutoffRange(
      typeof cutoff === "string" ? parseCutoffValue(cutoff) : cutoff,
    );

  const employed = new Set(employedWeekdays(employment, { start, end }));
  const recordOf = rowsByDay(attendance);
  const holidayOf = new Map(
    holidays.map((holiday) => [toDateKey(holiday.date), holiday]),
  );

  const days = daysBetween(start, end).map((day) => {
    const record = recordOf.get(day) || null;
    const holiday = holidayOf.get(day) || null;
    const kind = payDayKind({
      dateKey: day,
      todayKey,
      record,
      holiday,
      isNotEmployed: !employed.has(day),
    });
    const isLeave = [DAY_KINDS.PAID_LEAVE, DAY_KINDS.UNPAID_LEAVE].includes(
      kind,
    );

    return {
      day,
      kind,
      holiday: holiday ? { name: holiday.name, type: holiday.type } : null,
      leaveType: isLeave ? record.leaveType || null : null,
    };
  });

  const count = (matches) => days.filter(({ kind }) => matches(kind)).length;

  return {
    days,
    summary: {
      cutoffWeekdays: weekdaysBetween(start, end).length,
      employed: employed.size,
      paid: count(isPaidKind),
      unpaid: days
        .filter(({ kind }) => isUnpaidKind(kind))
        .map(({ day, kind }) => ({ day, reason: kind })),
      holidays: count((kind) => kind === DAY_KINDS.HOLIDAY),
      paidLeave: count((kind) => kind === DAY_KINDS.PAID_LEAVE),
    },
    undecided: days
      .filter(({ kind }) => kind === DAY_KINDS.UNDECIDED)
      .map(({ day }) => day),
  };
};

module.exports = {
  DAY_KINDS,
  PAID_KINDS,
  UNPAID_KINDS,
  isPaidKind,
  isUnpaidKind,
  isPaidLeaveType,
  employmentKeys,
  employedWeekdays,
  payDayKind,
  classifyPayDays,
};
