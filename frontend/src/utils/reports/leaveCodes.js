// Day codes the Attendance and Leave sheets share: the code of each approved leave type.
// LWOP means Absent: an approved LWOP and a workday missed without an approved leave are
// both LWOP. It is an absence, not a leave, so it shows only on the Attendance sheet.
// A non-working holiday on a Monday-to-Friday day is a paid day off, never LWOP: it shows HOL.
// Pure functions on "YYYY-MM-DD" keys, so a day never shifts with the time zone.

import {
  allBorders,
  blackFont,
  centerAlign,
  holidayFill,
  leftAlign,
  lwopFill,
  otherLeaveFill,
  setCell,
  sleaveFill,
  vleaveFill,
} from "./excelStyles";
import { LEAVE_TYPES } from "../leaveTypes";
import { isNonWorkingHoliday } from "../holidays";

// Excel colors are a report matter, so they stay here: a type with no fill of its own
// gets the other-leave fill
const FILL_BY_CODE = { VL: vleaveFill, SL: sleaveFill, LWOP: lwopFill };

// Every type the Leave form offers (the shared list, in its order), as filed, with its code
export const LEAVE_CODES = LEAVE_TYPES.map(({ name, code }) => ({
  leaveType: name,
  code,
  fill: FILL_BY_CODE[code] || otherLeaveFill,
}));

const LWOP_LEAVE_TYPE = LEAVE_TYPES.find(({ code }) => code === "LWOP").name;

// An approved leave whose type is missing or not in the list above
export const OTHER_LEAVE = {
  code: "LEAVE",
  meaning: "Approved leave of another type",
  fill: otherLeaveFill,
};

// The one LWOP legend line (Attendance sheet): approved LWOP and unfiled absences alike
export const LWOP_MEANING = "Absent (leave without pay)";

// A non-working holiday (Regular or Special Non-Working) on a Monday-to-Friday day
// (Attendance sheet)
export const HOLIDAY = {
  code: "HOL",
  meaning: "Holiday (non-working)",
  fill: holidayFill,
};

export const NOT_EMPLOYED = { code: "-", meaning: "Not employed on that day" };

const leaveEntryFor = (leaveType) =>
  LEAVE_CODES.find((entry) => entry.leaveType === leaveType) || OTHER_LEAVE;

export const isLeaveDay = (record) => record?.behavior === "On-Leave";

// An approved LWOP: an absence, so the Leave sheet neither shows nor counts it
export const isLwopLeaveDay = (record) =>
  isLeaveDay(record) && record.leaveType === LWOP_LEAVE_TYPE;

// The days the Leave sheet shows and counts: approved leaves other than LWOP
export const isLeaveSheetDay = (record) =>
  isLeaveDay(record) && !isLwopLeaveDay(record);

export const leaveCodeFor = (leaveType) => leaveEntryFor(leaveType).code;

// The code and fill of an approved leave of this type
export const leaveMarkFor = (leaveType) => {
  const { code, fill } = leaveEntryFor(leaveType);
  return { code, fill };
};

// Mon-Fri, read from the key itself (Date.UTC, so the browser's zone can't move it)
export const isWeekdayKey = (dateKey) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday >= 1 && weekday <= 5;
};

// Not filed: a weekday (Mon-Fri) with an Absent row, or a weekday before today with no row.
// Weekends never count, Absent row or not. Days outside the employment (before the start
// date, after the last working day) never count either. `holiday` is that date's holiday
// ({ type, name }) or nothing: a non-working holiday is a paid day off, never an absence.
export const isUnfiledAbsence = ({
  record,
  dateKey,
  todayKey,
  isNotEmployed,
  holiday,
}) => {
  if (isNotEmployed || !isWeekdayKey(dateKey)) return false;
  if (isNonWorkingHoliday(holiday?.type)) return false;
  if (record) return record.behavior === "Absent";
  return dateKey < todayKey;
};

// The code and fill of an approved leave day, LWOP for an unfiled absence, or HOL for a
// non-working holiday; null for any other day.
// LWOP is an absence, so a weekend never shows it: an approved LWOP that spans a weekend is
// blank on Saturday and Sunday, as it was before.
// HOL takes the place of LWOP only: on a Mon-Fri non-working holiday a day with no row
// (past, today or future), an Absent row and an approved LWOP all show HOL. Any other
// approved leave keeps its code, a row with a time in or out is unchanged, and a weekend
// never shows HOL. "Special Working", or no `holiday`, changes nothing.
export const getLeaveMark = ({
  record,
  dateKey,
  todayKey,
  isNotEmployed,
  holiday,
}) => {
  if (isNotEmployed) return null;

  const isDayOff =
    isWeekdayKey(dateKey) && isNonWorkingHoliday(holiday?.type);
  const holidayMark = { code: HOLIDAY.code, fill: HOLIDAY.fill };

  if (isLwopLeaveDay(record)) {
    if (!isWeekdayKey(dateKey)) return null;
    return isDayOff ? holidayMark : leaveMarkFor(LWOP_LEAVE_TYPE);
  }
  if (isLeaveDay(record)) return leaveMarkFor(record.leaveType);
  if (isDayOff && (!record || record.behavior === "Absent")) return holidayMark;
  if (isUnfiledAbsence({ record, dateKey, todayKey, isNotEmployed, holiday })) {
    return leaveMarkFor(LWOP_LEAVE_TYPE);
  }
  return null;
};

// Legend lines for the leave codes, in the order the Leave form lists them.
// With `includeLwop` (Attendance sheet) LWOP gets its one line, "Absent (leave without pay)";
// without it (Leave sheet) LWOP is left out.
export const leaveLegendEntries = ({ includeLwop = false } = {}) => [
  ...LEAVE_CODES.filter(
    ({ leaveType }) => includeLwop || leaveType !== LWOP_LEAVE_TYPE,
  ).map(({ leaveType, code, fill }) => ({
    code,
    meaning: leaveType === LWOP_LEAVE_TYPE ? LWOP_MEANING : leaveType,
    fill,
  })),
  OTHER_LEAVE,
];

// "LEGEND" title, then one row per entry: the code in its own colors, its meaning beside it.
// Returns the last row written.
export const writeLegend = (ws, startRow, entries, codeCol = 2) => {
  let r = startRow;
  setCell(ws, r, codeCol, "LEGEND", "s", {
    font: { bold: true, sz: 11, ...blackFont },
    alignment: leftAlign,
  });

  entries.forEach(({ code, meaning, fill, font }) => {
    r += 1;
    setCell(ws, r, codeCol, code, "s", {
      font: { sz: 11, ...blackFont, ...(font || {}) },
      ...(fill ? { fill } : {}),
      border: allBorders,
      alignment: centerAlign,
    });
    setCell(ws, r, codeCol + 1, meaning, "s", {
      font: { sz: 11, ...blackFont },
      alignment: leftAlign,
    });
  });

  return r;
};
