// The signed-in employee's own attendance: the days of one cut-off (the Attendance
// page's table) and its Excel download. `userData` is the login / GET /api/auth/me user:
// the names are in `employee`, the job in `settings.general.jobDescription`, and
// `attendance` rows have `date` as "YYYY-MM-DD" and times as "HH:MM:SS" (see
// backend/utils/clientAttendance.js).
import XLSX from "xlsx-js-style";
import { MONTHS, getCutoffLabel, getCutoffRange, manilaToday } from "../cutoff";
import { isWeekendKey, isWeekendLeave } from "../dateFormatter";
import { hireDateKey } from "../employees";

const NO_TIME = "--:--";

// "YYYY-MM-DD" keys counted in UTC, so a day never shifts with the browser's time zone
const keyToDate = (key) => new Date(`${key}T00:00:00Z`);
const nextKey = (key) => {
  const d = keyToDate(key);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

// Every day of the cut-off, oldest first. A day with a row shows the row (a weekend
// On-Leave row as Rest Day); a day without one shows "-" before the start date, Rest Day
// on a past weekend, Pending today, Absent on a past weekday. Later days without a row
// are kept with `upcoming: true` and no behavior (the screen leaves them out, the sheet
// leaves them blank).
export const ownCutoffDays = (
  attendance,
  { start, end },
  { hireKey = "", todayKey = manilaToday() } = {},
) => {
  const byDate = new Map(
    (attendance || []).map((att) => [String(att.date).split("T")[0], att]),
  );
  const days = [];

  for (let key = start; key <= end; key = nextKey(key)) {
    const existing = byDate.get(key);

    if (existing) {
      days.push(
        isWeekendLeave(key, existing.behavior)
          ? { ...existing, behavior: "Rest Day" }
          : existing,
      );
      continue;
    }

    const isFuture = key > todayKey;
    let behavior = "";
    if (hireKey && key < hireKey) behavior = "-";
    else if (isFuture) behavior = "";
    else if (isWeekendKey(key)) behavior = "Rest Day";
    else if (key === todayKey) behavior = "Pending";
    else behavior = "Absent";

    days.push({
      _id: `absent-${key}`,
      date: key,
      timeIn: NO_TIME,
      timeOut: NO_TIME,
      overtime: null,
      behavior,
      ...(behavior === "" ? { upcoming: true } : {}),
    });
  }

  return days;
};

// "HH:MM" from an "HH:MM:SS" (or ISO) time; "--:--" when there is none
const shortTime = (time) => {
  const match = time && String(time).split("T").pop().match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : NO_TIME;
};

// One day cell: "07:55 - 17:02" over the status, or the status alone when the day has
// no times (Absent, Rest Day, "-", a leave day); blank for a later day
export const ownDayText = (day) => {
  if (!day || day.upcoming) return "";
  const timeIn = shortTime(day.timeIn);
  const timeOut = shortTime(day.timeOut);
  const status = day.behavior || "";
  if (timeIn === NO_TIME && timeOut === NO_TIME) return status;
  return status ? `${timeIn} - ${timeOut}\n${status}` : `${timeIn} - ${timeOut}`;
};

// "Ramos_Angelica" (last name first, as on the sheet); "Employee" when there is no name
export const ownFileName = (userData, { year, monthIndex, half }) => {
  const { lastName, firstName } = userData?.employee || {};
  const name =
    [lastName, firstName]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join("_")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "_") || "Employee";
  return `Attendance_${name}_${MONTHS[monthIndex]}_${half}Cutoff_${year}.xlsx`;
};

const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const thinBorder = { style: "thin", color: { rgb: "000000" } };
const allBorders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};
const topBottomBorder = { top: thinBorder, bottom: thinBorder };
const thickBorder = { style: "medium", color: { rgb: "000000" } };
const thickAllBorders = {
  top: thickBorder,
  bottom: thickBorder,
  left: thickBorder,
  right: thickBorder,
};

const blueFill = { patternType: "solid", fgColor: { rgb: "BDD7EE" } };
const yellowFill = { patternType: "solid", fgColor: { rgb: "FFE699" } };
const greenFill = { patternType: "solid", fgColor: { rgb: "70AD47" } };
const redFill = { patternType: "solid", fgColor: { rgb: "FF0000" } };
const grayFill = { patternType: "solid", fgColor: { rgb: "808080" } };

const centerAlign = { horizontal: "center", vertical: "center" };

const setCell = (ws, r, c, value, type, style) => {
  ws[XLSX.utils.encode_cell({ r, c })] = { v: value, t: type, s: style };
};

// Sunday red, Saturday gray
const getDayFill = (day) => (day === 0 ? redFill : day === 6 ? grayFill : null);

const remarksSheet = () => {
  const ws2 = {};

  for (let c = 0; c < 4; c++) setCell(ws2, 0, c, "", "s", {});

  const refHeaderStyle = {
    font: { bold: true, sz: 12, color: { rgb: "000000" } },
    fill: yellowFill,
    border: allBorders,
    alignment: centerAlign,
  };
  setCell(ws2, 1, 0, "REMARKS", "s", refHeaderStyle);
  setCell(ws2, 1, 1, "", "s", {});
  setCell(ws2, 1, 2, "DAY", "s", refHeaderStyle);

  const remarksList = ["REG", "HOL", ""];
  const remarkStyles = [
    {
      font: { sz: 12, color: { rgb: "000000" } },
      fill: blueFill,
      border: allBorders,
      alignment: centerAlign,
    },
    {
      font: { sz: 12, color: { rgb: "000000" } },
      fill: yellowFill,
      border: allBorders,
      alignment: centerAlign,
    },
    { border: allBorders, alignment: centerAlign },
  ];
  remarksList.forEach((val, i) => {
    setCell(ws2, 2 + i, 0, val, "s", remarkStyles[i]);
    setCell(ws2, 2 + i, 1, "", "s", {});
  });

  dayNames.forEach((day, i) => {
    const fill = getDayFill(i);
    setCell(ws2, 2 + i, 2, day, "s", {
      font: { sz: 12, color: { rgb: "000000" } },
      ...(fill ? { fill } : {}),
      border: allBorders,
      alignment: centerAlign,
    });
  });

  ws2["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: 8, c: 2 },
  });
  ws2["!cols"] = [{ wch: 12 }, { wch: 4 }, { wch: 10 }];
  ws2["!rows"] = [
    { hpt: 10 },
    { hpt: 22 },
    ...Array(7).fill({ hpt: 20 }),
  ];
  return ws2;
};

// The workbook and file name of the Download on the employee's Attendance page.
// Sheet "<Month> <half> Cutoff": row 5 (index 4) holds the employee and, from column F,
// one cell per day of the cut-off (ownDayText); sheet "Remarks" holds the drop-down lists.
export const buildOwnAttendanceWorkbook = ({
  userData,
  cutoff,
  today = manilaToday(),
}) => {
  const range = getCutoffRange(cutoff);
  const days = ownCutoffDays(userData?.attendance, range, {
    hireKey: hireDateKey(userData),
    todayKey: today,
  });
  const weekdays = days.map((day) => keyToDate(day.date).getUTCDay());
  const dayCount = days.length;

  const ws1 = {};
  const totalCols = 5 + dayCount;

  for (let c = 0; c < totalCols; c++) setCell(ws1, 0, c, "", "s", {});

  setCell(ws1, 1, 0, "", "s", {});
  setCell(ws1, 1, 1, `ACESER Corporation - "${getCutoffLabel(cutoff)}"`, "s", {
    font: { bold: true, sz: 12, color: { rgb: "000000" } },
    alignment: centerAlign,
  });
  for (let c = 2; c <= 4; c++) setCell(ws1, 1, c, "", "s", {});

  days.forEach((_, i) => {
    setCell(ws1, 1, 5 + i, "REG", "s", {
      font: { bold: true, sz: 11, color: { rgb: "000000" } },
      fill: blueFill,
      border: topBottomBorder,
      alignment: centerAlign,
    });
  });

  setCell(ws1, 2, 0, "", "s", {});
  setCell(ws1, 2, 1, "ATTENDANCE", "s", {
    font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
    fill: greenFill,
    border: thickAllBorders,
    alignment: centerAlign,
  });
  for (let c = 2; c <= 4; c++) {
    setCell(ws1, 2, c, "", "s", { fill: greenFill, border: thickAllBorders });
  }

  days.forEach((_, i) => {
    const dayFill = getDayFill(weekdays[i]);
    setCell(ws1, 2, 5 + i, dayNames[weekdays[i]], "s", {
      font: { bold: true, sz: 11, color: { rgb: dayFill ? "FFFFFF" : "000000" } },
      ...(dayFill ? { fill: dayFill } : {}),
      border: allBorders,
      alignment: centerAlign,
    });
  });

  setCell(ws1, 3, 0, "", "s", {});
  ["EMP NO.", "PERSONNEL", "CATEGORY", "SITE/OFFICE"].forEach((label, i) => {
    setCell(ws1, 3, 1 + i, label, "s", {
      font: { bold: true, sz: 12, color: { rgb: "000000" } },
      border: allBorders,
      alignment: centerAlign,
    });
  });

  days.forEach((day, i) => {
    const dayFill = getDayFill(weekdays[i]);
    setCell(ws1, 3, 5 + i, keyToDate(day.date).getUTCDate(), "n", {
      font: { bold: true, sz: 12, color: { rgb: dayFill ? "FFFFFF" : "000000" } },
      ...(dayFill ? { fill: dayFill } : {}),
      border: allBorders,
      alignment: centerAlign,
    });
  });

  const { lastName, firstName, employeeId } = userData?.employee || {};
  const fullName = [lastName, firstName].filter(Boolean).join(", ");
  const job = userData?.settings?.general?.jobDescription || {};

  setCell(ws1, 4, 0, "", "s", {});
  [employeeId || "", fullName, job.category || "", job.designation || ""].forEach(
    (val, i) => {
      setCell(ws1, 4, 1 + i, val, "s", {
        font: { sz: 12, color: { rgb: "000000" } },
        border: allBorders,
        alignment: centerAlign,
      });
    },
  );

  days.forEach((day, i) => {
    const dayFill = getDayFill(weekdays[i]);
    setCell(ws1, 4, 5 + i, ownDayText(day), "s", {
      font: { sz: 10, color: { rgb: "000000" } },
      ...(dayFill ? { fill: dayFill } : {}),
      border: allBorders,
      alignment: { ...centerAlign, wrapText: true },
    });
  });

  ws1["!merges"] = [
    { s: { r: 1, c: 1 }, e: { r: 1, c: 4 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } },
  ];

  ws1["!dataValidation"] = [
    ...days.map((_, i) => ({
      sqref: XLSX.utils.encode_cell({ r: 1, c: 5 + i }),
      type: "list",
      formula1: "Remarks!$A$3:$A$5",
      showDropdown: false,
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "Invalid Value",
      error: "Please select REG, HOL, or leave blank.",
    })),
    ...days.map((_, i) => ({
      sqref: XLSX.utils.encode_cell({ r: 2, c: 5 + i }),
      type: "list",
      formula1: "Remarks!$C$3:$C$9",
      showDropdown: false,
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "Invalid Value",
      error: "Please select a valid day.",
    })),
  ];

  const firstDayCol = XLSX.utils.encode_col(5);
  const lastDayCol = XLSX.utils.encode_col(4 + dayCount);
  ws1["!conditionalFormatting"] = [
    {
      ref: `${firstDayCol}2:${lastDayCol}2`,
      rules: [
        {
          type: "containsText",
          operator: "containsText",
          text: "REG",
          priority: 1,
          dxf: { fill: blueFill },
        },
        {
          type: "containsText",
          operator: "containsText",
          text: "HOL",
          priority: 2,
          dxf: { fill: yellowFill },
        },
      ],
    },
  ];

  ws1["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: 4, c: totalCols - 1 },
  });

  // Day columns wide enough for "07:55 - 17:02"; row 5 tall enough for two lines
  ws1["!cols"] = [
    { wch: 4 },
    { wch: 12 },
    { wch: 26 },
    { wch: 16 },
    { wch: 18 },
    ...days.map(() => ({ wch: 13 })),
  ];

  ws1["!rows"] = [
    { hpt: 10 },
    { hpt: 28 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 32 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    ws1,
    `${MONTHS[cutoff.monthIndex]} ${cutoff.half} Cutoff`,
  );
  XLSX.utils.book_append_sheet(workbook, remarksSheet(), "Remarks");

  return { workbook, fileName: ownFileName(userData, cutoff) };
};
