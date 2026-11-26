// The pure rules of the activity log (PR E, utils/activityLog.js): the table of logged
// actions, which fields an edit lists, how a person is named, the date filters and the
// reply shape. The routes and the read API are in activityLogApi.test.js.
const mongoose = require("mongoose");

const {
  PAGE_SIZE,
  GROUPS,
  GROUP_KEYS,
  MESSAGES,
  ACTIONS,
  CHANGE_LABELS,
  PASSWORD_RESET,
  MAX_TEXT_LENGTH,
  clip,
  decisionAction,
  detailsAction,
  countOf,
  listName,
  leaveNote,
  holidayName,
  holidayImportNote,
  tableName,
  statutoryOffNote,
  changedFields,
  personName,
  dayRange,
  pageNumber,
  checkActivityQuery,
  activityFilter,
  toReplyEntry,
} = require("../utils/activityLog");

const id = () => String(new mongoose.Types.ObjectId());

describe("the table of logged actions", () => {
  it("lists the ten groups in the order the screen shows them", () => {
    expect(GROUPS).toEqual([
      { key: "employees", label: "Employees" },
      { key: "signups", label: "Sign-ups" },
      { key: "access", label: "Page access" },
      { key: "attendance", label: "Attendance" },
      { key: "filing", label: "Filing" },
      { key: "company", label: "Company" },
      { key: "lists", label: "Lists" },
      { key: "admins", label: "Admin accounts" },
      { key: "holidays", label: "Holidays" },
      { key: "deductions", label: "Deductions" },
    ]);
    expect(GROUP_KEYS).toEqual(GROUPS.map((group) => group.key));
  });

  it("holds exactly these keys, each with its label and group", () => {
    const table = Object.entries(ACTIONS).map(([key, { label, group }]) => [
      key,
      label,
      group,
    ]);
    expect(table).toEqual([
      ["employee.add", "Added employee", "employees"],
      ["employee.edit", "Edited employee", "employees"],
      ["employee.resign", "Marked as resigned", "employees"],
      ["employee.reinstate", "Reinstated", "employees"],
      ["employee.delete", "Deleted employee", "employees"],
      ["employee.details", "Edited contact details", "employees"],
      ["account.details", "Edited own details", "employees"],
      ["photo.set", "Changed photo", "employees"],
      ["photo.remove", "Removed photo", "employees"],
      ["signup.approve", "Approved sign-up", "signups"],
      ["access.set", "Changed page access", "access"],
      ["attendance.edit", "Edited attendance", "attendance"],
      ["attendance.import", "Imported from the device", "attendance"],
      ["attendance.blankDay", "Added blank attendance day", "attendance"],
      ["leave.approve", "Approved leave", "filing"],
      ["leave.disapprove", "Disapproved leave", "filing"],
      ["overtime.approve", "Approved overtime", "filing"],
      ["overtime.disapprove", "Disapproved overtime", "filing"],
      ["company.edit", "Edited company details", "company"],
      ["company.logo", "Changed company logo", "company"],
      ["company.logoRemove", "Removed company logo", "company"],
      ["list.add", "Added list item", "lists"],
      ["list.rename", "Renamed list item", "lists"],
      ["list.remove", "Removed list item", "lists"],
      ["admin.create", "Created Admin account", "admins"],
      ["admin.edit", "Edited Admin account", "admins"],
      ["admin.disable", "Disabled Admin", "admins"],
      ["admin.enable", "Enabled Admin", "admins"],
      ["admin.resetPassword", "Reset Admin password", "admins"],
      ["holiday.add", "Added holiday", "holidays"],
      ["holiday.remove", "Removed holiday", "holidays"],
      ["holiday.import", "Imported holidays", "holidays"],
      ["table.add", "Added deduction table", "deductions"],
      ["table.edit", "Edited draft table", "deductions"],
      ["table.delete", "Deleted draft table", "deductions"],
      ["table.confirm", "Confirmed deduction table", "deductions"],
      ["table.checked", "Marked table as checked", "deductions"],
      ["statutory.off", "Changed switched-off deductions", "deductions"],
    ]);
  });

  it("switching deductions off is recorded against one fixed record, not an account", () => {
    expect(ACTIONS["statutory.off"].targetName).toBe("Statutory deductions");
  });

  it("no label, group or record name holds a figure: an amount or a rate has nowhere to sit", () => {
    expect(JSON.stringify([GROUPS, ACTIONS, CHANGE_LABELS])).not.toMatch(/\d/);
  });

  it.each(Object.entries(ACTIONS))(
    "%s has a filled label, a known group, and a known kind of record when it lists changes",
    (key, spec) => {
      expect(typeof spec.label).toBe("string");
      expect(spec.label.trim()).not.toBe("");
      expect(GROUP_KEYS).toContain(spec.group);
      if (spec.changes !== undefined) {
        expect(Object.keys(CHANGE_LABELS)).toContain(spec.changes);
      }
    },
  );

  it("no label, group or record name says a role", () => {
    const words = JSON.stringify([GROUPS, ACTIONS, CHANGE_LABELS]);
    expect(words).not.toContain("Super Admin");
    expect(words.toLowerCase()).not.toContain("role");
  });

  it("a decision's key follows the status: Approved, or anything else as disapproved", () => {
    expect(decisionAction("leave", "Approved")).toBe("leave.approve");
    expect(decisionAction("leave", "Disapproved")).toBe("leave.disapprove");
    expect(decisionAction("overtime", "Approved")).toBe("overtime.approve");
    expect(decisionAction("overtime", "Disapproved")).toBe(
      "overtime.disapprove",
    );
    expect(ACTIONS[decisionAction("leave", undefined)]).toBeDefined();
  });

  it("General settings: own details for the caller's own account, contact details for anyone else", () => {
    const me = id();
    expect(detailsAction(me, me)).toBe("account.details");
    expect(detailsAction(new mongoose.Types.ObjectId(me), me)).toBe(
      "account.details",
    );
    expect(detailsAction(me, id())).toBe("employee.details");
  });
});

describe("what the request alone tells (describe)", () => {
  const describeFor = (key, request) =>
    ACTIONS[key].describe({ params: {}, body: {}, ...request });

  it("resign: the last working day", () => {
    expect(
      describeFor("employee.resign", {
        body: { resignationDate: "2026-10-16", resignationReason: "Moving" },
      }),
    ).toEqual({ note: "Last working day 2026-10-16" });
  });

  it("page access: custom ticks, or back to the default", () => {
    expect(describeFor("access.set", { body: { pages: ["payroll"] } })).toEqual(
      { note: "Custom ticks" },
    );
    expect(describeFor("access.set", { body: { reset: true } })).toEqual({
      note: "Back to the default",
    });
    // Only a real `true` resets, as on the route
    expect(describeFor("access.set", { body: { reset: "true" } })).toEqual({
      note: "Custom ticks",
    });
  });

  it("attendance edit: the day", () => {
    expect(
      describeFor("attendance.edit", {
        body: { date: "2026-11-12", timeIn: "08:00:00" },
      }),
    ).toEqual({ note: "2026-11-12" });
  });

  it("lists: the list and the item, trimmed", () => {
    expect(
      describeFor("list.add", {
        params: { field: "departments" },
        body: { option: " Engineering " },
      }),
    ).toEqual({ targetName: "Departments list", note: "Engineering" });
    expect(
      describeFor("list.rename", {
        params: { field: "departments" },
        body: { oldOption: "Engg", newOption: " Engineering " },
      }),
    ).toEqual({ targetName: "Departments list", note: "Engg to Engineering" });
    expect(
      describeFor("list.remove", {
        params: { field: "employmentTypes" },
        body: { option: "Intern" },
      }),
    ).toEqual({ targetName: "Employment types list", note: "Intern" });
  });

  it("positions: the department and the item", () => {
    expect(
      describeFor("list.add", {
        params: { department: "Engineering" },
        body: { option: "Site Engineer" },
      }),
    ).toEqual({ targetName: "Positions in Engineering", note: "Site Engineer" });
    expect(
      describeFor("list.rename", {
        params: { department: "Engineering" },
        body: { oldOption: "Site Engr", newOption: "Site Engineer" },
      }),
    ).toEqual({
      targetName: "Positions in Engineering",
      note: "Site Engr to Site Engineer",
    });
  });

  it.each([
    ["designations", "Designations list"],
    ["departments", "Departments list"],
    ["employmentTypes", "Employment types list"],
    ["itemCategories", "Item categories list"],
    ["unitsOfMeasure", "Units of measure list"],
  ])("listName names the %s list", (field, name) => {
    expect(listName({ field })).toBe(name);
  });
});

describe("the notes the routes build", () => {
  it("countOf: one thing or many", () => {
    expect(countOf(0, "record", "imported")).toBe("0 records imported");
    expect(countOf(1, "record", "added")).toBe("1 record added");
    expect(countOf(48, "record", "imported")).toBe("48 records imported");
  });

  it("leaveNote: the type and the days, from Dates or texts", () => {
    expect(
      leaveNote({
        leaveType: "Sick Leave",
        startDate: new Date("2026-11-16T00:00:00Z"),
        endDate: new Date("2026-11-18T00:00:00Z"),
      }),
    ).toBe("Sick Leave, 2026-11-16 to 2026-11-18");
    expect(
      leaveNote({
        leaveType: "Vacation Leave",
        startDate: "2026-11-16",
        endDate: "2026-11-16",
      }),
    ).toBe("Vacation Leave, 2026-11-16");
  });

  it("holidayName: the name and the day", () => {
    expect(
      holidayName({
        name: "Christmas Day",
        date: new Date("2026-12-25T00:00:00Z"),
        type: "Regular",
      }),
    ).toBe("Christmas Day, 2026-12-25");
  });

  it("holidayImportNote: how many were saved, and how many dates were skipped", () => {
    expect(holidayImportNote(12, 0)).toBe("12 holidays imported");
    expect(holidayImportNote(1)).toBe("1 holiday imported");
    expect(holidayImportNote(10, 2)).toBe("10 holidays imported, 2 skipped");
  });

  it.each([
    ["sss", "SSS table from 2027-01-01"],
    ["philhealth", "PhilHealth table from 2027-01-01"],
    ["pagibig", "Pag-IBIG table from 2027-01-01"],
    ["tax", "Withholding tax table from 2027-01-01"],
  ])("tableName: a %s table by its kind and the day it takes effect", (kind, name) => {
    // The figures are made up for the test (not official); none of them is in the name
    const table = {
      kind,
      effectiveFrom: new Date("2027-01-01T00:00:00Z"),
      source: "Test issuance",
      rows: [{ over: 0, upTo: null, employeeFixed: 412.35, employerRate: 7.25 }],
    };
    expect(tableName(table)).toBe(name);
    expect(tableName({ ...table, effectiveFrom: "2027-01-01" })).toBe(name);
    expect(tableName(table)).not.toMatch(/412|7\.25/);
  });

  it("statutoryOffNote: the kinds that are off by name, in the screen's order, or that none is", () => {
    expect(statutoryOffNote(["tax", "sss"])).toBe(
      "Switched off: SSS, Withholding tax",
    );
    expect(statutoryOffNote(["pagibig"])).toBe("Switched off: Pag-IBIG");
    expect(statutoryOffNote([])).toBe("None switched off");
    expect(statutoryOffNote(undefined)).toBe("None switched off");
  });

  it("clip: a record name or note is trimmed and cut at 200 characters; a missing one is blank", () => {
    expect(MAX_TEXT_LENGTH).toBe(200);
    expect(clip("  Departments list ")).toBe("Departments list");
    expect(clip("x".repeat(500))).toBe("x".repeat(200));
    expect(clip(undefined)).toBe("");
    expect(clip(null)).toBe("");
    expect(clip(2026)).toBe("2026");
  });

  it("no note helper prints undefined for a missing record", () => {
    for (const note of [
      leaveNote(undefined),
      holidayName(undefined),
      tableName(undefined),
      tableName({ kind: "loans" }),
      statutoryOffNote(undefined),
    ]) {
      expect(note).not.toContain("undefined");
    }
    expect(tableName(undefined)).toBe("");
  });
});

describe("changedFields", () => {
  const person = () => ({
    account: { username: "angelica", email: "angelica@example.com" },
    employee: {
      firstName: "Angelica",
      lastName: "Ramos",
      employeeId: "AC-008",
      email: "angelica@example.com",
      gender: "Female",
      birthday: new Date("1995-03-04T00:00:00Z"),
      contactNumber: "09171234567",
      address: { country: "Philippines", city: "Pasig", street: "" },
      emergencyDetails: { contactFirstName: "Luz", contactLastName: "Ramos" },
    },
    job: {
      designation: "Staff",
      department: "Engineering",
      position: "Site Engineer",
      employmentType: "Regular",
      startDate: new Date("2024-01-08T00:00:00Z"),
      regularizationDate: new Date("2024-07-08T00:00:00Z"),
      vacationLeaveOpening: 0,
      schedule: { timeIn: "08:00", timeOut: "17:00" },
      basicPay: 22000,
    },
  });
  const changed = (edit) => {
    const after = person();
    edit(after);
    return changedFields(person(), after, CHANGE_LABELS.person);
  };

  it("saving the form unchanged gives an empty list", () => {
    expect(changedFields(person(), person(), CHANGE_LABELS.person)).toEqual([]);
  });

  it("lists basic pay as a label only, never an amount", () => {
    const labels = changed((after) => {
      after.job.basicPay = 23000;
    });
    expect(labels).toEqual(["basic pay"]);
    expect(JSON.stringify(labels)).not.toMatch(/\d/);
  });

  it("an unchanged basic pay is not listed with other changes", () => {
    expect(
      changed((after) => {
        after.employee.contactNumber = "09179999999";
      }),
    ).toEqual(["contact number"]);
  });

  it("follows the order of the table, whatever order the fields changed in", () => {
    expect(
      changed((after) => {
        after.job.basicPay = 23000;
        after.job.position = "Project Engineer";
        after.employee.firstName = "Angel";
        after.account.username = "angel";
      }),
    ).toEqual(["name", "username", "position", "basic pay"]);
  });

  it.each([
    ["name", (after) => (after.employee.lastName = "Reyes")],
    ["Employee ID", (after) => (after.employee.employeeId = "AC-080")],
    ["username", (after) => (after.account.username = "a.ramos")],
    ["email", (after) => (after.account.email = "new@example.com")],
    ["email", (after) => (after.employee.email = "new@example.com")],
    ["gender", (after) => (after.employee.gender = "Male")],
    ["birthday", (after) => (after.employee.birthday = "1995-03-05")],
    ["contact number", (after) => (after.employee.contactNumber = "0918")],
    ["address", (after) => (after.employee.address.city = "Makati")],
    [
      "emergency contact",
      (after) => (after.employee.emergencyDetails.contactFirstName = "Lita"),
    ],
    ["designation", (after) => (after.job.designation = "Supervisor")],
    ["department", (after) => (after.job.department = "Accounting")],
    ["position", (after) => (after.job.position = "Accountant")],
    ["employment type", (after) => (after.job.employmentType = "Probationary")],
    ["start date", (after) => (after.job.startDate = "2024-01-09")],
    [
      "date of regularization",
      (after) => (after.job.regularizationDate = null),
    ],
    ["VL opening balance", (after) => (after.job.vacationLeaveOpening = 5)],
    ["schedule", (after) => (after.job.schedule.timeOut = "18:00")],
    ["basic pay", (after) => (after.job.basicPay = 0)],
  ])("lists %s when its saved value differs", (label, edit) => {
    expect(changed(edit)).toEqual([label]);
  });

  it("a date text and a Date for the same day are the same value", () => {
    expect(
      changed((after) => {
        after.employee.birthday = "1995-03-04";
        after.job.startDate = "2024-01-08";
        after.job.regularizationDate = "2024-07-08";
      }),
    ).toEqual([]);
  });

  it("missing, null and blank are the same value", () => {
    const before = person();
    before.employee.contactNumber = "";
    before.employee.birthday = null;
    const after = person();
    delete after.employee.contactNumber;
    after.employee.birthday = "";
    expect(changedFields(before, after, CHANGE_LABELS.person)).toEqual([]);
  });

  it("an address with blank parts equals one without them", () => {
    expect(
      changed((after) => {
        after.employee.address = { country: "Philippines", city: "Pasig" };
      }),
    ).toEqual([]);
  });

  it("an Admin account (no employee record): name and email from the account", () => {
    const before = {
      account: { firstName: "Rhea", lastName: "Cruz", email: "rhea@example.com" },
      employee: null,
      job: {},
    };
    const after = {
      account: { firstName: "Rhea", lastName: "Ruiz", email: "rhea@example.com" },
      employee: null,
      job: {},
    };
    expect(changedFields(before, after, CHANGE_LABELS.person)).toEqual(["name"]);
  });

  describe("an Admin account edited in Settings > Admins", () => {
    const anaId = new mongoose.Types.ObjectId();
    const benId = new mongoose.Types.ObjectId();
    const admin = (extra = {}) => ({
      account: {
        firstName: "Rhea",
        lastName: "Cruz",
        email: "rhea@example.com",
        pageAccess: ["admin-dashboard", "employees", "admin-settings"],
        payAccess: [anaId, benId],
        linkedEmployeeId: undefined,
        ...extra,
      },
    });

    it("lists name, email, ticks, pay list and linked employee, in that order", () => {
      expect(
        changedFields(
          admin(),
          admin({
            lastName: "Ruiz",
            email: "ruiz@example.com",
            pageAccess: ["admin-dashboard", "admin-settings"],
            payAccess: [anaId],
            linkedEmployeeId: benId,
          }),
          CHANGE_LABELS.admin,
        ),
      ).toEqual(["name", "email", "ticks", "pay list", "linked employee"]);
    });

    it("the same ticks and pay list in another order, or as id texts, are no change", () => {
      expect(
        changedFields(
          admin(),
          admin({
            pageAccess: ["employees", "admin-settings", "admin-dashboard"],
            payAccess: [String(benId), String(anaId)],
          }),
          CHANGE_LABELS.admin,
        ),
      ).toEqual([]);
    });

    it("a pay list that was never set equals an empty one", () => {
      expect(
        changedFields(
          admin({ payAccess: undefined }),
          admin({ payAccess: [] }),
          CHANGE_LABELS.admin,
        ),
      ).toEqual([]);
    });
  });

  it("company details: name, contact, date format, time format", () => {
    const before = {
      name: "ACESER",
      contact: "",
      dateFormat: "MM-DD-YYYY",
      timeFormat: "12 Hour",
      logo: "/uploads/a.png",
    };
    expect(
      changedFields(
        before,
        { ...before, name: "ACESER Corp", timeFormat: "24 Hour", logo: "" },
        CHANGE_LABELS.company,
      ),
    ).toEqual(["name", "time format"]);
  });

  it("attendance: a time that moved by a minute is a change; the same moment is not", () => {
    const before = {
      timeIn: new Date("2026-11-12T08:00:00Z"),
      timeOut: new Date("2026-11-12T17:00:00Z"),
    };
    expect(
      changedFields(
        before,
        {
          timeIn: new Date("2026-11-12T08:01:00Z"),
          timeOut: new Date("2026-11-12T17:00:00Z"),
        },
        CHANGE_LABELS.attendance,
      ),
    ).toEqual(["time in"]);
    expect(
      changedFields(
        { timeIn: undefined, timeOut: undefined },
        { timeIn: new Date("2026-11-12T08:00:00Z"), timeOut: null },
        CHANGE_LABELS.attendance,
      ),
    ).toEqual(["time in"]);
    expect(
      changedFields(before, { ...before }, CHANGE_LABELS.attendance),
    ).toEqual([]);
  });

  describe("a draft deduction table (figures made up for the test, not official)", () => {
    const draft = (extra = {}) => ({
      kind: "sss",
      effectiveFrom: new Date("2027-01-01T00:00:00Z"),
      source: "Test issuance A",
      base: "monthlyBasic",
      deductOn: "both",
      rows: [
        { over: 0, upTo: 1000, employeeFixed: 11, employeeRate: 0, employerFixed: 22, employerRate: 0, excessOver: 0 },
        { over: 1000, upTo: null, employeeFixed: 11, employeeRate: 7, employerFixed: 22, employerRate: 9, excessOver: 1000 },
      ],
      ...extra,
    });
    const changed = (extra) =>
      changedFields(draft(), draft(extra), CHANGE_LABELS.table);

    it("saving it unchanged lists nothing, also with the date as text", () => {
      expect(changed({})).toEqual([]);
      expect(changed({ effectiveFrom: "2027-01-01" })).toEqual([]);
    });

    it.each([
      ["kind", { kind: "tax" }],
      ["effective date", { effectiveFrom: "2027-02-01" }],
      ["source", { source: "Test issuance B" }],
      ["base", { base: "cutoffGross" }],
      ["cut-off taken on", { deductOn: "2nd" }],
    ])("lists %s when its saved value differs", (label, extra) => {
      expect(changed(extra)).toEqual([label]);
    });

    it("a changed amount, a changed rate, a moved edge and an added row are each just 'rows'", () => {
      const rows = () => draft().rows.map((row) => ({ ...row }));
      const amount = rows();
      amount[0].employeeFixed = 12.5;
      const rate = rows();
      rate[1].employerRate = 9.75;
      const edge = rows();
      edge[0].upTo = 1500;
      edge[1].over = 1500;
      const added = [
        ...rows().slice(0, 1),
        { ...rows()[1], upTo: 2500 },
        { over: 2500, upTo: null, employeeFixed: 123.45, employeeRate: 0, employerFixed: 234.56, employerRate: 0, excessOver: 0 },
      ];

      for (const changedRows of [amount, rate, edge, added]) {
        const labels = changed({ rows: changedRows });
        expect(labels).toEqual(["rows"]);
        expect(JSON.stringify(labels)).not.toMatch(/\d/);
      }
    });

    it("follows the order of the table when several fields change", () => {
      expect(
        changed({
          rows: [{ ...draft().rows[0], upTo: null }],
          deductOn: "1st",
          source: "Test issuance B",
          kind: "pagibig",
        }),
      ).toEqual(["kind", "source", "cut-off taken on", "rows"]);
    });
  });

  it("gives an empty list when a record could not be read, or no labels are given", () => {
    expect(changedFields(null, person(), CHANGE_LABELS.person)).toEqual([]);
    expect(changedFields(person(), undefined, CHANGE_LABELS.person)).toEqual([]);
    expect(changedFields(person(), person(), undefined)).toEqual([]);
  });

  it("the label for a set password holds no password", () => {
    expect(PASSWORD_RESET).toBe("password reset");
  });
});

describe("personName", () => {
  const employee = { firstName: "Angelica", lastName: "Ramos", employeeId: "AC-008" };

  it("is First Last (Employee ID) from the employee record", () => {
    expect(personName(employee, { username: "angelica" })).toBe(
      "Angelica Ramos (AC-008)",
    );
  });

  it("leaves the Employee ID out when asked, or when there is none", () => {
    expect(personName(employee, null, { withId: false })).toBe("Angelica Ramos");
    expect(personName({ firstName: "Angelica", lastName: "Ramos" })).toBe(
      "Angelica Ramos",
    );
  });

  it("falls back to the names on the account (an Admin account)", () => {
    expect(
      personName(null, { firstName: "Rhea", lastName: "Cruz", username: "hr.rhea" }),
    ).toBe("Rhea Cruz");
  });

  it("then to the username", () => {
    expect(personName(null, { username: "admin" })).toBe("admin");
    expect(personName({}, { firstName: " ", username: "admin" })).toBe("admin");
  });

  it("is never undefined or blank", () => {
    for (const args of [[], [null, null], [{}, {}], [undefined, { username: "" }]]) {
      const name = personName(...args);
      expect(name).toBe("Unknown");
      expect(name).not.toContain("undefined");
    }
    expect(personName({ firstName: "Ana" }, null)).toBe("Ana");
  });
});

describe("dayRange (Manila days, both included)", () => {
  it("runs from Manila midnight of the start to the last millisecond of the end", () => {
    const range = dayRange("2026-11-16", "2026-11-17");
    // Manila is UTC+8: Nov 16 00:00 there is Nov 15 16:00 UTC
    expect(range.from.toISOString()).toBe("2026-11-15T16:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-11-17T15:59:59.999Z");
  });

  it("one day is a full day", () => {
    const range = dayRange("2026-11-16", "2026-11-16");
    expect(range.to.getTime() - range.from.getTime()).toBe(
      24 * 60 * 60 * 1000 - 1,
    );
  });

  it("a missing or blank end is open", () => {
    expect(dayRange("2026-11-16", undefined)).toEqual({
      from: new Date("2026-11-15T16:00:00.000Z"),
      to: null,
    });
    expect(dayRange("", "2026-11-16")).toEqual({
      from: null,
      to: new Date("2026-11-16T15:59:59.999Z"),
    });
    expect(dayRange(undefined, undefined)).toEqual({ from: null, to: null });
  });

  it.each([
    ["another order", "11-16-2026"],
    ["slashes", "2026/11/16"],
    ["a day that doesn't exist", "2026-02-30"],
    ["a month that doesn't exist", "2026-13-01"],
    ["a date with a time", "2026-11-16T00:00:00Z"],
    ["words", "yesterday"],
    ["a list", ["2026-11-16", "2026-11-17"]],
    ["a number", 20261116],
  ])("refuses %s, as the start or the end", (label, value) => {
    expect(dayRange(value, undefined)).toEqual({
      error: "Dates must be in YYYY-MM-DD form.",
    });
    expect(dayRange("2026-11-01", value)).toEqual({
      error: "Dates must be in YYYY-MM-DD form.",
    });
  });

  it("refuses a start after the end", () => {
    expect(dayRange("2026-11-20", "2026-11-01")).toEqual({
      error: "The start date is after the end date.",
    });
  });
});

describe("checkActivityQuery", () => {
  it("no filters: everything, page 1", () => {
    expect(checkActivityQuery({})).toEqual({
      by: undefined,
      group: undefined,
      from: null,
      to: null,
      q: "",
      page: 1,
    });
    expect(checkActivityQuery(undefined).page).toBe(1);
  });

  it("blank filters count as not sent", () => {
    expect(
      checkActivityQuery({ by: "", group: " ", from: "", to: "", q: "  ", page: "" }),
    ).toEqual(checkActivityQuery({}));
  });

  it("keeps every filter that is sent, trimmed", () => {
    const admin = id();
    expect(
      checkActivityQuery({
        by: admin,
        group: "filing",
        from: "2026-11-16",
        to: "2026-11-16",
        q: " liza ",
        page: "3",
      }),
    ).toEqual({
      by: admin,
      group: "filing",
      from: new Date("2026-11-15T16:00:00.000Z"),
      to: new Date("2026-11-16T15:59:59.999Z"),
      q: "liza",
      page: 3,
    });
    expect(checkActivityQuery({ by: "me" }).by).toBe("me");
  });

  it("refuses a date not in YYYY-MM-DD form, and a start after the end", () => {
    expect(checkActivityQuery({ from: "16/11/2026" })).toEqual({
      error: MESSAGES.badDate,
    });
    expect(checkActivityQuery({ from: "2026-11-20", to: "2026-11-01" })).toEqual(
      { error: "The start date is after the end date." },
    );
  });

  it.each(["Me", "everyone", "123", "rhea", ["me", "me"]])(
    "refuses by=%p: not me and not an account id",
    (by) => {
      expect(checkActivityQuery({ by })).toEqual({
        error: "Not an Admin account.",
      });
    },
  );

  it("refuses a group that is not on the list, naming it", () => {
    expect(checkActivityQuery({ group: "payroll" })).toEqual({
      error: "Not a kind of action: payroll.",
    });
    expect(checkActivityQuery({ group: "Employees" })).toEqual({
      error: "Not a kind of action: Employees.",
    });
  });

  it("refuses in this order: the dates, the person, the group", () => {
    expect(
      checkActivityQuery({ from: "bad", by: "nobody", group: "nothing" }).error,
    ).toBe(MESSAGES.badDate);
    expect(checkActivityQuery({ by: "nobody", group: "nothing" }).error).toBe(
      MESSAGES.notAdmin,
    );
  });

  it.each([undefined, "", "0", "-1", "abc", "1.5", "2x", ["2"], "99999999999"])(
    "a missing or bad page (%p) reads as 1",
    (page) => {
      expect(pageNumber(page)).toBe(1);
    },
  );

  it("a good page is kept", () => {
    expect(pageNumber("1")).toBe(1);
    expect(pageNumber("2")).toBe(2);
    expect(pageNumber("120")).toBe(120);
  });

  it("there are 50 entries a page", () => {
    expect(PAGE_SIZE).toBe(50);
  });
});

describe("activityFilter", () => {
  const me = id();

  it("no filters: every entry", () => {
    expect(activityFilter(checkActivityQuery({}), me)).toEqual({});
  });

  it("by=me is the caller; an id is that account", () => {
    const admin = id();
    expect(activityFilter({ by: "me" }, me)).toEqual({ actorId: me });
    expect(activityFilter({ by: admin }, me)).toEqual({ actorId: admin });
  });

  it("combines the person, the group, the days and the search", () => {
    const checked = checkActivityQuery({
      by: "me",
      group: "employees",
      from: "2026-11-16",
      to: "2026-11-16",
      q: "liza",
    });
    expect(activityFilter(checked, me)).toEqual({
      actorId: me,
      group: "employees",
      at: {
        $gte: new Date("2026-11-15T16:00:00.000Z"),
        $lte: new Date("2026-11-16T15:59:59.999Z"),
      },
      targetName: { $regex: "liza", $options: "i" },
    });
  });

  it("an open end gives one bound only", () => {
    expect(
      activityFilter(checkActivityQuery({ from: "2026-11-16" }), me).at,
    ).toEqual({ $gte: new Date("2026-11-15T16:00:00.000Z") });
    expect(activityFilter(checkActivityQuery({ to: "2026-11-16" }), me).at).toEqual(
      { $lte: new Date("2026-11-16T15:59:59.999Z") },
    );
  });

  it("the search is plain text: its special characters match themselves", () => {
    expect(activityFilter({ q: "(AC-008)" }, me).targetName).toEqual({
      $regex: "\\(AC-008\\)",
      $options: "i",
    });
    expect(activityFilter({ q: ".*" }, me).targetName.$regex).toBe("\\.\\*");
  });
});

describe("toReplyEntry", () => {
  const me = new mongoose.Types.ObjectId();
  const rhea = new mongoose.Types.ObjectId();
  const entry = (extra = {}) => ({
    _id: new mongoose.Types.ObjectId(),
    at: new Date("2026-11-16T01:00:00Z"),
    actorId: me,
    actorName: "admin",
    action: "employee.edit",
    group: "employees",
    targetId: new mongoose.Types.ObjectId(),
    targetName: "Angelica Ramos (AC-008)",
    changed: ["basic pay"],
    note: "",
    ...extra,
  });

  it("gives id, at, by, action, label, group, targetName, changed and note only", () => {
    const stored = entry();
    expect(toReplyEntry(stored, String(me))).toEqual({
      id: String(stored._id),
      at: stored.at,
      by: { id: String(me), name: "admin", you: true },
      action: "employee.edit",
      label: "Edited employee",
      group: "employees",
      targetName: "Angelica Ramos (AC-008)",
      changed: ["basic pay"],
      note: "",
    });
  });

  it("marks the caller's own entries with you: true, and anyone else's with false", () => {
    expect(toReplyEntry(entry(), me).by.you).toBe(true);
    const theirs = toReplyEntry(entry({ actorId: rhea, actorName: "Rhea Cruz" }), me);
    expect(theirs.by).toEqual({ id: String(rhea), name: "Rhea Cruz", you: false });
  });

  it("never carries a role, even when one is on the record it is given", () => {
    const reply = toReplyEntry(entry({ role: "Super Admin", actorRole: "Admin" }), me);
    expect(JSON.stringify(reply)).not.toContain("Super Admin");
    expect(JSON.stringify(reply).toLowerCase()).not.toContain("role");
  });

  it("gives each action its label", () => {
    for (const [action, { label, group }] of Object.entries(ACTIONS)) {
      expect(toReplyEntry(entry({ action, group }), me).label).toBe(label);
    }
  });

  it("fills in blanks for an entry with missing fields", () => {
    const reply = toReplyEntry(
      entry({ actorName: undefined, targetName: undefined, changed: undefined, note: undefined }),
      me,
    );
    expect(reply.by.name).toBe("");
    expect(reply.targetName).toBe("");
    expect(reply.changed).toEqual([]);
    expect(reply.note).toBe("");
  });
});
