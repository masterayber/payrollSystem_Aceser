// The rules behind Deductions > Employee Deduction Log and its pay item boxes
// (frontend/src/utils/payItems.js): the kinds, types, repeats, schedules and statuses
// against the server's lists, the form's own check against the server's words, the
// bodies the boxes send, the search, the order of the rows, the buttons each item gets,
// the start cut-offs offered, and the figures as the screen shows them. The routes are
// proved in the pay item API tests; every figure here is made up.
import {
  DASH,
  KIND_OPTIONS,
  MAX_LABEL_LENGTH,
  MAX_NOTE_LENGTH,
  MESSAGES,
  REPEAT_OPTIONS,
  SCHEDULE_OPTIONS,
  STATUS,
  TYPES,
  changeKind,
  checkItemForm,
  currentCutoffValue,
  cutoffText,
  emptyItemForm,
  employeeName,
  filterLogRows,
  formFromItem,
  itemActions,
  itemBody,
  itemChanges,
  itemCountText,
  itemName,
  moneyText,
  orderLogRows,
  repeatLabel,
  savedText,
  scheduleLabel,
  startCutoffOptions,
  statusTone,
  typesFor,
} from "../../frontend/src/utils/payItems";
import { getNextCutoff } from "../../frontend/src/utils/cutoff";

// The server's lists and messages (PR A). Until that file is in the tree the
// cross-checks are skipped and every other test still runs.
let server = null;
try {
  server = require("../utils/payItems");
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") throw error;
}
const withServer = server ? describe : describe.skip;

// A list as values: an array as it is, an object's values in order
const valuesOf = (list) =>
  Array.isArray(list) ? list : Object.values(list || {});

const TODAY = "2026-11-27"; // in the 2nd cut-off of November (Nov 26 to Dec 10)

// A filled-in form for a ₱6,000.00 Company Loan at ₱1,000.00 a cut-off
const LOAN_FORM = {
  ...emptyItemForm(TODAY),
  type: "Company Loan",
  label: " Laptop ",
  note: "",
  amountPerCutoff: "1000",
  total: "6000",
};

const USER_ID = "64b000000000000000000001";

withServer("the lists match the server", () => {
  it("offers the server's kinds", () => {
    expect(KIND_OPTIONS.map((option) => option.value).sort()).toEqual(
      [...valuesOf(server.KINDS)].sort(),
    );
  });

  it("offers each kind's types in the server's order", () => {
    const serverTypes = server.TYPES;
    KIND_OPTIONS.forEach(({ value }) => {
      expect(typesFor(value)).toEqual(valuesOf(serverTypes[value]));
    });
  });

  it("offers every repeat and schedule the server accepts", () => {
    expect(REPEAT_OPTIONS.map((option) => option.value).sort()).toEqual(
      [...valuesOf(server.REPEATS)].sort(),
    );
    expect(SCHEDULE_OPTIONS.map((option) => option.value).sort()).toEqual(
      [...valuesOf(server.SCHEDULES)].sort(),
    );
  });

  it("knows every status the server sends", () => {
    valuesOf(server.STATUS).forEach((status) => {
      expect(Object.values(STATUS)).toContain(status);
    });
  });

  it("uses the server's own words for the form's refusals", () => {
    expect(MESSAGES.type).toBe(server.MESSAGES.type);
    expect(MESSAGES.label).toBe(server.MESSAGES.label);
    expect(MESSAGES.note).toBe(server.MESSAGES.note);
    expect(MAX_LABEL_LENGTH).toBe(server.MAX_LABEL_LENGTH);
    expect(MAX_NOTE_LENGTH).toBe(server.MAX_NOTE_LENGTH);
    expect(MESSAGES.amount).toBe(server.MESSAGES.amount);
    expect(MESSAGES.totalTooSmall).toBe(server.MESSAGES.totalTooSmall);
    expect(MESSAGES.startCutoff).toBe(server.MESSAGES.startCutoff);
    // The missing-total message: whatever key the server gives it, the same text
    const serverTexts = Object.values(server.MESSAGES).filter(
      (text) => typeof text === "string",
    );
    expect(serverTexts).toContain(MESSAGES.totalMissing);
  });

  it("falls back to the server's saved messages", () => {
    expect(savedText("deduction", false)).toBe(server.MESSAGES.savedDeduction);
    expect(savedText("earning", false)).toBe(server.MESSAGES.savedEarning);
    expect(savedText("deduction", true)).toBe(server.MESSAGES.updated);
  });

  it("sends bodies the server's own check takes as they are", () => {
    const checked = server.checkItem(itemBody(LOAN_FORM, USER_ID));
    expect(checked.error).toBeUndefined();
    expect(checked.fields).toMatchObject({
      kind: "deduction",
      type: "Company Loan",
      label: "Laptop",
      amountPerCutoff: 1000,
      total: 6000,
      repeat: "instalments",
      schedule: "every",
      startCutoff: "2026-11-2nd",
      taxable: false,
    });
    const once = server.checkItem(
      itemBody({ ...LOAN_FORM, type: "Cash Advance", repeat: "once" }, USER_ID),
    );
    expect(once.error).toBeUndefined();
    expect(once.fields.total).toBeNull();
    const allowance = server.checkItem(
      itemBody(
        { ...changeKind(LOAN_FORM, "earning"), type: "Allowance", repeat: "untilStopped" },
        USER_ID,
      ),
    );
    expect(allowance.fields).toMatchObject({ taxable: true, total: null });
  });

  it("refuses the same forms as the server, with the same first message", () => {
    const forms = [
      { ...LOAN_FORM, type: "" },
      { ...LOAN_FORM, label: "x".repeat(61) },
      { ...LOAN_FORM, note: "x".repeat(201) },
      { ...LOAN_FORM, amountPerCutoff: "0" },
      { ...LOAN_FORM, amountPerCutoff: "1,000" },
      { ...LOAN_FORM, amountPerCutoff: "1e3" },
      { ...LOAN_FORM, amountPerCutoff: "0.001" },
      { ...LOAN_FORM, total: "" },
      { ...LOAN_FORM, total: "500" },
      { ...LOAN_FORM, startCutoff: "" },
      { ...LOAN_FORM, startCutoff: "2026-13-1st" },
      LOAN_FORM,
    ];
    forms.forEach((form) => {
      const serverError = server.checkItem(itemBody(form, USER_ID)).error || "";
      expect(checkItemForm(form)).toBe(serverError);
    });
  });
});

describe("the lists as the screen shows them", () => {
  it("names the types of each kind", () => {
    expect(TYPES.deduction).toEqual([
      "SSS Loan",
      "Pag-IBIG Loan",
      "Company Loan",
      "Cash Advance",
      "Other deduction",
    ]);
    expect(TYPES.earning).toEqual([
      "Overtime",
      "Allowance",
      "Pay adjustment",
      "Other earning",
    ]);
    expect(typesFor("bonus")).toEqual([]);
  });

  it("names the repeats and schedules", () => {
    expect(repeatLabel("once")).toBe("Once");
    expect(repeatLabel("instalments")).toBe("In instalments");
    expect(repeatLabel("untilStopped")).toBe("Until stopped");
    expect(scheduleLabel("every")).toBe("Every cut-off");
    expect(scheduleLabel("1st")).toBe("1st cut-off (11th to 25th)");
    expect(scheduleLabel("2nd")).toBe("2nd cut-off (26th to 10th)");
  });

  it("colours each status", () => {
    expect(statusTone("Active")).toBe("ok");
    expect(statusTone("Paused")).toBe("waiting");
    expect(statusTone("Stopped")).toBe("off");
    expect(statusTone("Completed")).toBe("off");
  });
});

describe("the form's check", () => {
  it("lets a complete instalment loan through", () => {
    expect(checkItemForm(LOAN_FORM)).toBe("");
  });

  it("asks for a type from the kind's own list", () => {
    expect(checkItemForm({ ...LOAN_FORM, type: "" })).toBe(MESSAGES.type);
    expect(checkItemForm({ ...LOAN_FORM, type: "Allowance" })).toBe(
      MESSAGES.type,
    );
    expect(checkItemForm({ ...LOAN_FORM, kind: "earning", type: "Allowance" })).toBe(
      "",
    );
  });

  it("refuses an amount of 0, a blank, a negative or anything not a number", () => {
    ["0", "", "  ", "-5", "1,000", "abc", "1e3", "0.001"].forEach((amountPerCutoff) => {
      expect(checkItemForm({ ...LOAN_FORM, amountPerCutoff })).toBe(
        "Enter an amount more than 0.",
      );
    });
    expect(checkItemForm({ ...LOAN_FORM, amountPerCutoff: " 1000.50 " })).toBe("");
  });

  it("asks for a total only for instalments, never less than one instalment", () => {
    expect(checkItemForm({ ...LOAN_FORM, total: "" })).toBe(MESSAGES.totalMissing);
    expect(checkItemForm({ ...LOAN_FORM, total: "999.99" })).toBe(
      "The total can't be less than one instalment.",
    );
    expect(checkItemForm({ ...LOAN_FORM, total: "1000" })).toBe("");
    expect(
      checkItemForm({ ...LOAN_FORM, repeat: "once", total: "", type: "Cash Advance" }),
    ).toBe("");
    expect(checkItemForm({ ...LOAN_FORM, repeat: "untilStopped", total: "" })).toBe(
      "",
    );
  });

  it("asks for the start cut-off", () => {
    expect(checkItemForm({ ...LOAN_FORM, startCutoff: "" })).toBe(
      "Choose the cut-off it starts on.",
    );
    expect(checkItemForm({ ...LOAN_FORM, startCutoff: "2026-12" })).toBe(
      MESSAGES.startCutoff,
    );
  });

  it("keeps the label and note within the server's lengths", () => {
    expect(checkItemForm({ ...LOAN_FORM, label: "x".repeat(60) })).toBe("");
    expect(checkItemForm({ ...LOAN_FORM, label: "x".repeat(61) })).toBe(
      "Enter a label of 60 characters or fewer.",
    );
    expect(checkItemForm({ ...LOAN_FORM, note: "x".repeat(201) })).toBe(
      "Enter a note of 200 characters or fewer.",
    );
  });

  it("checks a missing form without throwing", () => {
    expect(checkItemForm(null)).toBe(MESSAGES.type);
  });
});

describe("the bodies the boxes send", () => {
  it("sends a new instalment deduction with its total and no taxable flag", () => {
    expect(itemBody(LOAN_FORM, USER_ID)).toEqual({
      userId: USER_ID,
      kind: "deduction",
      type: "Company Loan",
      label: "Laptop",
      note: "",
      amountPerCutoff: 1000,
      total: 6000,
      repeat: "instalments",
      schedule: "every",
      startCutoff: "2026-11-2nd",
    });
  });

  it("sends a one-off with no total, and an earning with its taxable flag", () => {
    const once = itemBody(
      { ...LOAN_FORM, type: "Cash Advance", repeat: "once", total: "500" },
      USER_ID,
    );
    expect(once).not.toHaveProperty("total");
    expect(once).not.toHaveProperty("taxable");

    const allowance = itemBody(
      {
        ...changeKind(LOAN_FORM, "earning"),
        type: "Allowance",
        repeat: "untilStopped",
        taxable: false,
      },
      USER_ID,
    );
    expect(allowance).toMatchObject({
      kind: "earning",
      type: "Allowance",
      taxable: false,
    });
    expect(allowance).not.toHaveProperty("total");
  });

  it("sends an amount that is not a number as typed, for the server to name", () => {
    expect(itemBody({ ...LOAN_FORM, amountPerCutoff: " 1,000 " }, USER_ID)).toMatchObject(
      { amountPerCutoff: "1,000" },
    );
  });

  it("sends only what can change on an edit", () => {
    const item = {
      id: "i1",
      kind: "deduction",
      type: "Company Loan",
      label: "Laptop",
      note: "",
      amountPerCutoff: 1000,
      total: 6000,
      repeat: "instalments",
      schedule: "every",
      startCutoff: "2026-12-1st",
      taxable: true,
      status: "Active",
    };
    const form = { ...formFromItem(item), amountPerCutoff: "1500", schedule: "2nd" };
    expect(form.total).toBe("6000");
    expect(itemChanges(form)).toEqual({
      label: "Laptop",
      note: "",
      amountPerCutoff: 1500,
      schedule: "2nd",
      total: 6000,
    });
    expect(
      itemChanges(formFromItem({ ...item, repeat: "once", total: null })),
    ).not.toHaveProperty("total");
  });

  it("starts a new item as an instalment deduction from today's cut-off", () => {
    expect(emptyItemForm(TODAY)).toEqual({
      kind: "deduction",
      type: "",
      label: "",
      note: "",
      amountPerCutoff: "",
      total: "",
      repeat: "instalments",
      schedule: "every",
      startCutoff: "2026-11-2nd",
      taxable: true,
    });
  });

  it("keeps the type when the kind changes only if the new kind has it", () => {
    expect(changeKind(LOAN_FORM, "earning").type).toBe("");
    expect(changeKind(LOAN_FORM, "deduction").type).toBe("Company Loan");
  });
});

describe("the log's rows", () => {
  const rows = [
    { userId: "1", employeeId: "EMP-002", firstName: "Liza", lastName: "Reyes", status: "Resigned" },
    { userId: "2", employeeId: "EMP-001", firstName: "Angelica", lastName: "Cruz", status: "Active" },
    { userId: "3", employeeId: null, firstName: null, lastName: "Santos", status: "Active" },
  ];

  it("lists the Active employees first, then the Resigned ones", () => {
    expect(orderLogRows(rows).map((row) => row.userId)).toEqual(["2", "3", "1"]);
    expect(orderLogRows(null)).toEqual([]);
  });

  it("searches the Employee ID and name only, in any case, without throwing on a blank", () => {
    expect(filterLogRows(rows, "emp-001").map((row) => row.userId)).toEqual(["2"]);
    expect(filterLogRows(rows, "  LIZA ").map((row) => row.userId)).toEqual(["1"]);
    expect(filterLogRows(rows, "angelica cruz").map((row) => row.userId)).toEqual(["2"]);
    expect(filterLogRows(rows, "cruz, angelica").map((row) => row.userId)).toEqual([
      "2",
    ]);
    expect(filterLogRows(rows, "santos").map((row) => row.userId)).toEqual(["3"]);
    // The status and other fields are not searched
    expect(filterLogRows(rows, "resigned")).toEqual([]);
    expect(filterLogRows(rows, "")).toHaveLength(3);
    expect(filterLogRows(null, "x")).toEqual([]);
    expect(filterLogRows([null, ...rows], "null")).toEqual([]);
  });

  it("shows a dash for figures that are not there yet, and pesos otherwise", () => {
    expect(moneyText(null)).toBe(DASH);
    expect(moneyText(undefined)).toBe(DASH);
    expect(moneyText(0)).toBe("₱0.00");
    expect(moneyText(6000)).toBe("₱6,000.00");
    expect(moneyText("abc")).toBe(DASH);
  });

  it("names the employee and counts the items", () => {
    expect(employeeName(rows[1])).toBe("Angelica Cruz");
    expect(employeeName(rows[2])).toBe("Santos");
    expect(itemCountText(0)).toBe("None");
    expect(itemCountText(1)).toBe("1 item");
    expect(itemCountText(4)).toBe("4 items");
  });
});

describe("the buttons of an item", () => {
  const item = (status, paid = 0) => ({ id: "i", status, paid });

  it("edits, pauses and stops an Active item, and deletes it while nothing was paid", () => {
    expect(itemActions(item("Active"))).toEqual({
      edit: true,
      pause: true,
      resume: false,
      stop: true,
      delete: true,
    });
    expect(itemActions(item("Active", 1000)).delete).toBe(false);
  });

  it("resumes a Paused item instead of pausing it", () => {
    expect(itemActions(item("Paused"))).toMatchObject({
      edit: true,
      pause: false,
      resume: true,
      stop: true,
    });
  });

  it("offers only Delete on an unused Stopped item, and nothing on a Completed one", () => {
    expect(itemActions(item("Stopped"))).toEqual({
      edit: false,
      pause: false,
      resume: false,
      stop: false,
      delete: true,
    });
    expect(itemActions(item("Stopped", 500)).delete).toBe(false);
    expect(Object.values(itemActions(item("Completed", 6000)))).not.toContain(true);
  });

  it("offers nothing on the Admin's own employee record", () => {
    expect(
      Object.values(itemActions(item("Active"), { ownRecord: true })),
    ).not.toContain(true);
    expect(Object.values(itemActions(null))).not.toContain(true);
  });

  it("names an item by its type and label", () => {
    expect(itemName({ type: "Company Loan", label: "Laptop" })).toBe(
      "Company Loan: Laptop",
    );
    expect(itemName({ type: "Cash Advance", label: "" })).toBe("Cash Advance");
  });
});

describe("the start cut-off", () => {
  it("offers the cut-off before today's, today's and the next four", () => {
    expect(startCutoffOptions({ today: TODAY })).toEqual([
      { value: "2026-11-1st", label: "November 2026 1st Cut-off" },
      { value: "2026-11-2nd", label: "November 2026 2nd Cut-off" },
      { value: "2026-12-1st", label: "December 2026 1st Cut-off" },
      { value: "2026-12-2nd", label: "December 2026 2nd Cut-off" },
      { value: "2027-01-1st", label: "January 2027 1st Cut-off" },
      { value: "2027-01-2nd", label: "January 2027 2nd Cut-off" },
    ]);
  });

  it("goes by the cut-off of the day, the 1st to 10th belonging to the month before", () => {
    expect(currentCutoffValue("2027-01-05")).toBe("2026-12-2nd");
    expect(currentCutoffValue("2026-12-11")).toBe("2026-12-1st");
  });

  it("keeps an edited item's own start in the list", () => {
    const options = startCutoffOptions({ today: TODAY, keep: "2026-08-1st" });
    expect(options[0]).toEqual({
      value: "2026-08-1st",
      label: "August 2026 1st Cut-off",
    });
    expect(startCutoffOptions({ today: TODAY, keep: "2026-12-1st" })).toHaveLength(6);
  });

  it("names a start cut-off, and leaves anything else as it is", () => {
    expect(cutoffText("2026-12-2nd")).toBe("December 2026 2nd Cut-off");
    expect(cutoffText("")).toBe("");
    expect(cutoffText("someday")).toBe("someday");
  });

  it("moves to the next cut-off across the year end", () => {
    expect(getNextCutoff({ year: 2026, monthIndex: 11, half: "2nd" })).toEqual({
      year: 2027,
      monthIndex: 0,
      half: "1st",
    });
    expect(getNextCutoff({ year: 2026, monthIndex: 11, half: "1st" })).toEqual({
      year: 2026,
      monthIndex: 11,
      half: "2nd",
    });
  });
});
