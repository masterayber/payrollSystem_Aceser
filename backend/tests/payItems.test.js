// The pure rules of pay items (DED-4, utils/payItems.js): who has them, when an item
// lands on a cut-off (rule 14), its balance and "Completed", when it can be deleted
// (rule 15), the open loan balance, the checks on what the form sends and the reply. The
// routes are in payItemsApi.test.js.
//
// Every amount here is made up for the tests. `paid` is what issued payslips paid on an
// item; there are no payslips until DED-6, so these tests give it directly.
const mongoose = require("mongoose");

const {
  KINDS,
  TYPES,
  REPEATS,
  SCHEDULES,
  STATUS,
  STORED_STATUSES,
  ALL_STATUSES,
  MESSAGES,
  isPayrollPerson,
  isCutoffValue,
  cutoffIndex,
  money,
  checkItem,
  checkChange,
  checkStatusFilter,
  balanceOf,
  statusOf,
  amountOn,
  canDelete,
  loansOf,
  itemReply,
} = require("../utils/payItems");

// A saved item, as the database holds it
const saved = (extra = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  userId: new mongoose.Types.ObjectId(),
  kind: "deduction",
  type: "Company Loan",
  label: "",
  note: "",
  amountPerCutoff: 1000,
  total: 6000,
  repeat: "instalments",
  schedule: "every",
  startCutoff: "2026-12-1st",
  taxable: false,
  status: "Active",
  createdAt: new Date("2026-11-27T01:00:00Z"),
  stoppedAt: null,
  ...extra,
});

// A new item as the form sends it
const form = (extra = {}) => ({
  kind: "deduction",
  type: "Company Loan",
  amountPerCutoff: 1000,
  total: 6000,
  repeat: "instalments",
  schedule: "every",
  startCutoff: "2026-12-1st",
  ...extra,
});

describe("the lists the form and the screen use", () => {
  it("has the two kinds, their types, the repeats, the schedules and the statuses", () => {
    expect(KINDS).toEqual(["deduction", "earning"]);
    expect(TYPES).toEqual({
      deduction: ["SSS Loan", "Pag-IBIG Loan", "Company Loan", "Cash Advance", "Other deduction"],
      earning: ["Overtime", "Allowance", "Pay adjustment", "Other earning"],
    });
    expect(REPEATS).toEqual(["once", "instalments", "untilStopped"]);
    expect(SCHEDULES).toEqual(["every", "1st", "2nd"]);
    expect(STATUS).toEqual({
      ACTIVE: "Active",
      PAUSED: "Paused",
      STOPPED: "Stopped",
      COMPLETED: "Completed",
    });
    expect(STORED_STATUSES).toEqual(["Active", "Paused", "Stopped"]);
    expect(ALL_STATUSES).toEqual(["Active", "Paused", "Stopped", "Completed"]);
  });

  it("has the agreed messages, word for word", () => {
    expect(MESSAGES).toMatchObject({
      employeeNotFound: "Employee not found.",
      notFound: "Item not found.",
      type: "Choose a type from the list.",
      amount: "Enter an amount more than 0.",
      totalTooSmall: "The total can't be less than one instalment.",
      startCutoff: "Choose the cut-off it starts on.",
      savedDeduction: "Deduction saved.",
      savedEarning: "Earning saved.",
      stopped: "Stopped.",
      deleted: "Deleted.",
      onPayslip: "This item is on an issued payslip. Stop it instead.",
    });
  });
});

describe("isPayrollPerson (rule 1)", () => {
  const job = { resignationDate: new Date("2026-10-16T00:00:00Z") };

  it.each([
    ["an Active employee", { role: "Employee", status: "Active" }, {}, true],
    ["a Resigned employee with a last working day", { role: "Employee", status: "Resigned" }, job, true],
    ["a Resigned employee without one", { role: "Employee", status: "Resigned" }, {}, false],
    ["a Pending employee", { role: "Employee", status: "Pending" }, {}, false],
    ["an Inactive employee", { role: "Employee", status: "Inactive" }, job, false],
    ["an Admin", { role: "Admin", status: "Active" }, {}, false],
    ["the Super Admin", { role: "Super Admin", status: "Active" }, {}, false],
  ])("%s: %s", (label, account, givenJob, expected) => {
    expect(isPayrollPerson(account, givenJob)).toBe(expected);
  });

  it("no account is not on payroll", () => {
    expect(isPayrollPerson(null)).toBe(false);
    expect(isPayrollPerson(undefined, job)).toBe(false);
  });
});

describe("cut-offs", () => {
  it("knows a cut-off value as toCutoffValue writes it", () => {
    for (const value of ["2026-12-1st", "2026-12-2nd", "2027-01-1st", "2000-01-1st"]) {
      expect([value, isCutoffValue(value)]).toEqual([value, true]);
    }
    for (const value of ["2026-13-1st", "2026-00-1st", "2026-1-1st", "2026-12-3rd", "2026-12-yearEnd", "1999-12-1st", "2026-12-11", "", null, 2026]) {
      expect([value, isCutoffValue(value)]).toEqual([value, false]);
    }
  });

  it("orders cut-offs in time, across a New Year", () => {
    const order = ["2026-11-2nd", "2026-12-1st", "2026-12-2nd", "2027-01-1st", "2027-01-2nd"];
    const indexes = order.map(cutoffIndex);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
    expect(new Set(indexes).size).toBe(order.length);
    expect(cutoffIndex("2027-01-1st") - cutoffIndex("2026-12-2nd")).toBe(1);
    expect(cutoffIndex("not a cut-off")).toBeNull();
  });
});

describe("amountOn (rule 14: when an item lands)", () => {
  // From the start cut-off on: Dec 1st, Dec 2nd, Jan 1st, Jan 2nd
  const CUTOFFS = ["2026-12-1st", "2026-12-2nd", "2027-01-1st", "2027-01-2nd"];
  const landings = (item, paid = 0) => CUTOFFS.map((cutoff) => amountOn(item, cutoff, paid));

  describe.each([
    ["once", { repeat: "once", total: null }],
    ["instalments", { repeat: "instalments", total: 6000 }],
    ["untilStopped", { repeat: "untilStopped", total: null }],
  ])("%s", (repeat, fields) => {
    it.each([
      ["every", [1000, 1000, 1000, 1000]],
      ["1st", [1000, 0, 1000, 0]],
      ["2nd", [0, 1000, 0, 1000]],
    ])("on the %s cut-off: lands only where the schedule matches the half", (schedule, expected) => {
      expect(landings(saved({ ...fields, schedule }))).toEqual(expected);
    });

    it("never lands before its start cut-off", () => {
      const item = saved({ ...fields, startCutoff: "2027-01-1st" });
      expect(amountOn(item, "2026-12-1st")).toBe(0);
      expect(amountOn(item, "2026-12-2nd")).toBe(0);
      expect(amountOn(item, "2026-11-1st")).toBe(0);
      expect(amountOn(item, "2027-01-1st")).toBe(1000);
    });

    it("a start on the 1st with a 2nd-cut-off schedule first lands on that month's 2nd", () => {
      const item = saved({ ...fields, schedule: "2nd", startCutoff: "2026-12-1st" });
      expect(amountOn(item, "2026-12-1st")).toBe(0);
      expect(amountOn(item, "2026-12-2nd")).toBe(1000);
    });

    it("never lands while Paused or Stopped", () => {
      expect(landings(saved({ ...fields, status: "Paused" }))).toEqual([0, 0, 0, 0]);
      expect(landings(saved({ ...fields, status: "Stopped" }))).toEqual([0, 0, 0, 0]);
    });

    it("lands again once resumed", () => {
      expect(amountOn(saved({ ...fields, status: "Active" }), "2027-01-1st")).toBe(1000);
    });

    it("gives 0 for a value that is not a cut-off", () => {
      expect(amountOn(saved(fields), "2026-12-yearEnd")).toBe(0);
      expect(amountOn(saved(fields), undefined)).toBe(0);
    });
  });

  it("once: lands one time, while nothing is paid on it", () => {
    const item = saved({ repeat: "once", total: null, type: "Cash Advance", amountPerCutoff: 2000 });
    expect(amountOn(item, "2026-12-1st", 0)).toBe(2000);
    expect(landings(item, 2000)).toEqual([0, 0, 0, 0]);
  });

  it("instalments: the amount until the balance is 0, the last one being what is left", () => {
    const item = saved({ amountPerCutoff: 1000, total: 2500 });
    expect(amountOn(item, "2026-12-1st", 0)).toBe(1000);
    expect(amountOn(item, "2026-12-2nd", 1000)).toBe(1000);
    expect(amountOn(item, "2027-01-1st", 2000)).toBe(500);
    expect(amountOn(item, "2027-01-2nd", 2500)).toBe(0);
  });

  it("instalments: the remainder is rounded to the centavo", () => {
    const item = saved({ amountPerCutoff: 333.33, total: 1000 });
    expect(amountOn(item, "2027-01-1st", 999.99)).toBe(0.01);
    expect(amountOn(item, "2027-01-1st", 666.66)).toBe(333.33);
    expect(amountOn(item, "2027-01-1st", 700.1)).toBe(299.9);
  });

  it("untilStopped: the amount on every matching cut-off, however much is paid", () => {
    const item = saved({ repeat: "untilStopped", total: null, kind: "earning", type: "Allowance", amountPerCutoff: 750.5 });
    expect(amountOn(item, "2030-06-2nd", 90000)).toBe(750.5);
  });

  it("no item gives 0", () => {
    expect(amountOn(null, "2026-12-1st")).toBe(0);
  });
});

describe("balanceOf and statusOf", () => {
  it("an instalment item's balance is its total less what is paid, never below 0", () => {
    expect(balanceOf(saved(), 0)).toBe(6000);
    expect(balanceOf(saved(), 2000)).toBe(4000);
    expect(balanceOf(saved({ total: 1000 }), 333.33)).toBe(666.67);
    expect(balanceOf(saved(), 6000)).toBe(0);
    expect(balanceOf(saved(), 7000)).toBe(0);
  });

  it("a one-off or until-stopped item has no balance", () => {
    expect(balanceOf(saved({ repeat: "once", total: null }))).toBeNull();
    expect(balanceOf(saved({ repeat: "untilStopped", total: null }))).toBeNull();
  });

  it("the stored status while there is something left", () => {
    expect(statusOf(saved({ status: "Active" }), 1000)).toBe("Active");
    expect(statusOf(saved({ status: "Paused" }), 1000)).toBe("Paused");
    expect(statusOf(saved({ status: "Stopped" }), 1000)).toBe("Stopped");
  });

  it("Completed when an instalment item's balance is 0, whatever is stored", () => {
    for (const status of STORED_STATUSES) {
      expect(statusOf(saved({ status }), 6000)).toBe("Completed");
    }
  });

  it("Completed when a one-off item has landed; an until-stopped item never completes", () => {
    expect(statusOf(saved({ repeat: "once", total: null }), 0)).toBe("Active");
    expect(statusOf(saved({ repeat: "once", total: null }), 1000)).toBe("Completed");
    expect(statusOf(saved({ repeat: "untilStopped", total: null }), 99999)).toBe("Active");
  });

  it("an item with no stored status reads as Active", () => {
    expect(statusOf(saved({ status: undefined }))).toBe("Active");
  });
});

describe("canDelete (rule 15)", () => {
  it("only while nothing is paid on it (on no issued payslip)", () => {
    expect(canDelete(0)).toBe(true);
    expect(canDelete(undefined)).toBe(true);
    expect(canDelete(0.01)).toBe(false);
    expect(canDelete(1000)).toBe(false);
  });
});

describe("loansOf", () => {
  it("adds the balances of open instalment deductions, Active or Paused", () => {
    const a = saved({ total: 6000 });
    const b = saved({ type: "SSS Loan", total: 1234.56, amountPerCutoff: 500, status: "Paused" });
    const paid = new Map([[String(a._id), 2000]]);
    expect(loansOf([a, b], paid)).toBe(5234.56);
    expect(loansOf([a, b], (item) => (item === a ? 2000 : 0))).toBe(5234.56);
  });

  it("leaves out Stopped and Completed items, one-off and until-stopped items, and earnings", () => {
    const completed = saved({ total: 3000 });
    const items = [
      saved({ status: "Stopped" }),
      completed,
      saved({ repeat: "once", total: null, type: "Cash Advance" }),
      saved({ repeat: "untilStopped", total: null, type: "Other deduction" }),
      saved({ kind: "earning", type: "Pay adjustment", taxable: true }),
    ];
    expect(loansOf(items, new Map([[String(completed._id), 3000]]))).toBe(0);
  });

  it("0 for no items, with nothing paid by default", () => {
    expect(loansOf([])).toBe(0);
    expect(loansOf(undefined)).toBe(0);
    expect(loansOf([saved()])).toBe(6000);
  });
});

describe("money", () => {
  it.each([
    [1000, 1000],
    ["6000", 6000],
    [" 1000.50 ", 1000.5],
    [0.005, 0.01],
    ["333.333", 333.33],
    [0, 0],
  ])("reads %p as %p", (value, expected) => {
    expect(money(value)).toBe(expected);
  });

  it("a blank amount is not sent; anything that is not an amount is NaN", () => {
    expect(money(undefined)).toBeUndefined();
    expect(money(null)).toBeUndefined();
    expect(money("  ")).toBeUndefined();
    for (const value of ["abc", "6,000", "-5", true, [1000], {}, Infinity]) {
      expect(Number.isNaN(money(value))).toBe(true);
    }
  });
});

describe("checkItem", () => {
  it("an instalment deduction: the fields ready to save, never taxable", () => {
    expect(checkItem(form({ label: "  Car loan ", note: " Agreed with HR ", taxable: true }))).toEqual({
      fields: {
        kind: "deduction",
        type: "Company Loan",
        label: "Car loan",
        note: "Agreed with HR",
        amountPerCutoff: 1000,
        total: 6000,
        repeat: "instalments",
        schedule: "every",
        startCutoff: "2026-12-1st",
        taxable: false,
      },
    });
  });

  it("an earning is taxable unless false is sent; no total for a recurring one", () => {
    const allowance = form({
      kind: "earning",
      type: "Allowance",
      amountPerCutoff: "750.50",
      total: undefined,
      repeat: "untilStopped",
      schedule: "2nd",
    });
    expect(checkItem(allowance).fields).toMatchObject({
      kind: "earning",
      amountPerCutoff: 750.5,
      total: null,
      repeat: "untilStopped",
      schedule: "2nd",
      label: "",
      note: "",
      taxable: true,
    });
    expect(checkItem({ ...allowance, taxable: false }).fields.taxable).toBe(false);
    expect(checkItem({ ...allowance, total: "", taxable: null }).fields).toMatchObject({
      total: null,
      taxable: true,
    });
  });

  it("a one-off cash advance", () => {
    expect(
      checkItem(form({ type: "Cash Advance", repeat: "once", total: null, amountPerCutoff: 2000 })).fields,
    ).toMatchObject({ repeat: "once", total: null, amountPerCutoff: 2000 });
  });

  it("a total equal to one instalment is fine", () => {
    expect(checkItem(form({ total: 1000 })).fields.total).toBe(1000);
  });

  it.each([
    ["no kind", { kind: undefined }, MESSAGES.kind],
    ["a kind that is not one", { kind: "loan" }, MESSAGES.kind],
    ["no type", { type: undefined }, MESSAGES.type],
    ["a type that is not on the list", { type: "Car Loan" }, MESSAGES.type],
    ["an earning type on a deduction", { type: "Allowance" }, MESSAGES.type],
    ["a deduction type on an earning", { kind: "earning", type: "Company Loan" }, MESSAGES.type],
    ["a label that is too long", { label: "x".repeat(61) }, MESSAGES.label],
    ["a label that is not text", { label: 42 }, MESSAGES.label],
    ["a note that is too long", { note: "x".repeat(201) }, MESSAGES.note],
    ["no amount", { amountPerCutoff: undefined }, MESSAGES.amount],
    ["an amount of 0", { amountPerCutoff: 0 }, MESSAGES.amount],
    ["an amount that rounds to 0", { amountPerCutoff: 0.004 }, MESSAGES.amount],
    ["a negative amount", { amountPerCutoff: -1000 }, MESSAGES.amount],
    ["an amount with a comma", { amountPerCutoff: "1,000" }, MESSAGES.amount],
    ["no repeat", { repeat: undefined }, MESSAGES.repeat],
    ["a repeat that is not one", { repeat: "monthly" }, MESSAGES.repeat],
    ["instalments with no total", { total: undefined }, MESSAGES.totalMissing],
    ["instalments with a total of 0", { total: 0 }, MESSAGES.totalMissing],
    ["instalments with a total that is not a number", { total: "six" }, MESSAGES.totalMissing],
    ["a total less than one instalment", { total: 999.99 }, MESSAGES.totalTooSmall],
    ["a total on a one-off item", { repeat: "once", total: 1000 }, MESSAGES.totalOnlyInstalments],
    ["a total on an until-stopped item", { repeat: "untilStopped", total: 6000 }, MESSAGES.totalOnlyInstalments],
    ["no schedule", { schedule: undefined }, MESSAGES.schedule],
    ["a schedule that is not one", { schedule: "3rd" }, MESSAGES.schedule],
    ["no start cut-off", { startCutoff: undefined }, MESSAGES.startCutoff],
    ["a start cut-off that is a date", { startCutoff: "2026-12-11" }, MESSAGES.startCutoff],
    ["a start cut-off that is not one", { startCutoff: "2026-12-3rd" }, MESSAGES.startCutoff],
    [
      "a taxable flag that is not yes or no, on an earning",
      { kind: "earning", type: "Overtime", repeat: "once", total: null, taxable: "yes" },
      MESSAGES.taxable,
    ],
  ])("refuses %s", (label, change, message) => {
    expect(checkItem(form(change))).toEqual({ error: message });
  });

  it("refuses an empty body with the first field's message", () => {
    expect(checkItem(undefined)).toEqual({ error: MESSAGES.kind });
    expect(checkItem([])).toEqual({ error: MESSAGES.kind });
  });
});

describe("checkChange", () => {
  it("an edit: only the fields that differ, and the action", () => {
    expect(
      checkChange({ amountPerCutoff: "1500", note: " Raised ", schedule: "every", label: "" }, saved()),
    ).toEqual({ fields: { amountPerCutoff: 1500, note: "Raised" }, action: "edit" });
  });

  it("a form that sends every field back, with the fixed ones unchanged, is an edit of what differs", () => {
    const item = saved();
    expect(
      checkChange(
        {
          kind: item.kind,
          type: item.type,
          repeat: item.repeat,
          startCutoff: item.startCutoff,
          amountPerCutoff: 1000,
          total: 8000,
          schedule: "every",
        },
        item,
      ),
    ).toEqual({ fields: { total: 8000 }, action: "edit" });
  });

  it("a Paused item can be edited", () => {
    expect(checkChange({ schedule: "1st" }, saved({ status: "Paused" }))).toEqual({
      fields: { schedule: "1st" },
      action: "edit",
    });
  });

  it("pause and resume", () => {
    expect(checkChange({ status: "Paused" }, saved())).toEqual({
      fields: { status: "Paused" },
      action: "pause",
    });
    expect(checkChange({ status: "Active" }, saved({ status: "Paused" }))).toEqual({
      fields: { status: "Active" },
      action: "resume",
    });
    // With the saved values sent alongside, it is still a pause alone
    expect(checkChange({ status: "Paused", amountPerCutoff: 1000 }, saved()).action).toBe("pause");
  });

  it("the total of an instalment item can come down to what is paid, not below", () => {
    expect(checkChange({ total: 3000 }, saved(), 3000)).toEqual({
      fields: { total: 3000 },
      action: "edit",
    });
    expect(checkChange({ total: 2999 }, saved(), 3000)).toEqual({
      error: MESSAGES.totalBelowPaid,
      status: 400,
    });
  });

  it.each([
    ["a stopped item", saved({ status: "Stopped" }), { amountPerCutoff: 2000 }, 0, MESSAGES.stoppedLocked],
    ["a stopped item, even with a bad body", saved({ status: "Stopped" }), { amountPerCutoff: -1 }, 0, MESSAGES.stoppedLocked],
    ["resuming a stopped item", saved({ status: "Stopped" }), { status: "Active" }, 0, MESSAGES.stoppedLocked],
    ["a completed instalment item", saved(), { amountPerCutoff: 2000 }, 6000, MESSAGES.completedLocked],
    ["pausing a completed item", saved(), { status: "Paused" }, 6000, MESSAGES.completedLocked],
    ["pausing a paused item", saved({ status: "Paused" }), { status: "Paused" }, 0, MESSAGES.alreadyPaused],
    ["resuming an active item", saved(), { status: "Active" }, 0, MESSAGES.alreadyActive],
  ])("refuses %s with 409", (label, item, body, paid, message) => {
    expect(checkChange(body, item, paid)).toEqual({ error: message, status: 409 });
  });

  it.each([
    ["another kind", { kind: "earning" }, MESSAGES.fixedField],
    ["another type", { type: "SSS Loan" }, MESSAGES.fixedField],
    ["another repeat", { repeat: "untilStopped" }, MESSAGES.fixedField],
    ["another start cut-off", { startCutoff: "2027-01-1st" }, MESSAGES.fixedField],
    ["an amount of 0", { amountPerCutoff: 0 }, MESSAGES.amount],
    ["an amount that is not one", { amountPerCutoff: "lots" }, MESSAGES.amount],
    ["a label that is too long", { label: "x".repeat(61) }, MESSAGES.label],
    ["a note that is not text", { note: ["x"] }, MESSAGES.note],
    ["a schedule that is not one", { schedule: "weekly" }, MESSAGES.schedule],
    ["a blank total on instalments", { total: "" }, MESSAGES.totalMissing],
    ["a total less than one instalment", { total: 500 }, MESSAGES.totalTooSmall],
    ["an amount above the total", { amountPerCutoff: 7000 }, MESSAGES.totalTooSmall],
    ["a status that is neither", { status: "Stopped" }, MESSAGES.statusChoice],
    ["a status with another change", { status: "Paused", note: "Holiday" }, MESSAGES.statusAlone],
    ["nothing that changes", { amountPerCutoff: 1000, note: "" }, MESSAGES.nothingChanged],
    ["an empty body", {}, MESSAGES.nothingChanged],
    ["only fields that can't be changed, unchanged", { userId: "someone", createdBy: "x" }, MESSAGES.nothingChanged],
  ])("refuses %s with 400", (label, body, message) => {
    expect(checkChange(body, saved())).toEqual({ error: message, status: 400 });
  });

  it("refuses a total on an item that is not paid in instalments; a blank one is fine", () => {
    const allowance = saved({ kind: "earning", type: "Allowance", repeat: "untilStopped", total: null, taxable: true });
    expect(checkChange({ total: 5000 }, allowance)).toEqual({
      error: MESSAGES.totalOnlyInstalments,
      status: 400,
    });
    expect(checkChange({ total: null, amountPerCutoff: 800 }, allowance)).toEqual({
      fields: { amountPerCutoff: 800 },
      action: "edit",
    });
  });

  it("an earning's taxable flag can't be changed; a deduction's is ignored", () => {
    const allowance = saved({ kind: "earning", type: "Allowance", repeat: "untilStopped", total: null, taxable: true });
    expect(checkChange({ taxable: false }, allowance)).toEqual({
      error: MESSAGES.fixedField,
      status: 400,
    });
    expect(checkChange({ taxable: true, note: "x" }, saved()).fields).toEqual({ note: "x" });
  });
});

describe("checkStatusFilter", () => {
  it("each status, or none", () => {
    for (const status of ALL_STATUSES) {
      expect(checkStatusFilter(status)).toEqual({ status });
    }
    expect(checkStatusFilter(undefined)).toEqual({ status: null });
    expect(checkStatusFilter("")).toEqual({ status: null });
  });

  it("refuses anything else", () => {
    for (const value of ["active", "Open", ["Active"]]) {
      expect(checkStatusFilter(value)).toEqual({ error: MESSAGES.statusFilter });
    }
  });
});

describe("itemReply", () => {
  const employee = { firstName: "Angelica", lastName: "Ramos", employeeId: "AC-008" };

  it("the item with its paid amount, balance and worked-out status, and the employee by name", () => {
    const item = saved({ label: "Car loan", note: "Agreed with HR" });
    expect(itemReply(item, { paid: 2000, employee })).toStrictEqual({
      id: String(item._id),
      userId: String(item.userId),
      employeeId: "AC-008",
      name: "Angelica Ramos",
      kind: "deduction",
      type: "Company Loan",
      label: "Car loan",
      note: "Agreed with HR",
      amountPerCutoff: 1000,
      total: 6000,
      paid: 2000,
      balance: 4000,
      repeat: "instalments",
      schedule: "every",
      startCutoff: "2026-12-1st",
      taxable: false,
      status: "Active",
      createdAt: item.createdAt,
      stoppedAt: null,
    });
  });

  it("Completed once the balance is 0; a one-off has no total and no balance", () => {
    expect(itemReply(saved(), { paid: 6000, employee })).toMatchObject({
      balance: 0,
      status: "Completed",
    });
    expect(itemReply(saved({ repeat: "once", total: null }), { employee })).toMatchObject({
      total: null,
      balance: null,
      paid: 0,
      status: "Active",
    });
  });

  it("an earning keeps its taxable flag; nothing is sent about who made or stopped it", () => {
    const stoppedAt = new Date("2026-12-20T03:00:00Z");
    const reply = itemReply(
      saved({
        kind: "earning",
        type: "Allowance",
        repeat: "untilStopped",
        total: null,
        taxable: true,
        status: "Stopped",
        stoppedAt,
        createdBy: new mongoose.Types.ObjectId(),
        stoppedBy: new mongoose.Types.ObjectId(),
      }),
    );
    expect(reply).toMatchObject({ taxable: true, status: "Stopped", stoppedAt, name: "", employeeId: "" });
    expect(reply).not.toHaveProperty("createdBy");
    expect(reply).not.toHaveProperty("stoppedBy");
  });
});
