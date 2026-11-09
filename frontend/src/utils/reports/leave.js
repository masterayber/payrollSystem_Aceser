import XLSX from "xlsx-js-style";
import {
  allBorders,
  thickAllBorders,
  topBottomBorder,
  leftAlign,
  centerAlign,
  blackFont,
  redFont,
  blackFill,
  blueFill,
  violetFill,
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
  isLeaveSheetDay,
  leaveMarkFor,
  leaveLegendEntries,
  writeLegend,
} from "./leaveCodes";
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

// Approved leaves only: the leave's code (VL, SL, ML, PL, ...), "-" when not employed.
// LWOP is an absence, not a leave: approved or not, it shows (and counts) only on the
// Attendance sheet, so here it is blank.
export const getLeaveDayCell = ({ record, isNotEmployed }) => {
  if (isNotEmployed) return { text: NOT_EMPLOYED.code };
  if (!isLeaveSheetDay(record)) return { text: "" };

  const { code, fill } = leaveMarkFor(record.leaveType);
  return { text: code, fill };
};

export const LeaveSheet = ({
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

  const ws2 = {};
  const totalCols = 5 + cutoffDates.length;

  // First Row
  for (let c = 0; c < totalCols; c++) setCell(ws2, 0, c, "", "s", {});

  // Second Row
  for (let c = 0; c <= 4; c++) setCell(ws2, 1, c, "", "s", {});

  // REG / HOL Row
  cutoffDates.forEach((d, i) => {
    setCell(ws2, 1, 5 + i, "REG", "s", {
      font: { bold: true, sz: 11, color: blackFill },
      fill: blueFill,
      border: topBottomBorder,
      alignment: centerAlign,
    });
  });

  // Third Row
  setCell(ws2, 2, 1, `ACESER Corporation - ${label}`, "s", {
    font: { bold: true, sz: 12, color: blackFill },
    alignment: centerAlign,
  });

  cutoffDates.forEach((d, i) => {
    const dayFill = getDayFill(d);
    setCell(ws2, 2, 5 + i, dayNames[d.getDay()], "s", {
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
  setCell(ws2, 3, 0, "", "s", {});
  setCell(ws2, 3, 1, "LEAVE", "s", {
    font: { bold: true, sz: 12, color: blackFill },
    fill: violetFill,
    border: thickAllBorders,
    alignment: centerAlign,
  });
  for (let c = 2; c <= 4; c++) {
    setCell(ws2, 3, c, "", "s", { fill: violetFill, border: thickAllBorders });
  }

  cutoffDates.forEach((d, i) => {
    setCell(ws2, 3, 5 + i, "", "s", {
      fill: blueFill,
      border: topBottomBorder,
      alignment: centerAlign,
    });
  });

  // Fifth Row
  setCell(ws2, 4, 0, "", "s", {});
  ["EMP NO.", "PERSONNEL", "CATEGORY", "SITE/OFFICE"].forEach((colLabel, i) => {
    setCell(ws2, 4, 1 + i, colLabel, "s", {
      font: { sz: 12, color: { rgb: "FFFFFF" } },
      fill: colLabel === "SITE/OFFICE" ? labelFill : darkGrayFill,
      border: allBorders,
      alignment: centerAlign,
    });
  });

  cutoffDates.forEach((d, i) => {
    setCell(ws2, 4, 5 + i, d.getDate(), "n", {
      font: { sz: 12, color: blackFill },
      fill: dayFill,
      border: allBorders,
      alignment: centerAlign,
    });
  });

  // Employee List
  const attendanceMap = buildAttendanceMap(attendanceRecords);
  const employees = employeeData.filter((e) => !isAdminRole(e.role));
  const dailyLeaveCounts = cutoffDates.map(() => 0);
  let longestDayText = 0;

  let rowIndex = 5;
  let number = 1;

  employees.forEach((employee) => {
    const employeeAttendance = attendanceMap[employee._id] || {};

    setCell(ws2, rowIndex, 0, number, "n", {
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
      setCell(ws2, rowIndex, 1 + i, val, "s", {
        font: { sz: 11, ...blackFont },
        border: allBorders,
        alignment: i === 1 ? leftAlign : centerAlign,
      });
    });

    cutoffDates.forEach((d, i) => {
      const dateKey = formatKey(d);
      const dayFill = getDayFill(d);
      const record = employeeAttendance[dateKey];
      const isNotEmployed = isNotEmployedOn(employee, dateKey);
      const cell = getLeaveDayCell({ record, isNotEmployed });

      // Approved leave days only, LWOP excluded
      if (!isNotEmployed && isLeaveSheetDay(record)) {
        dailyLeaveCounts[i] += 1;
      }

      longestDayText = Math.max(longestDayText, cell.text.length);
      const fill = cell.fill || dayFill;

      setCell(ws2, rowIndex, 5 + i, cell.text, "s", {
        ...(fill ? { fill } : {}),
        border: allBorders,
        alignment: centerAlign,
      });
    });

    number++;
    rowIndex++;

    cutoffDates.forEach((d, i) => {
      setCell(ws2, 3, 5 + i, dailyLeaveCounts[i], "n", {
        font: { sz: 11, bold: true, ...redFont },
        fill: blueFill,
        border: topBottomBorder,
        alignment: centerAlign,
      });
    });
  });

  // Legend, one blank row under the employees
  const lastRow = writeLegend(ws2, rowIndex + 1, [
    ...leaveLegendEntries(),
    NOT_EMPLOYED,
  ]);

  ws2["!merges"] = [
    { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: 4 } },
  ];

  ws2["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: lastRow, c: totalCols - 1 },
  });

  // All day columns share one width, wide enough for the longest code shown
  const dayWidth = dayColumnWidth(longestDayText);
  ws2["!cols"] = [
    { wch: 3 },
    { wch: 9 },
    { wch: 37 },
    { wch: 16 },
    { wch: 16 },
    ...cutoffDates.map(() => ({ wch: dayWidth })),
  ];

  ws2["!rows"] = [
    { hpt: 7 },
    { hpt: 16 },
    { hpt: 16 },
    { hpt: 16 },
    ...Array(lastRow - 3).fill({ hpt: 16 }),
  ];

  return { ws2, cutoff };
};
