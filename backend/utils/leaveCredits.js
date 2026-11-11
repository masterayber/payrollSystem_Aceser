// Vacation and sick leave credits. Nothing is stored: balances are worked out from the
// date of regularization, the admin's VL opening balance and the employee's leave requests.
// - VL: 15 days on the date of regularization, then 15 more every January 1; unused days
//   carry over with no cap.
// - SL: 15 days each calendar month, from the date of regularization on; unused days don't
//   carry over. A request across two months counts against each month.
// Only Monday-Friday counts, and pending requests hold their days until they're decided.
// The leave types, and which of them use credits, are listed in config/leaveTypes.js.

const { CREDIT_LEAVE_TYPES, isLeaveType } = require("../config/leaveTypes");

const VACATION_LEAVE = "Vacation Leave";
const SICK_LEAVE = "Sick Leave";
const DAYS_PER_GRANT = 15;

const UNKNOWN_LEAVE_TYPE = "Choose a leave type from the list.";
const NO_WORKING_DAYS = "This leave has no working days (Monday to Friday).";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// A saved Date or a "YYYY-MM-DD" string as "YYYY-MM-DD" ("" when missing or invalid)
const toDateKey = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : "";
};

// Monday-Friday dates from start to end (both included), as "YYYY-MM-DD"
const weekdaysBetween = (startKey, endKey) => {
  const days = [];
  for (
    let date = new Date(`${startKey}T00:00:00Z`);
    toDateKey(date) <= endKey;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) days.push(toDateKey(date));
  }
  return days;
};

// Today in Manila (UTC+8) as "YYYY-MM-DD"
const manilaToday = () =>
  new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

// "2026-10" as "October 2026"
const monthName = (month) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const leaveDays = (leave) =>
  weekdaysBetween(toDateKey(leave.startDate), toDateKey(leave.endDate));

// VL earned up to and including `asOfKey`: the opening balance, 15 on the date of
// regularization, and 15 on each January 1 after it
const vacationEarned = (job, asOfKey) => {
  const opening = job.vacationLeaveOpening || 0;
  const regularizationKey = toDateKey(job.regularizationDate);
  if (!regularizationKey || asOfKey < regularizationKey) return opening;

  const years =
    Number(asOfKey.slice(0, 4)) - Number(regularizationKey.slice(0, 4));
  return opening + DAYS_PER_GRANT * (1 + years);
};

// Days held by approved and pending requests of one type, by date
const daysTaken = (leaves, leaveType) =>
  leaves
    .filter(
      (leave) =>
        leave.leaveType === leaveType &&
        ["Approved", "Pending"].includes(leave.status),
    )
    .flatMap((leave) => leaveDays(leave).map((day) => ({ day, leave })));

// The balance shown to the employee and the admin, as of `todayKey`
const leaveBalance = (job, leaves, todayKey) => {
  const regularizationKey = toDateKey(job.regularizationDate);
  const month = todayKey.slice(0, 7);

  const vacationTaken = daysTaken(leaves, VACATION_LEAVE);
  const sickTaken = daysTaken(leaves, SICK_LEAVE).filter(({ day }) =>
    day.startsWith(month),
  );
  const count = (taken, status) =>
    taken.filter(({ leave }) => leave.status === status).length;

  const vacationTotal = vacationEarned(job, todayKey);
  const sickTotal =
    regularizationKey && regularizationKey <= todayKey ? DAYS_PER_GRANT : 0;

  return {
    regularizationDate: regularizationKey,
    vacation: {
      earned: vacationTotal,
      used: count(vacationTaken, "Approved"),
      pending: count(vacationTaken, "Pending"),
      available: vacationTotal - vacationTaken.length,
    },
    sick: {
      month,
      earned: sickTotal,
      used: count(sickTaken, "Approved"),
      pending: count(sickTaken, "Pending"),
      available: sickTotal - sickTaken.length,
    },
  };
};

// Checks the dates of a leave request (any type). Returns { error } or { startKey, endKey }.
const checkLeaveDates = ({ startDate, endDate }) => {
  const isDate = (value) =>
    typeof value === "string" && DATE_PATTERN.test(value) && toDateKey(value);
  if (!isDate(startDate) || !isDate(endDate)) {
    return { error: "Enter the start and end dates as valid dates." };
  }
  if (endDate < startDate) {
    return { error: "The end date can't be before the start date." };
  }
  return { startKey: startDate, endKey: endDate };
};

// Why a leave type can't be filed, or null: it has to be one of the names on the list
const leaveTypeError = (leaveType) =>
  isLeaveType(leaveType) ? null : UNKNOWN_LEAVE_TYPE;

// Why a leave over these dates can't be filed, whatever its type, or null: it needs at
// least one Monday-to-Friday day. (Approval still marks its Saturdays and Sundays On-Leave.)
const workingDaysError = ({ startKey, endKey }) =>
  weekdaysBetween(startKey, endKey).length === 0 ? NO_WORKING_DAYS : null;

// Checks that a VL or SL request fits the employee's credits. `leaves` are the employee's
// other requests (not this one). Returns an error message, or null when it fits (or the
// leave type doesn't use credits).
const checkLeaveCredits = (job, leaves, request) => {
  const { leaveType, startKey, endKey } = request;
  if (!CREDIT_LEAVE_TYPES.includes(leaveType)) return null;

  // Filing refuses this for every type (workingDaysError). It stays here for approval,
  // which checks a VL or SL request again and may meet one saved before that rule.
  const days = weekdaysBetween(startKey, endKey);
  if (days.length === 0) return NO_WORKING_DAYS;

  const regularizationKey = toDateKey(job.regularizationDate);
  const opening = job.vacationLeaveOpening || 0;
  const hasCredits =
    leaveType === VACATION_LEAVE
      ? regularizationKey || opening
      : regularizationKey;
  if (!hasCredits) {
    return `${leaveType} credits start on the date of regularization, which isn't set yet.`;
  }
  if (leaveType === SICK_LEAVE && startKey < regularizationKey) {
    return `${leaveType} credits start on the date of regularization (${regularizationKey}).`;
  }

  const daysText = (n) => `${n} day${n === 1 ? "" : "s"}`;

  if (leaveType === VACATION_LEAVE) {
    const left =
      vacationEarned(job, startKey) - daysTaken(leaves, VACATION_LEAVE).length;
    if (days.length > left) {
      return `Not enough Vacation Leave: ${daysText(Math.max(left, 0))} left, and this request needs ${days.length}.`;
    }
    return null;
  }

  // SL: each month the request touches has its own 15 days
  const sickTaken = daysTaken(leaves, SICK_LEAVE);
  const months = [...new Set(days.map((day) => day.slice(0, 7)))];
  for (const month of months) {
    const needed = days.filter((day) => day.startsWith(month)).length;
    const left =
      DAYS_PER_GRANT -
      sickTaken.filter(({ day }) => day.startsWith(month)).length;
    if (needed > left) {
      return `Not enough Sick Leave for ${monthName(month)}: ${daysText(Math.max(left, 0))} left that month, and this request needs ${needed}.`;
    }
  }
  return null;
};

module.exports = {
  CREDIT_LEAVE_TYPES,
  toDateKey,
  manilaToday,
  weekdaysBetween,
  vacationEarned,
  leaveBalance,
  checkLeaveDates,
  leaveTypeError,
  workingDaysError,
  checkLeaveCredits,
};
