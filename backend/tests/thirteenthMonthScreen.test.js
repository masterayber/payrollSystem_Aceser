// 13th month legend (Friday batch, Group 4, decisions 5 and 7): the projected sentence is
// one text in frontend/src/utils/thirteenthMonth.js, read by the Reports card and the
// Excel sheet (frontend/src/utils/reports/thirteenthMonth.js); the sheet's LEGEND lists
// Projected, Resigned (shaded like a resigned row), "-" and the year-end note, in order.
// No amount is computed here: the report below is a small fixed reply.
import fs from "fs";
import path from "path";
import XLSX from "xlsx-js-style";
import {
  PROJECTED_LEAD,
  PROJECTED_RULE,
  YEAR_END_NOTE,
  projectedLegend,
} from "../../frontend/src/utils/thirteenthMonth";
import { ThirteenthMonthSheet } from "../../frontend/src/utils/reports/thirteenthMonth";
import {
  projectedFill,
  resignedFill,
} from "../../frontend/src/utils/reports/excelStyles";

const FRONTEND = path.join(__dirname, "..", "..", "frontend", "src");
const readSource = (relative) =>
  fs.readFileSync(path.join(FRONTEND, relative), "utf8");

const SCREEN_SENTENCE =
  "Grey italics: projected. An amount is final once its cut-off has ended or, for a resigned employee, once the last working day has passed. A total stays grey until its cut-off ends.";
const SHEET_SENTENCE =
  "Shaded italics: projected. An amount is final once its cut-off has ended or, for a resigned employee, once the last working day has passed. A total stays grey until its cut-off ends.";
const RESIGNED_SENTENCE =
  "Shaded row: resigned employee, counted up to the last working day.";

// Two cut-offs, one ended (computed) and one not (projected); one Active and one
// Resigned employee
const cutoffs = [
  {
    cutoff: "2026-11-1st",
    month: "2026-11",
    half: "1st",
    start: "2026-11-11",
    end: "2026-11-25",
  },
  {
    cutoff: "2026-11-2nd",
    month: "2026-11",
    half: "2nd",
    start: "2026-11-26",
    end: "2026-12-10",
  },
];

const report = {
  year: 2026,
  asOf: "2026-11-27",
  payHistoryStart: "2026-11-01",
  cutoffs,
  rows: [
    {
      userId: "u1",
      employeeId: "AC-001",
      name: "Active Employee",
      employmentType: "Regular",
      status: "Active",
      startDate: "2025-01-06",
      lastWorkingDay: "",
      monthlyBasic: 20000,
      cutoffs: [
        { cutoff: "2026-11-1st", kind: "computed", amount: 833.33 },
        { cutoff: "2026-11-2nd", kind: "projected", amount: 833.33 },
      ],
      computed: 833.33,
      projected: 833.33,
      total: 1666.66,
      flags: [],
    },
    {
      userId: "u2",
      employeeId: "AC-002",
      name: "Resigned Employee",
      employmentType: "Regular",
      status: "Resigned",
      startDate: "2025-01-06",
      lastWorkingDay: "2026-11-20",
      monthlyBasic: 18000,
      cutoffs: [
        { cutoff: "2026-11-1st", kind: "computed", amount: 600 },
        { cutoff: "2026-11-2nd", kind: "none", amount: null },
      ],
      computed: 600,
      projected: 0,
      total: 600,
      flags: [],
    },
  ],
  totals: {
    employees: 2,
    byCutoff: [1433.33, 833.33],
    computed: 1433.33,
    projected: 833.33,
    total: 2266.66,
  },
  incomplete: 0,
};

const { ws } = ThirteenthMonthSheet(report);
const cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
const lastRow = XLSX.utils.decode_range(ws["!ref"]).e.r;

// The row that reads LEGEND in column A
const legendRow = (() => {
  for (let r = 0; r <= lastRow; r += 1) {
    if (cell(r, 0)?.v === "LEGEND") return r;
  }
  return -1;
})();

describe("13th month legend: one projected sentence for the screen and the sheet", () => {
  test("the shared text reads as agreed on the screen and on the sheet", () => {
    expect(projectedLegend("screen")).toBe(SCREEN_SENTENCE);
    expect(projectedLegend("sheet")).toBe(SHEET_SENTENCE);
    expect(projectedLegend()).toBe(SCREEN_SENTENCE);
    expect(`${PROJECTED_LEAD.screen}: ${PROJECTED_RULE}`).toBe(SCREEN_SENTENCE);
  });

  test("the two differ only in their first words", () => {
    expect(PROJECTED_LEAD).toEqual({
      screen: "Grey italics",
      sheet: "Shaded italics",
    });
    expect(projectedLegend("screen").slice("Grey italics".length)).toBe(
      projectedLegend("sheet").slice("Shaded italics".length),
    );
  });

  test("the Reports card reads the shared text and no longer has the old wording", () => {
    const screen = readSource("components/ThirteenthMonth/ThirteenthMonthReport.jsx");
    expect(screen).toMatch(/PROJECTED_LEAD\.screen/);
    expect(screen).toMatch(/PROJECTED_RULE/);
    expect(screen).toMatch(/from "\.\.\/\.\.\/utils\/thirteenthMonth"/);
    expect(screen).not.toMatch(/cut-off not yet ended/);
    expect(screen).not.toMatch(/An amount is final once/);
  });

  test("the sheet builder reads the shared text and does not type it again", () => {
    const sheet = readSource("utils/reports/thirteenthMonth.js");
    expect(sheet).toMatch(/projectedLegend\("sheet"\)/);
    expect(sheet).toMatch(/from "\.\.\/thirteenthMonth"/);
    expect(sheet).not.toMatch(/cut-off not yet ended/);
    expect(sheet).not.toMatch(/An amount is final once/);
  });
});

describe("13th month sheet: the LEGEND lines and their order", () => {
  test("LEGEND is in column A, after the totals row", () => {
    expect(legendRow).toBeGreaterThan(0);
    expect(cell(legendRow - 2, 0).v).toBe("TOTALS (2 EMPLOYEES)");
  });

  test("Projected, Resigned, - and the year-end note follow, in that order", () => {
    const lines = [1, 2, 3, 4].map((offset) => [
      cell(legendRow + offset, 0)?.v ?? "",
      cell(legendRow + offset, 1)?.v ?? "",
    ]);
    expect(lines).toEqual([
      ["Projected", SHEET_SENTENCE],
      ["Resigned", RESIGNED_SENTENCE],
      ["-", "Not employed during that cut-off"],
      ["", YEAR_END_NOTE],
    ]);
    // The year-end note is the sheet's last row
    expect(legendRow + 4).toBe(lastRow);
  });

  test("the Projected cell keeps the projected shade in italics", () => {
    const projected = cell(legendRow + 1, 0);
    expect(projected.s.fill).toEqual(projectedFill);
    expect(projected.s.font.italic).toBe(true);
  });

  test("the Resigned cell is shaded like a resigned employee's row", () => {
    // Rows from 0: notes 0-3, blank 4, header 5-6, then the employees from 7; the
    // resigned employee is the second (index 8, Excel row 9)
    const resignedRow = 8;
    expect(cell(resignedRow, 3).v).toBe("Resigned");
    const rowFill = cell(resignedRow, 1).s.fill;
    expect(rowFill).toEqual(resignedFill);

    const legendCell = cell(legendRow + 2, 0);
    expect(legendCell.s.fill).toEqual(rowFill);
    expect(legendCell.s.fill).not.toEqual(projectedFill);
    expect(legendCell.s.font.italic).toBeFalsy();
  });

  test("an Active employee's row and the - legend cell are not shaded", () => {
    expect(cell(7, 3).v).toBe("Active");
    expect(cell(7, 1).s.fill).toBeUndefined();
    expect(cell(legendRow + 3, 0).s.fill).toBeUndefined();
  });
});
