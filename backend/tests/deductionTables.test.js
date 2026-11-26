// The pure rules of the statutory deduction tables (DED-3, utils/deductionTables.js):
// which row holds a base and what it gives, which version is in force on a day, the
// checks on what the Super Admin sends, and what the Government-Mandated card gets. The
// routes are in deductionTablesApi.test.js.
//
// EVERY FIGURE IN THIS FILE IS MADE UP FOR THE TESTS. None is an official SSS,
// PhilHealth, Pag-IBIG or withholding tax rate or bracket: the code holds no rate, and
// the real tables are typed into the portal by the Super Admin.
const mongoose = require("mongoose");

const {
  KINDS,
  KIND_KEYS,
  BASES,
  DEFAULT_BASE,
  DEDUCT_ON,
  DEFAULT_DEDUCT_ON,
  STATUS,
  MAX_ROWS,
  MAX_SOURCE_LENGTH,
  MAX_CHECKER_LENGTH,
  CHECK_EVERY_MONTHS,
  MESSAGES,
  isKind,
  kindLabel,
  isCalendarDay,
  rowIndexFor,
  bracketAmount,
  tableInForce,
  checkRows,
  checkTable,
  kindsIn,
  checkKinds,
  checkCheckedWith,
  addMonths,
  isCheckOverdue,
  tableReply,
  kindSummaries,
} = require("../utils/deductionTables");
const { roundCentavos } = require("../utils/thirteenthMonth");

// The plan's test table (section 7), made up, flat for everyone: the employee's amount
// per kind. NOT official rates.
const FLAT = { sss: 400, philhealth: 300, pagibig: 100, tax: 200 };
// A made-up employer amount to go with it
const FLAT_EMPLOYER = { sss: 810, philhealth: 320, pagibig: 130, tax: 0 };

const flatRows = (kind) => [
  { over: 0, employeeFixed: FLAT[kind], employerFixed: FLAT_EMPLOYER[kind] },
];

// Made-up bracket rows for the edge tests (NOT official), as they are stored:
// row 1: 0 to 1,000: flat
// row 2: over 1,000 up to 2,500: fixed + a rate on the part over 1,000
// row 3: over 2,500 up to 6,000: a rate on the whole base
// row 4: over 6,000: flat, open
const BRACKETS = [
  { over: 0, upTo: 1000, employeeFixed: 11, employeeRate: 0, employerFixed: 22, employerRate: 0, excessOver: 0 },
  { over: 1000, upTo: 2500, employeeFixed: 11, employeeRate: 7, employerFixed: 22, employerRate: 9, excessOver: 1000 },
  { over: 2500, upTo: 6000, employeeFixed: 0, employeeRate: 1.5, employerFixed: 0, employerRate: 2.25, excessOver: 0 },
  { over: 6000, upTo: null, employeeFixed: 123.45, employeeRate: 0, employerFixed: 234.56, employerRate: 0, excessOver: 0 },
];
// The same rows as the form would send them
const sentBrackets = () => BRACKETS.map((row) => ({ ...row }));

const id = () => new mongoose.Types.ObjectId();
const day = (key) => new Date(`${key}T00:00:00Z`);

describe("the four kinds", () => {
  it("are SSS, PhilHealth, Pag-IBIG and Withholding tax, in the screen's order", () => {
    expect(KINDS).toEqual([
      { key: "sss", label: "SSS" },
      { key: "philhealth", label: "PhilHealth" },
      { key: "pagibig", label: "Pag-IBIG" },
      { key: "tax", label: "Withholding tax" },
    ]);
    expect(KIND_KEYS).toEqual(["sss", "philhealth", "pagibig", "tax"]);
  });

  it.each(KIND_KEYS)("isKind is true for %s", (kind) => {
    expect(isKind(kind)).toBe(true);
  });

  it.each([
    ["a kind in capitals", "SSS"],
    ["a label", "Withholding tax"],
    ["a kind with spaces", " sss "],
    ["another deduction", "loan"],
    ["an empty text", ""],
    ["a list holding a kind", ["sss"]],
    ["a number", 1],
    ["null", null],
    ["undefined", undefined],
  ])("isKind is false for %s", (label, value) => {
    expect(isKind(value)).toBe(false);
    expect(kindLabel(value)).toBe("");
  });

  it("kindLabel names each kind", () => {
    expect(KIND_KEYS.map(kindLabel)).toEqual([
      "SSS",
      "PhilHealth",
      "Pag-IBIG",
      "Withholding tax",
    ]);
  });

  it("a table is read against the monthly basic by default, and taken half on each cut-off", () => {
    expect(BASES).toEqual(["monthlyBasic", "cutoffGross"]);
    expect(DEFAULT_BASE).toBe("monthlyBasic");
    expect(DEDUCT_ON).toEqual(["both", "1st", "2nd"]);
    expect(DEFAULT_DEDUCT_ON).toBe("both");
    expect(STATUS).toEqual({ DRAFT: "Draft", CONFIRMED: "Confirmed" });
  });
});

describe("the messages", () => {
  it("are the plan's words", () => {
    expect(MESSAGES.saved).toBe("Table saved as a draft.");
    expect(MESSAGES.confirmed).toBe("Table confirmed.");
    expect(MESSAGES.checked).toBe("Marked as checked today.");
    expect(MESSAGES.badKind).toBe(
      "Choose SSS, PhilHealth, Pag-IBIG or Withholding tax.",
    );
    expect(MESSAGES.badDate).toBe(
      "Enter the date the table takes effect as a valid date.",
    );
    expect(MESSAGES.noSource).toBe(
      "Name the official issuance this table was copied from.",
    );
    expect(MESSAGES.rowEdges(3)).toBe(
      "Row 3 overlaps the row before it or leaves a gap.",
    );
    expect(MESSAGES.negative).toBe("Amounts and rates can't be negative.");
    expect(MESSAGES.notFound).toBe("Table not found.");
    expect(MESSAGES.confirmedLocked).toBe(
      "A confirmed table can't be changed. Add a new version with a later date.",
    );
    expect(MESSAGES.noCheckedWith).toBe(
      "Enter who checked this table against the official one.",
    );
    expect(MESSAGES.alreadyConfirmed).toBe("This table is already confirmed.");
    expect(MESSAGES.draftNotChecked).toBe(
      "Only a confirmed table can be marked as checked.",
    );
  });

  it("name the kind and the date of a table that is already there", () => {
    expect(MESSAGES.taken("sss", "2027-01-01")).toBe(
      "An SSS table already starts on 2027-01-01.",
    );
    expect(MESSAGES.taken("philhealth", "2027-01-01")).toBe(
      "A PhilHealth table already starts on 2027-01-01.",
    );
    expect(MESSAGES.taken("pagibig", "2027-01-01")).toBe(
      "A Pag-IBIG table already starts on 2027-01-01.",
    );
    expect(MESSAGES.taken("tax", "2027-01-01")).toBe(
      "A Withholding tax table already starts on 2027-01-01.",
    );
  });

  it("no message holds a figure other than a limit of the form itself", () => {
    const words = Object.values(MESSAGES)
      .map((message) =>
        typeof message === "function" ? message("sss", "DATE") : message,
      )
      .join(" ");
    // Only the row limit, the two length limits, the 100 of a percent, "Row 1 must start
    // at 0", and "the 1st cut-off or the 2nd cut-off"
    const numbers = [...new Set(words.match(/\d+(\.\d+)?/g))].sort();
    expect(numbers).toEqual(
      [
        ...new Set([
          "0",
          "1",
          "2",
          "100",
          String(MAX_ROWS),
          String(MAX_SOURCE_LENGTH),
          String(MAX_CHECKER_LENGTH),
        ]),
      ].sort(),
    );
  });
});

describe("bracketAmount: which row holds a base, and what it gives", () => {
  // Rule: a row holds every base OVER its `over` and UP TO its `upTo`. A base exactly on
  // a boundary belongs to the row that ends there.
  it.each([
    // base, row, employee, employer, why
    [0, 1, 11, 22, "row 1 also holds a base of exactly 0"],
    [0.01, 1, 11, 22, "just above 0"],
    [999.99, 1, 11, 22, "just below the first edge"],
    [1000, 1, 11, 22, "ON the first edge: up to 1,000 is still row 1"],
    [1000.01, 2, 11, 22, "just over the first edge: row 2, the rate on one centavo rounds away"],
    [1750, 2, 63.5, 89.5, "inside row 2: 11 + 7% of 750, 22 + 9% of 750"],
    [2499.99, 2, 115.9993, 156.9991, "just below the second edge"],
    [2500, 2, 116, 157, "ON the second edge: still row 2"],
    [2500.01, 3, 37.50015, 56.250225, "just over the second edge: row 3, a rate on the whole base"],
    [4444.44, 3, 66.6666, 99.9999, "inside row 3"],
    [5999.99, 3, 89.99985, 134.999775, "just below the third edge"],
    [6000, 3, 90, 135, "ON the third edge: still row 3"],
    [6000.01, 4, 123.45, 234.56, "just over the third edge: the last, open row"],
    [9999999.99, 4, 123.45, 234.56, "far above: the last row has no upper limit"],
  ])("a base of %p is in row %p (%s)", (base, row, employee, employer) => {
    expect(bracketAmount(BRACKETS, base)).toEqual({
      row,
      employee: roundCentavos(employee),
      employer: roundCentavos(employer),
    });
    expect(rowIndexFor(BRACKETS, base)).toBe(row - 1);
  });

  it("gives the amounts to the centavo, as plain numbers", () => {
    // Worked by hand, so the test does not lean on roundCentavos:
    // 7% of 0.01 is 0.0007, gone; 1.5% of 2,500.01 is 37.50015; 2.25% of it 56.250225
    expect(bracketAmount(BRACKETS, 1000.01)).toEqual({ row: 2, employee: 11, employer: 22 });
    expect(bracketAmount(BRACKETS, 2499.99)).toEqual({ row: 2, employee: 116, employer: 157 });
    expect(bracketAmount(BRACKETS, 2500.01)).toEqual({ row: 3, employee: 37.5, employer: 56.25 });
    expect(bracketAmount(BRACKETS, 4444.44)).toEqual({ row: 3, employee: 66.67, employer: 100 });
    expect(bracketAmount(BRACKETS, 5999.99)).toEqual({ row: 3, employee: 90, employer: 135 });
  });

  it("a flat row gives its fixed amounts whatever the base", () => {
    for (const base of [0, 1, 500.5, 1000]) {
      expect(bracketAmount(BRACKETS, base)).toEqual({ row: 1, employee: 11, employer: 22 });
    }
  });

  it("a rate row with a fixed part takes the rate on the part over excessOver only", () => {
    // 11 + 7% of (2,000 - 1,000) = 81; 22 + 9% of 1,000 = 112
    expect(bracketAmount(BRACKETS, 2000)).toEqual({ row: 2, employee: 81, employer: 112 });
  });

  it("a rate row with excessOver 0 takes the rate on the whole base", () => {
    // 1.5% of 4,000 = 60; 2.25% of 4,000 = 90
    expect(bracketAmount(BRACKETS, 4000)).toEqual({ row: 3, employee: 60, employer: 90 });
  });

  it.each(KIND_KEYS)(
    "the plan's flat test table for %s gives the same amount at every base",
    (kind) => {
      for (const base of [0, 9000, 22000, 250000]) {
        expect(bracketAmount(flatRows(kind), base)).toEqual({
          row: 1,
          employee: FLAT[kind],
          employer: FLAT_EMPLOYER[kind],
        });
      }
    },
  );

  it("the plan's flat test table adds up to 1,000.00 for the employee", () => {
    const total = KIND_KEYS.reduce(
      (sum, kind) => sum + bracketAmount(flatRows(kind), 22000).employee,
      0,
    );
    expect(total).toBe(1000);
  });

  it("a one-row table with a rate is open from 0 up", () => {
    const rows = [{ over: 0, employeeRate: 3.75, employerRate: 6.25 }];
    expect(bracketAmount(rows, 0)).toEqual({ row: 1, employee: 0, employer: 0 });
    // 3.75% of 20,000 = 750; 6.25% of 20,000 = 1,250
    expect(bracketAmount(rows, 20000)).toEqual({ row: 1, employee: 750, employer: 1250 });
  });

  it("reads rows as they are stored: a missing fixed amount, rate or excess is 0", () => {
    expect(bracketAmount([{ over: 0 }], 5000)).toEqual({ row: 1, employee: 0, employer: 0 });
    expect(bracketAmount([{ over: 0, upTo: undefined, employeeFixed: 50 }], 5000)).toEqual({
      row: 1,
      employee: 50,
      employer: 0,
    });
  });

  it("never returns more than two decimals", () => {
    for (const base of [1000.01, 1234.56, 2500.01, 3333.33, 5999.99]) {
      const { employee, employer } = bracketAmount(BRACKETS, base);
      expect(employee).toBe(Number(employee.toFixed(2)));
      expect(employer).toBe(Number(employer.toFixed(2)));
    }
  });

  it.each([
    ["a base below 0", -0.01],
    ["a base that is not a number", "22000"],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["null", null],
    ["undefined", undefined],
  ])("gives null for %s: no row holds it", (label, base) => {
    expect(bracketAmount(BRACKETS, base)).toBeNull();
    expect(rowIndexFor(BRACKETS, base)).toBe(-1);
  });

  it("gives null when there are no rows", () => {
    expect(bracketAmount([], 22000)).toBeNull();
    expect(bracketAmount(undefined, 22000)).toBeNull();
    expect(bracketAmount(null, 22000)).toBeNull();
  });

  it("gives null for a base in a gap or above a closed last row (rows that were never checked)", () => {
    const gappy = [
      { over: 0, upTo: 1000, employeeFixed: 11 },
      { over: 2000, upTo: 3000, employeeFixed: 33 },
    ];
    expect(bracketAmount(gappy, 1500)).toBeNull();
    expect(bracketAmount(gappy, 3000.01)).toBeNull();
    expect(bracketAmount(gappy, 2000)).toBeNull();
    expect(bracketAmount(gappy, 2000.01).row).toBe(2);
  });
});

describe("tableInForce: the Confirmed version in force on a day", () => {
  const table = (kind, from, status = STATUS.CONFIRMED) => ({
    _id: id(),
    kind,
    effectiveFrom: day(from),
    status,
    rows: flatRows(kind),
  });
  const first = table("sss", "2026-01-01");
  const second = table("sss", "2026-07-01");
  const third = table("sss", "2027-01-01");
  const draft = table("sss", "2026-10-01", STATUS.DRAFT);
  const taxTable = table("tax", "2026-03-01");
  // Out of order on purpose
  const ALL = [third, draft, taxTable, first, second];

  it.each([
    ["the day before the first version", "2025-12-31", null],
    ["the day the first version starts", "2026-01-01", first],
    ["between the first and the second", "2026-04-15", first],
    ["the day before the second starts", "2026-06-30", first],
    ["the day the second starts", "2026-07-01", second],
    ["after a later Draft's date: the Draft is ignored", "2026-10-01", second],
    ["the day before the third starts", "2026-12-31", second],
    ["the day the third starts", "2027-01-01", third],
    ["long after the last version", "2031-05-05", third],
  ])("%s (%s)", (label, dayKey, expected) => {
    expect(tableInForce(ALL, "sss", dayKey)).toBe(expected);
  });

  it("takes the day as a key or as a Date", () => {
    expect(tableInForce(ALL, "sss", day("2026-07-01"))).toBe(second);
    expect(tableInForce(ALL, "sss", day("2026-06-30"))).toBe(first);
  });

  it("looks at one kind only", () => {
    expect(tableInForce(ALL, "tax", "2026-02-28")).toBeNull();
    expect(tableInForce(ALL, "tax", "2026-03-01")).toBe(taxTable);
    expect(tableInForce(ALL, "philhealth", "2031-01-01")).toBeNull();
    expect(tableInForce(ALL, "pagibig", "2031-01-01")).toBeNull();
  });

  it("a kind with Drafts only has no version in force, on any day", () => {
    const drafts = [
      table("pagibig", "2020-01-01", STATUS.DRAFT),
      table("pagibig", "2026-01-01", STATUS.DRAFT),
    ];
    expect(tableInForce(drafts, "pagibig", "2026-06-01")).toBeNull();
    expect(tableInForce(drafts, "pagibig", "2099-01-01")).toBeNull();
  });

  it("a Draft dated earlier than the Confirmed version changes nothing", () => {
    const earlyDraft = table("sss", "2025-06-01", STATUS.DRAFT);
    expect(tableInForce([earlyDraft, first], "sss", "2025-12-01")).toBeNull();
    expect(tableInForce([earlyDraft, first], "sss", "2026-02-01")).toBe(first);
  });

  it("gives null for no tables, or a day that is not one", () => {
    expect(tableInForce([], "sss", "2026-07-01")).toBeNull();
    expect(tableInForce(undefined, "sss", "2026-07-01")).toBeNull();
    expect(tableInForce(ALL, "sss", "")).toBeNull();
    expect(tableInForce(ALL, "sss", "not a day")).toBeNull();
    expect(tableInForce(ALL, "sss", undefined)).toBeNull();
  });

  it("the amount for a cut-off comes from the version in force on its last day", () => {
    // Made-up figures: the second version raises the flat amount
    const older = { ...first, rows: [{ over: 0, employeeFixed: 400, employerFixed: 800 }] };
    const newer = { ...second, rows: [{ over: 0, employeeFixed: 450, employerFixed: 900 }] };
    const amountOn = (dayKey) =>
      bracketAmount(tableInForce([older, newer], "sss", dayKey).rows, 22000);
    expect(amountOn("2026-06-25").employee).toBe(400);
    expect(amountOn("2026-07-10").employee).toBe(450);
  });
});

describe("checkRows", () => {
  it("accepts the made-up brackets and gives them back ready to save", () => {
    expect(checkRows(sentBrackets())).toEqual({ rows: BRACKETS });
  });

  it("accepts one open row: a flat table for everyone", () => {
    expect(checkRows([{ over: 0, employeeFixed: 400, employerFixed: 800 }])).toEqual({
      rows: [
        { over: 0, upTo: null, employeeFixed: 400, employeeRate: 0, employerFixed: 800, employerRate: 0, excessOver: 0 },
      ],
    });
  });

  it("reads figures typed in a box: digits as text, a blank as 0, a blank 'up to' as open", () => {
    expect(
      checkRows([
        { over: "0", upTo: " 1000 ", employeeFixed: "11.50", employeeRate: "", employerFixed: null },
        { over: "1000", upTo: "", employeeRate: "3.75", employerRate: "6.25", excessOver: "1000" },
      ]),
    ).toEqual({
      rows: [
        { over: 0, upTo: 1000, employeeFixed: 11.5, employeeRate: 0, employerFixed: 0, employerRate: 0, excessOver: 0 },
        { over: 1000, upTo: null, employeeFixed: 0, employeeRate: 3.75, employerFixed: 0, employerRate: 6.25, excessOver: 1000 },
      ],
    });
  });

  it("keeps only the seven figures of a row", () => {
    const { rows } = checkRows([{ over: 0, employeeFixed: 400, note: "x", _id: "y" }]);
    expect(Object.keys(rows[0])).toEqual([
      "over",
      "upTo",
      "employeeFixed",
      "employeeRate",
      "employerFixed",
      "employerRate",
      "excessOver",
    ]);
  });

  it.each([
    ["no rows", []],
    ["rows that are not a list", { over: 0 }],
    ["missing rows", undefined],
    ["null", null],
    ["text", "rows"],
  ])("refuses %s", (label, rows) => {
    expect(checkRows(rows)).toEqual({ error: "Add at least one row." });
  });

  it("refuses more rows than the limit", () => {
    const rows = Array.from({ length: MAX_ROWS + 1 }, (unused, index) => ({
      over: index,
      upTo: index === MAX_ROWS ? null : index + 1,
    }));
    expect(checkRows(rows)).toEqual({
      error: `Too many rows (${MAX_ROWS} at most).`,
    });
    expect(checkRows(rows.slice(0, MAX_ROWS - 1).concat({ over: MAX_ROWS - 1 })).error).toBeUndefined();
  });

  describe("overlap and gap: every row starts exactly where the row before it ends", () => {
    const withRow = (index, change) => {
      const rows = sentBrackets();
      rows[index] = { ...rows[index], ...change };
      return rows;
    };
    const EDGES = (row) => `Row ${row} overlaps the row before it or leaves a gap.`;

    it("refuses a row that starts below the end of the row before it (overlap)", () => {
      expect(checkRows(withRow(1, { over: 999.99, excessOver: 0 }))).toEqual({ error: EDGES(2) });
      expect(checkRows(withRow(2, { over: 2000 }))).toEqual({ error: EDGES(3) });
    });

    it("refuses a row that starts above the end of the row before it (gap), even by a centavo", () => {
      expect(checkRows(withRow(1, { over: 1000.01 }))).toEqual({ error: EDGES(2) });
      expect(checkRows(withRow(3, { over: 7000 }))).toEqual({ error: EDGES(4) });
    });

    it("refuses a row that repeats the row before it", () => {
      const rows = sentBrackets();
      rows.splice(1, 0, { ...rows[0] });
      expect(checkRows(rows)).toEqual({ error: EDGES(2) });
    });

    it("refuses a row after an open row: the open row already covers it", () => {
      expect(checkRows(withRow(1, { upTo: null }))).toEqual({ error: EDGES(3) });
      expect(checkRows(withRow(1, { upTo: "" }))).toEqual({ error: EDGES(3) });
    });

    it("refuses rows out of order", () => {
      const [a, b, c, d] = sentBrackets();
      expect(checkRows([a, c, b, d])).toEqual({ error: EDGES(2) });
    });

    it("names the first row with a problem", () => {
      const rows = withRow(1, { over: 1200 });
      rows[3] = { ...rows[3], over: 9000 };
      expect(checkRows(rows)).toEqual({ error: EDGES(2) });
    });

    it("refuses a first row that does not start at 0: the amounts below it have no row", () => {
      expect(checkRows(withRow(0, { over: 500 }))).toEqual({
        error: "Row 1 must start at 0, so every amount has a row.",
      });
      expect(checkRows([{ over: 0.01, employeeFixed: 400 }])).toEqual({
        error: "Row 1 must start at 0, so every amount has a row.",
      });
    });

    it("refuses a last row with an upper limit: the amounts above it have no row", () => {
      expect(checkRows(withRow(3, { upTo: 50000 }))).toEqual({
        error: 'Leave "up to" empty on the last row, so it covers every higher amount.',
      });
      expect(checkRows([{ over: 0, upTo: 1000, employeeFixed: 400 }])).toEqual({
        error: 'Leave "up to" empty on the last row, so it covers every higher amount.',
      });
    });

    it("refuses a row whose 'up to' is not above its 'over'", () => {
      expect(checkRows(withRow(1, { upTo: 1000 }))).toEqual({
        error: 'Row 2: "up to" must be more than "over".',
      });
      expect(checkRows(withRow(2, { upTo: 100 }))).toEqual({
        error: 'Row 3: "up to" must be more than "over".',
      });
      expect(checkRows(withRow(0, { upTo: 0 }))).toEqual({
        error: 'Row 1: "up to" must be more than "over".',
      });
    });
  });

  describe("negatives", () => {
    const NEGATIVE = { error: "Amounts and rates can't be negative." };

    it.each([
      "over",
      "upTo",
      "employeeFixed",
      "employeeRate",
      "employerFixed",
      "employerRate",
      "excessOver",
    ])("refuses a negative %s, as a number or as typed text", (field) => {
      const asNumber = sentBrackets();
      asNumber[1][field] = -1;
      expect(checkRows(asNumber)).toEqual(NEGATIVE);

      const asText = sentBrackets();
      asText[2][field] = "-0.01";
      expect(checkRows(asText)).toEqual(NEGATIVE);
    });

    it("refuses a negative in the only row", () => {
      expect(checkRows([{ over: 0, employeeFixed: -400 }])).toEqual(NEGATIVE);
      expect(checkRows([{ over: -5, employeeFixed: 400 }])).toEqual(NEGATIVE);
    });

    it("accepts zeros everywhere: a row that takes nothing", () => {
      expect(checkRows([{ over: 0, upTo: 1000 }, { over: 1000, employeeFixed: 50 }]).error).toBeUndefined();
      expect(checkRows([{ over: -0, employeeFixed: "-0" }]).rows[0]).toMatchObject({
        over: 0,
        employeeFixed: 0,
      });
    });
  });

  describe("figures that are not numbers", () => {
    it.each([
      ["words", "abc"],
      ["an amount with a comma", "1,000"],
      ["an amount with a peso sign", "₱400"],
      ["a percent sign", "8%"],
      ["true", true],
      ["a list", [400]],
      ["an object", { amount: 400 }],
      ["NaN", NaN],
      ["Infinity", Infinity],
      ["an exponent", "1e3"],
    ])("refuses %s, naming the row", (label, value) => {
      const rows = sentBrackets();
      rows[2].employeeFixed = value;
      expect(checkRows(rows)).toEqual({
        error: "Row 3: enter every figure as a number.",
      });
    });

    it("refuses a row with no 'over', and a row that is not a row", () => {
      expect(checkRows([{ employeeFixed: 400 }])).toEqual({
        error: "Row 1: enter every figure as a number.",
      });
      expect(checkRows([{ over: "", employeeFixed: 400 }])).toEqual({
        error: "Row 1: enter every figure as a number.",
      });
      for (const notRow of [null, "row", 5, [0, 1000]]) {
        expect(checkRows([{ over: 0, upTo: 1000 }, notRow])).toEqual({
          error: "Row 2: enter every figure as a number.",
        });
      }
    });
  });

  describe("rates and the excess", () => {
    it("refuses a rate over 100: a rate is a percent", () => {
      const rows = sentBrackets();
      rows[1].employerRate = 100.01;
      expect(checkRows(rows)).toEqual({
        error: "Row 2: a rate is a percent and can't be more than 100.",
      });
      rows[1].employerRate = 100;
      expect(checkRows(rows).error).toBeUndefined();
    });

    it("refuses an excess that starts above the row's 'over': an amount could come out below its fixed part", () => {
      const rows = sentBrackets();
      rows[1].excessOver = 1000.01;
      expect(checkRows(rows)).toEqual({
        error: 'Row 2: the excess can\'t start above the row\'s "over" amount.',
      });
      rows[1].excessOver = 1000;
      expect(checkRows(rows).error).toBeUndefined();
      rows[1].excessOver = 500;
      expect(checkRows(rows).error).toBeUndefined();
    });

    it("so no checked table can give a negative amount, at any edge", () => {
      const { rows } = checkRows(sentBrackets());
      for (const base of [0, 1000, 1000.01, 2500, 2500.01, 6000, 6000.01]) {
        const { employee, employer } = bracketAmount(rows, base);
        expect(employee).toBeGreaterThanOrEqual(0);
        expect(employer).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it("a negative figure is named before an edge problem in the same row", () => {
    expect(checkRows([{ over: -100, upTo: 1000 }, { over: 1000 }])).toEqual({
      error: "Amounts and rates can't be negative.",
    });
  });
});

describe("checkTable", () => {
  const body = (extra = {}) => ({
    kind: "sss",
    effectiveFrom: "2027-01-01",
    source: "Test issuance 2027-A (made up)",
    rows: flatRows("sss"),
    ...extra,
  });

  it("accepts the form's fields and gives them back ready to save, the date at 00:00 UTC", () => {
    expect(checkTable(body({ base: "cutoffGross", deductOn: "2nd", source: "  Test issuance  " }))).toEqual({
      fields: {
        kind: "sss",
        effectiveFrom: new Date("2027-01-01T00:00:00.000Z"),
        source: "Test issuance",
        base: "cutoffGross",
        deductOn: "2nd",
        rows: [
          { over: 0, upTo: null, employeeFixed: 400, employeeRate: 0, employerFixed: 810, employerRate: 0, excessOver: 0 },
        ],
      },
    });
  });

  it("reads against the monthly basic and takes half on each cut-off when not told", () => {
    for (const blank of [undefined, null, ""]) {
      const { fields } = checkTable(body({ base: blank, deductOn: blank }));
      expect([fields.base, fields.deductOn]).toEqual(["monthlyBasic", "both"]);
    }
  });

  it("keeps nothing the form does not have: no status, no confirmer, no check", () => {
    const { fields } = checkTable(
      body({
        status: "Confirmed",
        confirmedBy: String(id()),
        confirmedAt: "2027-01-01",
        checkedWith: "Nobody",
        lastCheckedOn: "2027-01-01",
        createdBy: String(id()),
        _id: String(id()),
      }),
    );
    expect(Object.keys(fields)).toEqual([
      "kind",
      "effectiveFrom",
      "source",
      "base",
      "deductOn",
      "rows",
    ]);
  });

  it.each([
    ["no kind", undefined],
    ["a kind that is not one of the four", "loan"],
    ["a label instead of a kind", "SSS"],
    ["a list", ["sss"]],
    ["null", null],
  ])("refuses %s", (label, kind) => {
    expect(checkTable(body({ kind }))).toEqual({
      error: "Choose SSS, PhilHealth, Pag-IBIG or Withholding tax.",
    });
  });

  it.each([
    ["no date", undefined],
    ["an empty date", ""],
    ["another order", "01-01-2027"],
    ["slashes", "2027/01/01"],
    ["a day that doesn't exist", "2027-02-30"],
    ["a month that doesn't exist", "2027-13-01"],
    ["a date with a time", "2027-01-01T00:00:00Z"],
    ["words", "next year"],
    ["a number", 20270101],
    ["a Date object's text", String(new Date("2027-01-01"))],
  ])("refuses %s", (label, effectiveFrom) => {
    expect(checkTable(body({ effectiveFrom }))).toEqual({
      error: "Enter the date the table takes effect as a valid date.",
    });
  });

  it.each([
    ["no source", undefined],
    ["an empty source", ""],
    ["spaces", "   "],
    ["a number", 2027],
    ["a list", ["Test issuance"]],
  ])("refuses %s", (label, source) => {
    expect(checkTable(body({ source }))).toEqual({
      error: "Name the official issuance this table was copied from.",
    });
  });

  it("refuses a source longer than the limit, and accepts one at the limit", () => {
    expect(checkTable(body({ source: "x".repeat(MAX_SOURCE_LENGTH + 1) }))).toEqual({
      error: `Keep the issuance name to ${MAX_SOURCE_LENGTH} characters or fewer.`,
    });
    expect(checkTable(body({ source: "x".repeat(MAX_SOURCE_LENGTH) })).error).toBeUndefined();
  });

  it.each(["annualBasic", "MonthlyBasic", 1, ["monthlyBasic"]])(
    "refuses base %p",
    (base) => {
      expect(checkTable(body({ base }))).toEqual({
        error:
          "Choose what the table is read against: the monthly basic pay or the cut-off's gross pay.",
      });
    },
  );

  it.each(["3rd", "Both", "first", 1, ["both"]])(
    "refuses deductOn %p",
    (deductOn) => {
      expect(checkTable(body({ deductOn }))).toEqual({
        error:
          "Choose when it is taken: half on each cut-off, the 1st cut-off or the 2nd cut-off.",
      });
    },
  );

  it("passes on what the rows refuse", () => {
    expect(checkTable(body({ rows: [] }))).toEqual({ error: "Add at least one row." });
    expect(
      checkTable(body({ rows: [{ over: 0, upTo: 1000 }, { over: 1500 }] })),
    ).toEqual({ error: "Row 2 overlaps the row before it or leaves a gap." });
    expect(checkTable(body({ rows: [{ over: 0, employerFixed: -1 }] }))).toEqual({
      error: "Amounts and rates can't be negative.",
    });
  });

  it("refuses in the order of the form: kind, date, source, base, when taken, rows", () => {
    const allBad = { kind: "x", effectiveFrom: "x", source: "", base: "x", deductOn: "x", rows: [] };
    expect(checkTable(allBad).error).toBe(MESSAGES.badKind);
    expect(checkTable({ ...allBad, kind: "tax" }).error).toBe(MESSAGES.badDate);
    expect(checkTable({ ...allBad, kind: "tax", effectiveFrom: "2027-01-01" }).error).toBe(
      MESSAGES.noSource,
    );
    expect(
      checkTable({ ...allBad, kind: "tax", effectiveFrom: "2027-01-01", source: "S" }).error,
    ).toBe(MESSAGES.badBase);
    expect(
      checkTable({ ...allBad, kind: "tax", effectiveFrom: "2027-01-01", source: "S", base: "" })
        .error,
    ).toBe(MESSAGES.badDeductOn);
    expect(
      checkTable({
        ...allBad,
        kind: "tax",
        effectiveFrom: "2027-01-01",
        source: "S",
        base: "",
        deductOn: "",
      }).error,
    ).toBe(MESSAGES.noRows);
  });

  it.each([undefined, null, "table", 5, []])("refuses a body of %p", (sent) => {
    expect(checkTable(sent)).toEqual({ error: MESSAGES.badKind });
  });

  it("isCalendarDay: a real day written YYYY-MM-DD", () => {
    expect(isCalendarDay("2028-02-29")).toBe(true);
    expect(isCalendarDay("2027-02-29")).toBe(false);
    expect(isCalendarDay(new Date("2027-01-01"))).toBe(false);
  });
});

describe("checkKinds (the kinds to switch off)", () => {
  it("gives each kind once, in the screen's order", () => {
    expect(checkKinds(["tax", "sss", "tax"])).toEqual({ kinds: ["sss", "tax"] });
    expect(checkKinds(["pagibig"])).toEqual({ kinds: ["pagibig"] });
    expect(checkKinds([...KIND_KEYS].reverse())).toEqual({ kinds: KIND_KEYS });
  });

  it("an empty list switches every kind back on", () => {
    expect(checkKinds([])).toEqual({ kinds: [] });
  });

  it.each([
    ["no list", undefined],
    ["null", null],
    ["one kind as text", "tax"],
    ["an object", { tax: true }],
    ["a kind that is not one of the four", ["tax", "loan"]],
    ["a label", ["SSS"]],
    ["a list in a list", [["tax"]]],
    ["a null inside", ["tax", null]],
  ])("refuses %s", (label, kinds) => {
    expect(checkKinds(kinds)).toEqual({
      error: "Choose SSS, PhilHealth, Pag-IBIG or Withholding tax.",
    });
  });

  it("kindsIn drops what is not a kind from a stored list", () => {
    expect(kindsIn(["tax", "loan", "sss", null])).toEqual(["sss", "tax"]);
    expect(kindsIn(undefined)).toEqual([]);
    expect(kindsIn("tax")).toEqual([]);
  });
});

describe("checkCheckedWith (who checked the table against the official one)", () => {
  it("gives the name, trimmed", () => {
    expect(checkCheckedWith("  Maria Santos (Accounting) ")).toEqual({
      checkedWith: "Maria Santos (Accounting)",
    });
  });

  it.each([undefined, null, "", "   ", 5, ["Maria"], { name: "Maria" }])(
    "refuses %p",
    (value) => {
      expect(checkCheckedWith(value)).toEqual({
        error: "Enter who checked this table against the official one.",
      });
    },
  );

  it("refuses a name longer than the limit", () => {
    expect(checkCheckedWith("x".repeat(MAX_CHECKER_LENGTH + 1))).toEqual({
      error: `Keep the checker's name to ${MAX_CHECKER_LENGTH} characters or fewer.`,
    });
    expect(checkCheckedWith("x".repeat(MAX_CHECKER_LENGTH)).error).toBeUndefined();
  });
});

describe("isCheckOverdue: the last check is over 6 months old", () => {
  it("a table is due for a check every 6 months", () => {
    expect(CHECK_EVERY_MONTHS).toBe(6);
  });

  it.each([
    ["the day it was checked", "2026-05-25", "2026-05-25", false],
    ["the day before 6 months", "2026-05-25", "2026-11-24", false],
    ["exactly 6 months later", "2026-05-25", "2026-11-25", false],
    ["6 months and a day later", "2026-05-25", "2026-11-26", true],
    ["a year later", "2026-05-25", "2027-05-25", true],
    ["across New Year, not yet", "2026-09-10", "2027-03-10", false],
    ["across New Year, due", "2026-09-10", "2027-03-11", true],
    ["from the 31st into a 28-day month, not yet", "2026-08-31", "2027-02-28", false],
    ["from the 31st into a 28-day month, due", "2026-08-31", "2027-03-01", true],
  ])("%s", (label, checkedOn, today, expected) => {
    expect(isCheckOverdue(checkedOn, today)).toBe(expected);
    expect(isCheckOverdue(day(checkedOn), today)).toBe(expected);
  });

  it("a table with no check on record is due", () => {
    expect(isCheckOverdue(null, "2026-11-25")).toBe(true);
    expect(isCheckOverdue(undefined, "2026-11-25")).toBe(true);
  });

  it("addMonths keeps the day, or the month's last day when it has no such day", () => {
    expect(addMonths("2026-05-25", 6)).toBe("2026-11-25");
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonths("2027-08-31", 6)).toBe("2028-02-29");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });
});

describe("what the screen gets", () => {
  const boss = id();
  const nameOf = (accountId) => (String(accountId) === String(boss) ? "admin" : "Unknown");

  const stored = (kind, from, extra = {}) => ({
    _id: id(),
    kind,
    effectiveFrom: day(from),
    source: `Test issuance ${from} (made up)`,
    base: "monthlyBasic",
    deductOn: "both",
    rows: [{ over: 0, upTo: null, employeeFixed: FLAT[kind], employeeRate: 0, employerFixed: FLAT_EMPLOYER[kind], employerRate: 0, excessOver: 0 }],
    status: STATUS.DRAFT,
    confirmedBy: null,
    confirmedAt: null,
    checkedWith: "",
    lastCheckedOn: null,
    lastCheckedBy: null,
    createdBy: boss,
    createdAt: new Date("2026-11-20T02:00:00Z"),
    updatedAt: new Date("2026-11-20T02:00:00Z"),
    __v: 0,
    ...extra,
  });
  const confirmed = (kind, from, checkedOn = from) =>
    stored(kind, from, {
      status: STATUS.CONFIRMED,
      confirmedBy: boss,
      confirmedAt: new Date("2026-11-21T03:00:00Z"),
      checkedWith: "Maria Santos",
      lastCheckedOn: day(checkedOn),
      lastCheckedBy: boss,
    });

  describe("tableReply", () => {
    it("a Draft: its fields, the date as a key, people by name, nothing else", () => {
      const table = stored("sss", "2027-01-01");
      expect(tableReply(table, nameOf)).toStrictEqual({
        id: String(table._id),
        kind: "sss",
        label: "SSS",
        effectiveFrom: "2027-01-01",
        source: "Test issuance 2027-01-01 (made up)",
        base: "monthlyBasic",
        deductOn: "both",
        rows: [
          { over: 0, upTo: null, employeeFixed: 400, employeeRate: 0, employerFixed: 810, employerRate: 0, excessOver: 0 },
        ],
        status: "Draft",
        confirmedBy: "",
        confirmedAt: null,
        checkedWith: "",
        lastCheckedOn: null,
        lastCheckedBy: "",
        createdBy: "admin",
        createdAt: new Date("2026-11-20T02:00:00Z"),
      });
    });

    it("a Confirmed version: who confirmed it, who checked it and when", () => {
      const table = confirmed("tax", "2026-01-01", "2026-11-21");
      expect(tableReply(table, nameOf)).toMatchObject({
        kind: "tax",
        label: "Withholding tax",
        status: "Confirmed",
        confirmedBy: "admin",
        confirmedAt: new Date("2026-11-21T03:00:00Z"),
        checkedWith: "Maria Santos",
        lastCheckedOn: "2026-11-21",
        lastCheckedBy: "admin",
      });
    });

    it("never sends an account id", () => {
      const reply = JSON.stringify(tableReply(confirmed("sss", "2026-01-01"), nameOf));
      expect(reply).not.toContain(String(boss));
    });

    it("names nobody when it is given no names", () => {
      expect(tableReply(confirmed("sss", "2026-01-01"))).toMatchObject({
        confirmedBy: "",
        lastCheckedBy: "",
        createdBy: "",
      });
    });
  });

  describe("kindSummaries (GET /api/deductions/tables)", () => {
    const TODAY = "2026-11-25";
    const NOTHING = {
      off: false,
      current: null,
      drafts: [],
      upcoming: [],
      history: [],
      lastCheckedOn: null,
      checkOverdue: false,
      blocksPayslips: true,
    };
    const summaries = (tables, options = {}) =>
      kindSummaries(tables, { todayKey: TODAY, nameOf, ...options });
    const datesOf = (list) => list.map((table) => table.effectiveFrom);

    it("with no tables: the four kinds in order, each with nothing, each blocking payslips", () => {
      expect(summaries([])).toStrictEqual([
        { kind: "sss", label: "SSS", ...NOTHING },
        { kind: "philhealth", label: "PhilHealth", ...NOTHING },
        { kind: "pagibig", label: "Pag-IBIG", ...NOTHING },
        { kind: "tax", label: "Withholding tax", ...NOTHING },
      ]);
      expect(summaries(undefined)).toStrictEqual(summaries([]));
    });

    it("a kind with a Draft only: the draft is listed, nothing is in force, payslips stay blocked", () => {
      const draft = stored("philhealth", "2027-01-01");
      const [sss, philhealth] = summaries([draft]);
      expect(sss).toStrictEqual({ kind: "sss", label: "SSS", ...NOTHING });
      expect(philhealth).toStrictEqual({
        kind: "philhealth",
        label: "PhilHealth",
        ...NOTHING,
        drafts: [tableReply(draft, nameOf)],
      });
    });

    it("a Draft dated in the past is still only a draft", () => {
      const [sss] = summaries([stored("sss", "2026-01-01")]);
      expect(sss.current).toBeNull();
      expect(sss.blocksPayslips).toBe(true);
      expect(datesOf(sss.drafts)).toEqual(["2026-01-01"]);
    });

    it("a current version, an upcoming one, history and drafts, each in its list", () => {
      const oldest = confirmed("sss", "2025-01-01");
      const older = confirmed("sss", "2026-01-01");
      const current = confirmed("sss", "2026-07-01", "2026-08-15");
      const next = confirmed("sss", "2027-01-01");
      const later = confirmed("sss", "2027-07-01");
      const draftA = stored("sss", "2028-01-01");
      const draftB = stored("sss", "2026-10-01");
      // Stored in no particular order
      const [sss, ...others] = summaries([next, draftA, oldest, current, later, draftB, older]);

      expect(sss).toStrictEqual({
        kind: "sss",
        label: "SSS",
        off: false,
        current: tableReply(current, nameOf),
        drafts: [tableReply(draftB, nameOf), tableReply(draftA, nameOf)],
        upcoming: [tableReply(next, nameOf), tableReply(later, nameOf)],
        history: [tableReply(older, nameOf), tableReply(oldest, nameOf)],
        lastCheckedOn: "2026-08-15",
        checkOverdue: false,
        blocksPayslips: false,
      });
      // The other kinds are untouched by SSS tables
      for (const other of others) expect(other).toMatchObject(NOTHING);
    });

    it("a version that starts today is the current one; one that starts tomorrow is upcoming", () => {
      const [sss] = summaries([confirmed("sss", TODAY), confirmed("sss", "2026-11-26")]);
      expect(sss.current.effectiveFrom).toBe(TODAY);
      expect(datesOf(sss.upcoming)).toEqual(["2026-11-26"]);
      expect(sss.history).toEqual([]);
    });

    it("only an upcoming version: nothing is in force today, so payslips are still blocked", () => {
      const [sss] = summaries([confirmed("sss", "2027-01-01")]);
      expect(sss.current).toBeNull();
      expect(datesOf(sss.upcoming)).toEqual(["2027-01-01"]);
      expect(sss.blocksPayslips).toBe(true);
      expect(sss.lastCheckedOn).toBeNull();
      expect(sss.checkOverdue).toBe(false);
    });

    it("the last check: the current version's, due when it is over 6 months old", () => {
      const fresh = summaries([confirmed("tax", "2025-01-01", "2026-05-25")])[3];
      expect([fresh.lastCheckedOn, fresh.checkOverdue]).toEqual(["2026-05-25", false]);

      const stale = summaries([confirmed("tax", "2025-01-01", "2026-05-24")])[3];
      expect([stale.lastCheckedOn, stale.checkOverdue]).toEqual(["2026-05-24", true]);

      // An old version's stale check does not count once a newer one is in force
      const replaced = summaries([
        confirmed("tax", "2025-01-01", "2025-01-01"),
        confirmed("tax", "2026-11-01", "2026-11-01"),
      ])[3];
      expect([replaced.lastCheckedOn, replaced.checkOverdue]).toEqual(["2026-11-01", false]);
    });

    it("a kind that is switched off never blocks payslips and is never due, with or without a table", () => {
      const tables = [confirmed("tax", "2025-01-01", "2025-01-01")];
      const [sss, philhealth, pagibig, tax] = summaries(tables, { off: ["sss", "tax"] });

      expect(sss).toStrictEqual({ kind: "sss", label: "SSS", ...NOTHING, off: true, blocksPayslips: false });
      expect([philhealth.off, philhealth.blocksPayslips]).toEqual([false, true]);
      expect([pagibig.off, pagibig.blocksPayslips]).toEqual([false, true]);
      expect(tax).toMatchObject({
        off: true,
        blocksPayslips: false,
        checkOverdue: false,
        lastCheckedOn: "2025-01-01",
      });
      // Its table is still listed
      expect(tax.current.effectiveFrom).toBe("2025-01-01");
    });

    it("every kind with a version in force: nothing blocks payslips", () => {
      const all = KIND_KEYS.map((kind) => confirmed(kind, "2026-01-01", "2026-11-01"));
      expect(summaries(all).map((kind) => kind.blocksPayslips)).toEqual([
        false,
        false,
        false,
        false,
      ]);
    });
  });
});
