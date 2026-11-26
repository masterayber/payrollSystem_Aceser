// The rules behind Deductions > Government-Mandated Deductions
// (frontend/src/utils/deductionTables.js): the kinds and choices against the server's
// lists, the status and badges of each kind, the payslip banner, the order of the
// versions, the figures as the card shows them, and the body the form sends. The routes
// are proved in deductionTablesApi.test.js; these tests feed the helper the server's own
// summaries (utils/deductionTables.js kindSummaries) and run its bodies through the
// server's own check (checkTable). Every figure is made up: the code holds no real rate.
import {
  BASE_OPTIONS,
  DEDUCT_ON_OPTIONS,
  KINDS,
  LOCKED_NOTE,
  addRow,
  baseLabel,
  blockingKinds,
  blockingText,
  canWriteTables,
  deductOnLabel,
  emptyForm,
  excessText,
  formForNewVersion,
  formFromTable,
  formatDayKey,
  hasVersions,
  kindNotes,
  kindStatus,
  offKinds,
  removeRow,
  shareText,
  tableBody,
  upToText,
  versionName,
  versionsOf,
} from "../../frontend/src/utils/deductionTables";

const server = require("../utils/deductionTables");

const TODAY = "2026-11-26";

// A made-up three-row table, as the form holds it
const TEST_FORM = {
  kind: "sss",
  effectiveFrom: "2026-11-01",
  source: "Test circular 1",
  base: "monthlyBasic",
  deductOn: "both",
  rows: [
    {
      over: "0",
      upTo: "1000",
      employeeFixed: "10",
      employeeRate: "",
      employerFixed: "20",
      employerRate: "",
      excessOver: "",
    },
    {
      over: "1000",
      upTo: "5000",
      employeeFixed: "10",
      employeeRate: "2",
      employerFixed: "20",
      employerRate: "4",
      excessOver: "1000",
    },
    {
      over: "5000",
      upTo: "",
      employeeFixed: " 90 ",
      employeeRate: "",
      employerFixed: "180",
      employerRate: "",
      excessOver: "",
    },
  ],
};

let nextId = 1;
const stored = (fields, extra = {}) => ({
  _id: `64b0000000000000000000${String(nextId++).padStart(2, "0")}`,
  ...server.checkTable(tableBody({ ...TEST_FORM, ...fields })).fields,
  status: server.STATUS.DRAFT,
  ...extra,
});

const confirmed = (fields, lastCheckedOn = "2026-11-01") =>
  stored(fields, {
    status: server.STATUS.CONFIRMED,
    checkedWith: "Test Checker",
    lastCheckedOn: new Date(`${lastCheckedOn}T00:00:00Z`),
  });

const summariesOf = (tables, off = []) =>
  server.kindSummaries(tables, { todayKey: TODAY, off });

const summaryOf = (tables, kind = "sss", off = []) =>
  summariesOf(tables, off).find((summary) => summary.kind === kind);

describe("the lists match the server", () => {
  it("lists the four kinds in the server's order", () => {
    expect(KINDS).toEqual(server.KINDS);
  });

  it("offers every base and timing the server accepts, the default first", () => {
    expect(BASE_OPTIONS.map((option) => option.value)).toEqual(server.BASES);
    expect(BASE_OPTIONS[0].value).toBe(server.DEFAULT_BASE);
    expect(DEDUCT_ON_OPTIONS.map((option) => option.value)).toEqual(
      server.DEDUCT_ON,
    );
    expect(DEDUCT_ON_OPTIONS[0].value).toBe(server.DEFAULT_DEDUCT_ON);
  });

  it("shows the server's own words under a confirmed version", () => {
    expect(LOCKED_NOTE).toBe(server.MESSAGES.confirmedLocked);
  });

  it("names the choices", () => {
    expect(baseLabel("monthlyBasic")).toBe("Monthly basic pay");
    expect(baseLabel("cutoffGross")).toBe("Cut-off gross pay");
    expect(deductOnLabel("both")).toBe("Half on each cut-off");
    expect(deductOnLabel("2nd")).toBe("Whole on the 2nd cut-off");
  });
});

describe("who may change the tables", () => {
  it("is the Super Admin only", () => {
    expect(canWriteTables({ role: "Super Admin" })).toBe(true);
    expect(
      canWriteTables({ role: "Admin", allowedPages: ["deductions"] }),
    ).toBe(false);
    expect(canWriteTables({ role: "Employee" })).toBe(false);
    expect(canWriteTables(null)).toBe(false);
  });
});

describe("the form's body", () => {
  it("passes the server's check, with the figures as typed", () => {
    const checked = server.checkTable(tableBody(TEST_FORM));
    expect(checked.error).toBeUndefined();
    expect(checked.fields.rows[2]).toEqual({
      over: 5000,
      upTo: null,
      employeeFixed: 90,
      employeeRate: 0,
      employerFixed: 180,
      employerRate: 0,
      excessOver: 0,
    });
  });

  it("leaves every refusal to the server, which names it", () => {
    expect(server.checkTable(tableBody({ ...TEST_FORM, source: "  " }))).toEqual(
      { error: server.MESSAGES.noSource },
    );
    const blankOver = structuredClone(TEST_FORM);
    blankOver.rows[0].over = "";
    expect(server.checkTable(tableBody(blankOver))).toEqual({
      error: server.MESSAGES.notNumber(1),
    });
    const comma = structuredClone(TEST_FORM);
    comma.rows[1].upTo = "5,000";
    expect(server.checkTable(tableBody(comma))).toEqual({
      error: server.MESSAGES.notNumber(2),
    });
    const gap = structuredClone(TEST_FORM);
    gap.rows[1].over = "1200";
    expect(server.checkTable(tableBody(gap))).toEqual({
      error: server.MESSAGES.rowEdges(2),
    });
  });

  it("starts a new table with one row from 0 and the default choices", () => {
    expect(emptyForm("tax")).toEqual({
      kind: "tax",
      effectiveFrom: "",
      source: "",
      base: "monthlyBasic",
      deductOn: "both",
      rows: [expect.objectContaining({ over: "0", upTo: "" })],
    });
  });

  it("starts an added row where the last one ends, and removes a row", () => {
    const rows = addRow([{ ...TEST_FORM.rows[0] }]);
    expect(rows).toHaveLength(2);
    expect(rows[1].over).toBe("1000");
    expect(removeRow(rows, 0)).toEqual([rows[1]]);
  });

  it("fills an edited Draft from the table as the server sends it, and sends it back unchanged", () => {
    const reply = server.tableReply(stored({}));
    const form = formFromTable(reply);
    expect(form.rows[2].upTo).toBe("");
    expect(form.rows[1].employeeRate).toBe("2");
    // A box left empty (saved as 0) is empty again; "over" keeps its 0
    expect(form.rows[0].employeeRate).toBe("");
    expect(form.rows[0].excessOver).toBe("");
    expect(form.rows[0].over).toBe("0");
    expect(server.checkTable(tableBody(form)).fields.rows).toEqual(
      server.checkTable(tableBody(TEST_FORM)).fields.rows,
    );
  });

  it("starts a new version from the one it follows, with a blank date and source", () => {
    const reply = server.tableReply(confirmed({}));
    const form = formForNewVersion("sss", reply);
    expect(form.effectiveFrom).toBe("");
    expect(form.source).toBe("");
    expect(form.rows).toEqual(formFromTable(reply).rows);
    expect(formForNewVersion("pagibig", null)).toEqual(emptyForm("pagibig"));
  });
});

describe("the status of a kind", () => {
  it("is No table with nothing stored, and every kind blocks payslips", () => {
    const summaries = summariesOf([]);
    expect(summaries.map(kindStatus)).toEqual(
      KINDS.map(() => ({ label: "No table", tone: "missing" })),
    );
    expect(blockingKinds(summaries)).toEqual([
      "SSS",
      "PhilHealth",
      "Pag-IBIG",
      "Withholding tax",
    ]);
    expect(blockingText(summaries)).toBe(
      "SSS, PhilHealth, Pag-IBIG and Withholding tax have no confirmed table in force today. Payslips can't be issued until each has one or is switched off.",
    );
    expect(hasVersions(summaries[0])).toBe(false);
  });

  it("is Draft waiting with only a Draft, which still blocks payslips", () => {
    const summary = summaryOf([stored({})]);
    expect(kindStatus(summary)).toEqual({
      label: "Draft waiting",
      tone: "waiting",
    });
    expect(summary.blocksPayslips).toBe(true);
    expect(hasVersions(summary)).toBe(true);
  });

  it("is Confirmed once a version is in force, and the banner drops the kind", () => {
    const summaries = summariesOf([confirmed({})]);
    expect(kindStatus(summaries[0])).toEqual({ label: "Confirmed", tone: "ok" });
    expect(kindNotes(summaries[0])).toEqual([]);
    expect(blockingText(summaries)).toBe(
      "PhilHealth, Pag-IBIG and Withholding tax have no confirmed table in force today. Payslips can't be issued until each has one or is switched off.",
    );
  });

  it("is Switched off for a kind that is off, which never blocks", () => {
    const summaries = summariesOf([confirmed({})], ["philhealth", "pagibig"]);
    expect(kindStatus(summaries[1])).toEqual({
      label: "Switched off",
      tone: "off",
    });
    expect(offKinds(summaries)).toEqual(["philhealth", "pagibig"]);
    expect(blockingText(summaries)).toBe(
      "Withholding tax has no confirmed table in force today. Payslips can't be issued until each has one or is switched off.",
    );
    expect(blockingText(summariesOf([confirmed({})], ["philhealth", "pagibig", "tax"]))).toBe("");
  });

  it("names a confirmed version that starts later", () => {
    const summary = summaryOf([confirmed({ effectiveFrom: "2026-12-01" })]);
    expect(kindStatus(summary)).toEqual({
      label: "Starts Dec 1, 2026",
      tone: "waiting",
    });
  });

  it("adds a waiting Draft, a due check and the next version next to the one in force", () => {
    const summary = summaryOf([
      confirmed({}, "2026-05-01"),
      stored({ effectiveFrom: "2027-01-01" }),
      confirmed({ effectiveFrom: "2026-12-01" }),
    ]);
    expect(summary.checkOverdue).toBe(true);
    expect(kindNotes(summary).map((note) => note.label)).toEqual([
      "Draft waiting",
      "Check due",
      "Next from Dec 1, 2026",
    ]);
  });
});

describe("the versions of a kind", () => {
  it("lists the one in force, the later ones, the Drafts, then the past ones", () => {
    const summary = summaryOf([
      confirmed({ effectiveFrom: "2026-01-01" }),
      confirmed({ effectiveFrom: "2026-11-01" }),
      confirmed({ effectiveFrom: "2026-12-01" }),
      stored({ effectiveFrom: "2027-01-01" }),
    ]);
    expect(
      versionsOf(summary).map(({ table, place, label }) => [
        table.effectiveFrom,
        place,
        label,
      ]),
    ).toEqual([
      ["2026-11-01", "current", "In force"],
      ["2026-12-01", "upcoming", "Upcoming"],
      ["2027-01-01", "draft", "Draft"],
      ["2026-01-01", "history", "Past"],
    ]);
    expect(versionsOf(null)).toEqual([]);
  });

  it("names a version by kind and date", () => {
    expect(versionName(server.tableReply(stored({})))).toBe(
      "SSS table from Nov 1, 2026",
    );
  });
});

describe("dates and figures", () => {
  it("shows a date key as its own day", () => {
    expect(formatDayKey("2026-11-26")).toBe("Nov 26, 2026");
    expect(formatDayKey("2027-01-01")).toBe("Jan 1, 2027");
    expect(formatDayKey("")).toBe("");
    expect(formatDayKey(null)).toBe("");
  });

  it("shows a share as its fixed amount, its rate, or both", () => {
    expect(shareText(400, 0)).toBe("₱400.00");
    expect(shareText(0, 4.5)).toBe("4.5%");
    expect(shareText(1250.5, 2)).toBe("₱1,250.50 + 2%");
    expect(shareText(0, 0)).toBe("₱0.00");
  });

  it("shows the open last row and the excess only where a rate applies", () => {
    expect(upToText(null)).toBe("and above");
    expect(upToText(5000)).toBe("₱5,000.00");
    expect(excessText({ employeeRate: 2, excessOver: 1000 })).toBe("₱1,000.00");
    expect(excessText({ employeeRate: 0, employerRate: 0, excessOver: 0 })).toBe(
      "",
    );
  });
});
