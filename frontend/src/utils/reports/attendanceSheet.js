import XLSX from "xlsx-js-style";
import {
  allBorders,
  thickAllBorders,
  topBottomBorder,
  leftAlign,
  centerAlign,
  blackFont,
  blackFill,
  redFont,
  blueFill,
  redFill,
  greenFill,
  darkGrayFill,
  labelFill,
  dayFill,
  setCell,
  getDayFill,
  dayColumnWidth,
  dayNames,
} from "./excelStyles";
import { formatKey, isNotEmployedOn } from "./reportHelpers";
import {
  NOT_EMPLOYED,
  getLeaveMark,
  isUnfiledAbsence,
  leaveLegendEntries,
  writeLegend,
} from "./leaveCodes";
import { manilaToday } from "../cutoff";
import { isAdminRole } from "../roles";

const buildAttendanceMap = (attendanceRecords) => {
  const attendanceMap = {};
  attendanceRecords.forEach((record) => {
    const userId = record.userId?._id || record.userId;
    const dateKey = formatKey(record.date);
    if (!attendanceMap[userId]) attendanceMap[userId] = {};
    attendanceMap[userId][dateKey] = record;
  });
  return attendanceMap;
};

// The text and fill of one day: an approved leave's code (VL, SL, LWOP, ML, ...), LWOP also
// for an Absent row or a past weekday with no row, LATE, "/" for a half day, "-" when not employed
export const getDayCell = ({ record, dateKey, todayKey, isNotEmployed }) => {
  if (isNotEmployed) return { text: NOT_EMPLOYED.code };

  const mark = getLeaveMark({ record, dateKey, todayKey, isNotEmployed });
  if (mark) return { text: mark.code, fill: mark.fill };

  if (record?.behavior === "Late") return { text: "LATE", fill: redFill };
  if (record?.behavior === "Half-Day") return { text: "/" };
  return { text: "" };
};

export const AttendanceSheet = ({
  label,
  cutoff,
  startDate,
  endDate,
  employeeData,
  attendanceRecords,
}) => {
  const cutoffDates = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    cutoffDates.push(new Date(d));
  }

  const ws1 = {};
  const totalCols = 5 + cutoffDates.length;

  // First Row
  for (let c = 0; c < totalCols; c++) setCell(ws1, 0, c, "", "s", {});

  // Second Row
  for (let c = 0; c <= 4; c++) setCell(ws1, 1, c, "", "s", {});

  // REG/HOL Row
  cutoffDates.forEach((d, i) => {
    setCell(ws1, 1, 5 + i, "REG", "s", {
      font: { bold: true, sz: 11, color: blackFill },
      fill: blueFill,
      border: topBottomBorder,
      alignment: centerAlign,
    });
  });

  // Third Row
  setCell(ws1, 2, 1, `ACESER Corporation - ${label}`, "s", {
    font: { bold: true, sz: 12, color: blackFill },
    alignment: centerAlign,
  });

  cutoffDates.forEach((d, i) => {
    const dayFill = getDayFill(d);
    setCell(ws1, 2, 5 + i, dayNames[d.getDay()], "s", {
      font: {
        bold: true,
        sz: 11,
        color: blackFill,
      },
      ...(dayFill ? { fill: dayFill } : {}),
      alignment: centerAlign,
    });
  });

  // Fourth Row
  setCell(ws1, 3, 0, "", "s", {});
  setCell(ws1, 3, 1, "ATTENDANCE SUMMARY", "s", {
    font: { bold: true, sz: 12, color: blackFill },
    fill: greenFill,
    border: thickAllBorders,
    alignment: centerAlign,
  });
  for (let c = 2; c <= 4; c++) {
    setCell(ws1, 3, c, "", "s", { fill: greenFill, border: thickAllBorders });
  }

  cutoffDates.forEach((d, i) => {
    setCell(ws1, 3, 5 + i, "", "s", {
      fill: blueFill,
      border: topBottomBorder,
      alignment: centerAlign,
    });
  });

  // Fifth Row
  setCell(ws1, 4, 0, "", "s", {});
  ["EMP NO.", "PERSONNEL", "CATEGORY", "SITE/OFFICE"].forEach((colLabel, i) => {
    setCell(ws1, 4, 1 + i, colLabel, "s", {
      font: { sz: 12, color: { rgb: "FFFFFF" } },
      fill: colLabel === "SITE/OFFICE" ? labelFill : darkGrayFill,
      border: allBorders,
      alignment: centerAlign,
    });
  });

  cutoffDates.forEach((d, i) => {
    setCell(ws1, 4, 5 + i, d.getDate(), "n", {
      font: {
        sz: 12,
        color: blackFill,
      },
      fill: dayFill,
      border: allBorders,
      alignment: centerAlign,
    });
  });

  // Employee List
  const attendanceMap = buildAttendanceMap(attendanceRecords);
  const employees = employeeData.filter((e) => !isAdminRole(e.role));
  const dailyCounts = cutoffDates.map(() => 0);
  const todayKey = manilaToday();
  let longestDayText = 0;

  let rowIndex = 5;
  let number = 1;

  employees.forEach((employee) => {
    const employeeAttendance = attendanceMap[employee._id] || {};

    setCell(ws1, rowIndex, 0, number, "n", {
      font: { sz: 11, ...blackFont },
      border: null,
      alignment: centerAlign,
    });
    [
      employee.employeeId || "",
      `${employee.lastName || ""}, ${employee.firstName || ""}`.toUpperCase(),
      (employee.jobDescription.category || "").toUpperCase(),
      (employee.jobDescription.designation || "").toUpperCase(),
    ].forEach((val, i) => {
      setCell(ws1, rowIndex, 1 + i, val, "s", {
        font: { sz: 11, color: blackFill },
        border: allBorders,
        alignment: i === 1 ? leftAlign : centerAlign,
      });
    });

    cutoffDates.forEach((d, i) => {
      const dateKey = formatKey(d);
      const dayIndex = d.getDay();
      const isWeekendDay = dayIndex === 0 || dayIndex === 6;
      const dayFill = getDayFill(d);
      const record = employeeAttendance[dateKey];
      const isNotEmployed = isNotEmployedOn(employee, dateKey);
      const cell = getDayCell({ record, dateKey, todayKey, isNotEmployed });

      // Every weekday that isn't On-Time, including unfiled absences (LWOP) with no row
      if (
        !isNotEmployed &&
        !isWeekendDay &&
        ((record && record.behavior !== "On-Time") ||
          isUnfiledAbsence({ record, dateKey, todayKey, isNotEmployed }))
      ) {
        dailyCounts[i] += 1;
      }

      longestDayText = Math.max(longestDayText, cell.text.length);
      const fill = cell.fill || dayFill;

      setCell(ws1, rowIndex, 5 + i, cell.text, "s", {
        ...(fill ? { fill } : {}),
        border: allBorders,
        alignment: centerAlign,
      });
    });

    number++;
    rowIndex++;

    cutoffDates.forEach((d, i) => {
      setCell(ws1, 3, 5 + i, dailyCounts[i], "n", {
        font: { sz: 11, bold: true, ...redFont },
        fill: blueFill,
        border: topBottomBorder,
        alignment: centerAlign,
      });
    });
  });

  // Legend, one blank row under the employees
  const lastRow = writeLegend(ws1, rowIndex + 1, [
    { code: "LATE", meaning: "Late", fill: redFill },
    { code: "/", meaning: "Half day" },
    ...leaveLegendEntries({ includeLwop: true }),
    NOT_EMPLOYED,
  ]);

  ws1["!merges"] = [
    { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: 4 } },
  ];

  ws1["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: lastRow, c: totalCols - 1 },
  });

  // All day columns share one width, wide enough for the longest code shown
  const dayWidth = dayColumnWidth(longestDayText);
  ws1["!cols"] = [
    { wch: 3 },
    { wch: 9 },
    { wch: 37 },
    { wch: 16 },
    { wch: 16 },
    ...cutoffDates.map(() => ({ wch: dayWidth })),
  ];

  ws1["!rows"] = [
    { hpt: 7 },
    { hpt: 16 },
    { hpt: 16 },
    { hpt: 16 },
    ...Array(lastRow - 3).fill({ hpt: 16 }),
  ];

  return { ws1, cutoff };
};
