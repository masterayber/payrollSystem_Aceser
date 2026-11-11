// Basic pay history: which pay was in force on a day, and what to record when an admin
// saves a new basic pay. Pure functions; the records live in models/basicPayChange.js.
// - Every saved change records { amount, effectiveFrom: the save day in Manila }.
// - The first change for someone with no history first records the old pay (when there
//   was one) as in force from the later of the start date and the day pay history began
//   (PAY_HISTORY_START), so the days before the change keep the pay they were earned at.
// - A self sign-up's starting pay ("Pay needs an update": the stored payNotSet flag) is
//   not a pay anyone earned at: its first saved pay is recorded alone, from the save day,
//   so it covers every earlier day too.
// - A save that doesn't change the amount, or clears it, records nothing.
// - Two changes on the same day: the later one wins (one record per day).
// - Days before the first record use its amount; with no history, the current basic pay.

const { PAY_HISTORY_START } = require("../config/payroll");
const { toDateKey } = require("./leaveCredits");

const isAmount = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

// The entries to record when an admin saves a basic pay, oldest first, each
// { amount, effectiveFrom: "YYYY-MM-DD" }. `oldPay` is the saved basic pay before the
// save (null or undefined when none), `newPay` the one being saved, `hasHistory` whether
// the employee already has any record, `startDate` the start date after the save.
// `payWasNotSet` is the stored payNotSet flag before the save: when true the old pay is
// ignored (as if there were none), even when it equals the new one.
const payChangesToRecord = ({
  oldPay: savedPay,
  newPay,
  hasHistory,
  startDate,
  todayKey,
  historyStartKey = PAY_HISTORY_START,
  payWasNotSet = false,
}) => {
  const oldPay = payWasNotSet === true ? undefined : savedPay;
  if (!isAmount(newPay)) return [];
  if (isAmount(oldPay) && oldPay === newPay) return [];

  const entries = [];
  if (!hasHistory && isAmount(oldPay)) {
    const startKey = toDateKey(startDate);
    const from =
      startKey && startKey > historyStartKey ? startKey : historyStartKey;
    // A start date on or after today needs no old pay: the new one covers every day
    if (from < todayKey) entries.push({ amount: oldPay, effectiveFrom: from });
  }
  entries.push({ amount: newPay, effectiveFrom: todayKey });
  return entries;
};

// The pay history as [{ amount, effectiveFrom: "YYYY-MM-DD" }], oldest first. Records
// may carry effectiveFrom as a Date or a key; on the same day the later changedAt wins.
const sortHistory = (history = []) => {
  const byDay = new Map();
  [...history]
    .map((entry) => ({
      amount: entry.amount,
      effectiveFrom: toDateKey(entry.effectiveFrom),
      changedAt: entry.changedAt ? new Date(entry.changedAt).getTime() : 0,
    }))
    .filter((entry) => entry.effectiveFrom && isAmount(entry.amount))
    .sort((a, b) => a.changedAt - b.changedAt)
    .forEach((entry) => byDay.set(entry.effectiveFrom, entry));

  return [...byDay.values()]
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1))
    .map(({ amount, effectiveFrom }) => ({ amount, effectiveFrom }));
};

// A function giving the monthly basic pay in force on a "YYYY-MM-DD" day: the latest
// entry effective on or before it; before the first entry, the first entry's amount;
// with no history, the current basic pay.
const payInForce = (history, currentPay) => {
  const entries = sortHistory(history);
  if (!entries.length) return () => currentPay;

  return (dayKey) => {
    let pay = entries[0].amount;
    for (const entry of entries) {
      if (entry.effectiveFrom > dayKey) break;
      pay = entry.amount;
    }
    return pay;
  };
};

module.exports = { payChangesToRecord, sortHistory, payInForce };
