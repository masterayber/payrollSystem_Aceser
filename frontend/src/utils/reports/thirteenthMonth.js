import XLSX from "xlsx-js-style";
import {
  allBorders,
  centerAlign,
  leftAlign,
  blackFont,
  darkGrayFill,
  dayFill,
  projectedFill,
  resignedFill,
  setCell,
} from "./excelStyles";
import {
  CUTOFF_NOTE,
  YEAR_END_NOTE,
  asOfNote,
  basisNote,
  cutoffColumnLabel,
  flagLabels,
  groupCutoffsByMonth,
  incompleteNote,
  isProjectedCutoff,
  totalsLabel,
} from "../thirteenthMonth";

// 13th month pay for one year, as the server sends it (GET /api/thirteenth-month).
// Same columns as the Reports card; amounts are written as numbers with 2 decimals.
// Monthly basic is written in full: the export is admin-only.
// Columns: A-G the employee (A ID, B name, C type, D status, E start date, F last
// working day, G monthly basic), H-AF the 25 cut-offs, AG computed, AH projected,
// AI total for the year, AJ notes.

const PESO_FORMAT = "#,##0.00";

const FIXED_HEADERS = [
  "EMPLOYEE ID",
  "NAME",
  "TYPE",
  "STATUS",
  "START DATE",
  "LAST WORKING DAY",
  "MONTHLY BASIC",
];
const SUMMARY_HEADERS = ["COMPUTED", "PROJECTED", "TOTAL FOR THE YEAR", "NOTES"];

const NOTE_ROWS = 4; // title, as of, cut-offs, basis
const HEADER_ROW = NOTE_ROWS + 1; // one blank row between the notes and the table

const headerStyle = {
  font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
  fill: darkGrayFill,
  border: allBorders,
  alignment: { ...centerAlign, wrapText: true },
};

const textStyle = (alignment = centerAlign, extra = {}) => ({
  font: { sz: 11, ...blackFont },
  border: allBorders,
  alignment,
  ...extra,
});

// `fill` is the row's shade (Resigned rows); a projected cell keeps projectedFill
const amountStyle = ({ projected = false, bold = false, fill = null } = {}) => {
  const cellFill = projected ? projectedFill : fill;
  return {
    font: { sz: 11, ...blackFont, bold, italic: projected },
    border: allBorders,
    alignment: { horizontal: "right", vertical: "center" },
    numFmt: PESO_FORMAT,
    ...(cellFill ? { fill: cellFill } : {}),
  };
};

// A number when there is an amount, otherwise text ("" or a label)
const setAmount = (ws, r, c, value, options) => {
  if (value === null || value === undefined) {
    setCell(ws, r, c, "", "s", amountStyle(options));
  } else {
    setCell(ws, r, c, value, "n", amountStyle(options));
  }
};

const cutoffCell = (ws, r, c, cell, rowShade = {}) => {
  if (!cell) {
    setCell(ws, r, c, "", "s", textStyle(centerAlign, rowShade));
  } else if (cell.kind === "none") {
    setCell(ws, r, c, "-", "s", textStyle(centerAlign, rowShade));
  } else {
    setAmount(ws, r, c, cell.amount, {
      ...rowShade,
      projected: cell.kind === "projected",
    });
  }
};

export const ThirteenthMonthSheet = (data) => {
  const { year, asOf, payHistoryStart, cutoffs, rows, totals, incomplete } =
    data;
  const ws = {};
  const months = groupCutoffsByMonth(cutoffs);
  const firstCutoffCol = FIXED_HEADERS.length;
  const summaryCol = firstCutoffCol + cutoffs.length;
  const totalCols = summaryCol + SUMMARY_HEADERS.length;
  const merges = [];

  // Header notes
  setCell(ws, 0, 0, `ACESER Corporation - 13th Month Pay ${year}`, "s", {
    font: { bold: true, sz: 12, ...blackFont },
    alignment: leftAlign,
  });
  [asOfNote(asOf), CUTOFF_NOTE, basisNote(payHistoryStart)].forEach((text, i) => {
    setCell(ws, 1 + i, 0, text, "s", {
      font: { sz: 11, ...blackFont },
      alignment: leftAlign,
    });
  });

  // Two-row header: fixed and summary columns span both rows; each month spans
  // its cut-off columns (January 3, December 2, the others 2)
  const sub = HEADER_ROW + 1;
  FIXED_HEADERS.forEach((label, c) => {
    setCell(ws, HEADER_ROW, c, label, "s", headerStyle);
    setCell(ws, sub, c, "", "s", headerStyle);
    merges.push({ s: { r: HEADER_ROW, c }, e: { r: sub, c } });
  });

  let col = firstCutoffCol;
  months.forEach((month) => {
    month.cutoffs.forEach((cutoff, i) => {
      setCell(
        ws,
        HEADER_ROW,
        col + i,
        i === 0 ? month.label.toUpperCase() : "",
        "s",
        headerStyle,
      );
      setCell(ws, sub, col + i, cutoffColumnLabel(cutoff), "s", {
        ...headerStyle,
        font: { bold: true, sz: 11, ...blackFont },
        fill: dayFill,
      });
    });
    if (month.cutoffs.length > 1) {
      merges.push({
        s: { r: HEADER_ROW, c: col },
        e: { r: HEADER_ROW, c: col + month.cutoffs.length - 1 },
      });
    }
    col += month.cutoffs.length;
  });

  SUMMARY_HEADERS.forEach((label, i) => {
    const c = summaryCol + i;
    setCell(ws, HEADER_ROW, c, label, "s", headerStyle);
    setCell(ws, sub, c, "", "s", headerStyle);
    merges.push({ s: { r: HEADER_ROW, c }, e: { r: sub, c } });
  });

  // One row per employee, in the server's order (by Employee ID, Resigned included)
  let r = sub + 1;
  rows.forEach((row) => {
    // Resigned rows get a pale shade on every cell (the screen's .resigned row)
    const rowShade = row.status === "Resigned" ? { fill: resignedFill } : {};
    [
      row.employeeId || "",
      row.name || "",
      row.employmentType || "",
      row.status || "",
      row.startDate || "",
      row.lastWorkingDay || "",
    ].forEach((value, c) => {
      setCell(
        ws,
        r,
        c,
        value,
        "s",
        textStyle(c === 1 ? leftAlign : centerAlign, rowShade),
      );
    });

    setAmount(ws, r, 6, row.monthlyBasic, rowShade);

    cutoffs.forEach((cutoff, i) => {
      const cell =
        row.cutoffs.find((item) => item.cutoff === cutoff.cutoff) ||
        row.cutoffs[i];
      cutoffCell(ws, r, firstCutoffCol + i, cell, rowShade);
    });

    setAmount(ws, r, summaryCol, row.computed, rowShade);
    setAmount(ws, r, summaryCol + 1, row.projected, rowShade);
    setAmount(ws, r, summaryCol + 2, row.total, { ...rowShade, bold: true });
    setCell(
      ws,
      r,
      summaryCol + 3,
      flagLabels(row.flags).join("; "),
      "s",
      textStyle(leftAlign, rowShade),
    );
    r += 1;
  });

  // Totals row, over complete rows only
  const bold = { bold: true };
  setCell(
    ws,
    r,
    0,
    totalsLabel(totals.employees).toUpperCase(),
    "s",
    textStyle(leftAlign, { font: { sz: 11, ...blackFont, bold: true } }),
  );
  for (let c = 1; c < firstCutoffCol; c += 1) {
    setCell(ws, r, c, "", "s", textStyle());
  }
  merges.push({ s: { r, c: 0 }, e: { r, c: firstCutoffCol - 1 } });
  cutoffs.forEach((cutoff, i) => {
    setAmount(ws, r, firstCutoffCol + i, totals.byCutoff[i], {
      bold: true,
      projected: isProjectedCutoff(cutoff, asOf),
    });
  });
  setAmount(ws, r, summaryCol, totals.computed, bold);
  setAmount(ws, r, summaryCol + 1, totals.projected, bold);
  setAmount(ws, r, summaryCol + 2, totals.total, bold);
  setCell(
    ws,
    r,
    summaryCol + 3,
    incomplete > 0 ? incompleteNote(incomplete) : "",
    "s",
    textStyle(leftAlign),
  );
  r += 2;

  // Legend
  setCell(ws, r, 0, "LEGEND", "s", {
    font: { bold: true, sz: 11, ...blackFont },
  });
  r += 1;
  setCell(ws, r, 0, "Projected", "s", {
    font: { sz: 11, ...blackFont, italic: true },
    fill: projectedFill,
    border: allBorders,
    alignment: centerAlign,
  });
  setCell(ws, r, 1, "Shaded italics: projected (cut-off not yet ended)", "s", {
    font: { sz: 11, ...blackFont },
    alignment: leftAlign,
  });
  r += 1;
  setCell(ws, r, 0, "-", "s", textStyle());
  setCell(ws, r, 1, "Not employed during that cut-off", "s", {
    font: { sz: 11, ...blackFont },
    alignment: leftAlign,
  });
  r += 1;
  setCell(ws, r, 1, YEAR_END_NOTE, "s", {
    font: { sz: 11, ...blackFont },
    alignment: leftAlign,
  });

  ws["!merges"] = merges;
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r, c: totalCols - 1 },
  });
  ws["!cols"] = [
    { wch: 13 },
    { wch: 30 },
    { wch: 14 },
    { wch: 11 },
    { wch: 12 },
    { wch: 14 },
    { wch: 15 },
    ...cutoffs.map(() => ({ wch: 11 })),
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 40 },
  ];

  return { ws };
};
