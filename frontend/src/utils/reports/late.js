import XLSX from "xlsx-js-style";
import {
  allBorders,
  thickAllBorders,
  topBottomBorder,
  leftAlign,
  centerAlign,
  blackFill,
  blueFill,
  brownFill,
  darkGrayFill,
  labelFill,
  dayFill,
  setCell,
  getDayFill,
  dayNames,
} from "./excelStyles";
import { formatKey } from "./reportHelpers";

const buildAttendanceMap = (attendanceRecords) => {
  const attendanceMap = {};
  attendanceRecords.forEach((record) => {
    const userId = record.userId?._id || record.userId?.id || record.userId;
    const dateKey = formatKey(record.date);
    if (!attendanceMap[userId]) attendanceMap[userId] = {};
    attendanceMap[userId][dateKey] = record;
  });
  return attendanceMap;
};

const getLateDuration = (timeIn) => {
  if (!timeIn) return "";

  const [hours, minutes, seconds = 0] = String(timeIn).split(":").map(Number);
  if ([hours, minutes, seconds].some((value) => Number.isNaN(value))) {
    return "";
  }

  const lateSeconds = hours * 3600 + minutes * 60 + seconds - 8 * 3600;
  if (lateSeconds <= 0) return "";

  const lateMinutes = Math.floor(lateSeconds / 60);
  const remainingSeconds = lateSeconds % 60;
  return `${String(lateMinutes).padStart(2, "0")}:${String(
    remainingSeconds,
  ).padStart(2, "0")}`;
};

const getCellValue = (employeeAttendance, dateKey, isBeforeHire) => {
  if (isBeforeHire) return "-";

  const record = employeeAttendance[dateKey];
  return record?.behavior === "Late" ? getLateDuration(record.timeIn) : "";
};

export const LateSheet = ({
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

  const ws3 = {};
  const totalCols = 5 + cutoffDates.length;

  // First Row
  for (let c = 0; c < totalCols; c++) setCell(ws3, 0, c, "", "s", {});

  // Second Row
  for (let c = 0; c <= 4; c++) setCell(ws3, 1, c, "", "s", {});

  // REG/HOL Row
  cutoffDates.forEach((d, i) => {
    setCell(ws3, 1, 5 + i, "REG", "s", {
      font: { bold: true, sz: 11, color: blackFill },
      fill: blueFill,
      border: topBottomBorder,
      alignment: centerAlign,
    });
  });

  // Third Row
  setCell(ws3, 2, 1, `ACESER Corporation - ${label}`, "s", {
    font: { bold: true, sz: 12, color: blackFill },
    alignment: centerAlign,
  });

  cutoffDates.forEach((d, i) => {
    const dayFill = getDayFill(d);
    setCell(ws3, 2, 5 + i, dayNames[d.getDay()], "s", {
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
  setCell(ws3, 3, 0, "", "s", {});
  setCell(ws3, 3, 1, "TARDINESS", "s", {
    font: { bold: true, sz: 12, color: blackFill },
    fill: brownFill,
    border: thickAllBorders,
    alignment: centerAlign,
  });
  for (let c = 2; c <= 4; c++) {
    setCell(ws3, 3, c, "", "s", { fill: brownFill, border: thickAllBorders });
  }

  cutoffDates.forEach((d, i) => {
    setCell(ws3, 3, 5 + i, "", "s", {
      fill: blueFill,
      border: topBottomBorder,
      alignment: centerAlign,
    });
  });

  // Fifth Row
  setCell(ws3, 4, 0, "", "s", {});
  ["EMP NO.", "PERSONNEL", "CATEGORY", "SITE/OFFICE"].forEach((colLabel, i) => {
    setCell(ws3, 4, 1 + i, colLabel, "s", {
      font: { sz: 12, color: { rgb: "FFFFFF" } },
      fill: colLabel === "SITE/OFFICE" ? labelFill : darkGrayFill,
      border: allBorders,
      alignment: centerAlign,
    });
  });

  cutoffDates.forEach((d, i) => {
    setCell(ws3, 4, 5 + i, d.getDate(), "n", {
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
  const employees = employeeData.filter((e) => e.role !== "Admin");

  let rowIndex = 5;

  employees.forEach((employee) => {
    const employeeAttendance = attendanceMap[employee._id] || {};
    const hireKey = employee.createdAt ? formatKey(employee.createdAt) : null;

    setCell(ws3, rowIndex, 0, "", "s", {});
    [
      employee.employeeId || "",
      `${employee.lastName || ""}, ${employee.firstName || ""}`.toUpperCase(),
      (employee.jobDescription.category || "").toUpperCase(),
      (employee.jobDescription.designation || "").toUpperCase(),
    ].forEach((val, i) => {
      setCell(ws3, rowIndex, 1 + i, val, "s", {
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
      const isBeforeHire = hireKey && dateKey < hireKey;

      const cellValue = getCellValue(
        employeeAttendance,
        dateKey,
        isWeekendDay,
        isBeforeHire,
      );

      setCell(ws3, rowIndex, 5 + i, cellValue, "s", {
        ...(dayFill ? { fill: dayFill } : {}),
        border: allBorders,
        alignment: centerAlign,
      });
    });

    rowIndex++;
  });

  ws3["!merges"] = [
    { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: 4 } },
  ];

  ws3["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rowIndex - 1, c: totalCols - 1 },
  });

  ws3["!cols"] = [
    { wch: 3 },
    { wch: 9 },
    { wch: 37 },
    { wch: 16 },
    { wch: 16 },
    ...cutoffDates.map(() => ({ wch: 9 })),
  ];

  ws3["!rows"] = [
    { hpt: 7 },
    { hpt: 16 },
    { hpt: 16 },
    { hpt: 16 },
    ...Array(rowIndex - 4).fill({ hpt: 16 }),
  ];

  return { ws3, cutoff };
};
