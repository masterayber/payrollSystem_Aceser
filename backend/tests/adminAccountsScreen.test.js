// The rules behind Settings > Admins (frontend/src/utils/adminAccounts.js): which ticks
// the form shows and pre-ticks, what the Add and Edit requests carry, the words in the
// list, the employee pickers, the form checks, and the name in the header. The routes
// themselves are proved in admins.test.js; these tests feed the helper the page list
// the server really sends (config/pages.js) and bodies the server really accepts
// (utils/adminAccounts.js checkAdminDetails).
import {
  ACTION_HINTS,
  FORM_MESSAGES,
  NOT_AVAILABLE,
  accountFirstName,
  accountName,
  addAdminBody,
  adminName,
  checkAdminForm,
  chosenText,
  defaultTicks,
  editAdminBody,
  formChanged,
  formFromAdmin,
  isDisabled,
  lastLoginText,
  newAdminForm,
  pageGroups,
  payListText,
  personName,
  pickerLabel,
  pickerRows,
  refusalText,
  searchRows,
  splitAdminPages,
  statusLabel,
  temporaryPasswordNote,
  tickLabel,
} from "../../frontend/src/utils/adminAccounts";

const { PAGES, ADMIN_DEFAULT_PAGE_KEYS } = require("../config/pages");
const { MESSAGES, checkAdminDetails } = require("../utils/adminAccounts");

const keys = (pages) => pages.map((page) => page.key);

const ANA = "64b000000000000000000001";
const BEN = "64b000000000000000000002";
const CARL = "64b000000000000000000003";

const EMPLOYEES = [
  {
    _id: ANA,
    firstName: "Ana",
    lastName: "Reyes",
    employeeId: "EMP-001",
    status: "Active",
    jobDescription: { department: "Finance" },
  },
  {
    _id: CARL,
    firstName: "Carl",
    lastName: "Santos",
    employeeId: "EMP-003",
    status: "Active",
    jobDescription: { department: "Operations" },
  },
  {
    _id: BEN,
    firstName: "Ben",
    lastName: "Cruz",
    employeeId: "EMP-002",
    status: "Resigned",
    jobDescription: { department: "Human Resources" },
  },
];

const RHEA = {
  id: "64a000000000000000000009",
  firstName: "Rhea",
  lastName: "Cruz",
  username: "rhea",
  email: "rhea@example.com",
  status: "Active",
  mustChangePassword: true,
  pages: ["admin-dashboard", "employees", "admin-settings", "employee-access"],
  payAccess: [
    { id: ANA, name: "Ana Reyes", employeeId: "EMP-001", status: "Active" },
    { id: BEN, name: "Ben Cruz", employeeId: "EMP-002", status: "Resigned" },
  ],
  linkedEmployee: { id: CARL, name: "Carl Santos" },
  lastLogin: null,
};

describe("the ticks (GET /api/access/pages)", () => {
  const { pages, actions } = splitAdminPages(PAGES);

  it("keeps only Admin-role pages", () => {
    const adminKeys = keys(PAGES.filter((page) => page.role === "Admin"));
    expect([...keys(pages), ...keys(actions)].sort()).toEqual(
      [...adminKeys].sort(),
    );
    // Employee-only keys are not offered
    for (const key of ["dashboard", "payroll", "payslips", "settings"]) {
      expect(keys(pages)).not.toContain(key);
      expect(keys(actions)).not.toContain(key);
    }
    expect(pages.every((page) => page.role === "Admin")).toBe(true);
    expect(actions.every((page) => page.role === "Admin")).toBe(true);
  });

  it("splits pages from actions, each in config order", () => {
    expect(keys(pages)).toEqual(
      keys(PAGES.filter((page) => page.role === "Admin" && !page.action)),
    );
    expect(keys(actions)).toEqual([
      "employee-access",
      "settings-company",
      "settings-manage",
      "thirteenth-month",
    ]);
    expect(pages.some((page) => page.action)).toBe(false);
  });

  it("shows the nine main pages, then the 11 Logistics pages under their own heading", () => {
    const groups = pageGroups(pages);
    expect(groups.map((group) => group.title)).toEqual(["", "Logistics"]);
    expect(groups[0].pages.map(tickLabel)).toEqual([
      "Dashboard",
      "Employees",
      "Deductions",
      "Pay Slips",
      "Attendance",
      "Calendar",
      "Filing",
      "Reports",
      "Settings",
    ]);
    expect(groups[1].pages).toHaveLength(11);
    expect(groups[1].pages.map(tickLabel)).toContain("Material Requests");
    expect(
      groups[1].pages.map(tickLabel).some((label) => /^Logistics:/.test(label)),
    ).toBe(false);
  });

  it("labels the actions as the server names them", () => {
    expect(actions.map(tickLabel)).toEqual([
      "Employee access",
      "Settings: Company",
      "Settings: Manage",
      "13th month",
    ]);
  });

  it("has a hint only for ticks that exist", () => {
    for (const key of Object.keys(ACTION_HINTS)) {
      expect(keys(actions)).toContain(key);
    }
    expect(ACTION_HINTS["employee-access"]).toBe("Needs the Employees page.");
    expect(ACTION_HINTS["thirteenth-month"]).toBe(
      "Needs Reports or Employees, and shows only people on the pay list.",
    );
  });

  it("gives nothing for a reply that is not a list", () => {
    expect(splitAdminPages(undefined)).toEqual({ pages: [], actions: [] });
    expect(defaultTicks(null)).toEqual([]);
  });
});

describe("a new form", () => {
  it("is ticked with the locked and adminDefault keys", () => {
    expect(defaultTicks(PAGES)).toEqual([
      "admin-dashboard",
      "employees",
      "admin-attendance",
      "admin-calendar",
      "admin-filing",
      "admin-settings",
    ]);
  });

  it("matches the server's own set for a new Admin", () => {
    expect([...defaultTicks(PAGES)].sort()).toEqual(
      [...ADMIN_DEFAULT_PAGE_KEYS].sort(),
    );
  });

  it("follows the marks, not a typed list", () => {
    const marks = [
      { key: "a", label: "A", role: "Admin", locked: true },
      { key: "b", label: "B", role: "Admin" },
      { key: "c", label: "C", role: "Admin", adminDefault: true },
      { key: "d", label: "D", role: "Employee", locked: true },
      { key: "e", label: "E", role: "Admin", action: true },
    ];
    expect(defaultTicks(marks)).toEqual(["a", "c"]);
  });

  it("has every action off, nobody on the pay list and no linked employee", () => {
    const form = newAdminForm(PAGES);
    const { actions } = splitAdminPages(PAGES);
    for (const action of actions) expect(form.pages).not.toContain(action.key);
    expect(form.payAccess).toEqual([]);
    expect(form.linkedEmployeeId).toBe("");
    expect(form).not.toHaveProperty("password");
  });
});

describe("the Add request body", () => {
  const form = {
    ...newAdminForm(PAGES),
    firstName: "  Rhea ",
    lastName: " Cruz",
    username: " rhea ",
    email: " rhea@example.com ",
    payAccess: [ANA, BEN],
  };
  const body = addAdminBody(form);

  it("carries the names, username, email, ticks, pay list and linked employee", () => {
    expect(body).toEqual({
      firstName: "Rhea",
      lastName: "Cruz",
      username: "rhea",
      email: "rhea@example.com",
      pages: defaultTicks(PAGES),
      payAccess: [ANA, BEN],
      linkedEmployeeId: null,
    });
  });

  it("has no password, role or status", () => {
    expect(body).not.toHaveProperty("password");
    expect(body).not.toHaveProperty("role");
    expect(body).not.toHaveProperty("status");
    expect(body).not.toHaveProperty("mustChangePassword");
  });

  it("always sends pages and payAccess, even when empty", () => {
    const empty = addAdminBody({ ...form, pages: [], payAccess: [] });
    expect(empty.pages).toEqual([]);
    expect(empty.payAccess).toEqual([]);
  });

  it("sends the linked employee's account id when one is picked", () => {
    expect(addAdminBody({ ...form, linkedEmployeeId: CARL }).linkedEmployeeId).toBe(
      CARL,
    );
  });

  it("is a body the server accepts", () => {
    const checked = checkAdminDetails(body, { creating: true });
    expect(checked.error).toBeUndefined();
    expect(checked.fields.username).toBe("rhea");
    expect(checked.employeeIds).toEqual([ANA, BEN]);
  });
});

describe("the Edit request body", () => {
  const form = formFromAdmin(RHEA);

  it("opens with the Admin's saved values", () => {
    expect(form).toEqual({
      firstName: "Rhea",
      lastName: "Cruz",
      username: "rhea",
      email: "rhea@example.com",
      linkedEmployeeId: CARL,
      pages: RHEA.pages,
      payAccess: [ANA, BEN],
    });
  });

  it("has no username or role", () => {
    const body = editAdminBody(form);
    expect(body).not.toHaveProperty("username");
    expect(body).not.toHaveProperty("role");
    expect(body).not.toHaveProperty("password");
    expect(body).not.toHaveProperty("status");
  });

  it("sends every editable field", () => {
    expect(editAdminBody({ ...form, email: " new@example.com " })).toEqual({
      firstName: "Rhea",
      lastName: "Cruz",
      email: "new@example.com",
      pages: RHEA.pages,
      payAccess: [ANA, BEN],
      linkedEmployeeId: CARL,
    });
  });

  it('sends linkedEmployeeId: null for "None"', () => {
    const body = editAdminBody({ ...form, linkedEmployeeId: "" });
    expect(body).toHaveProperty("linkedEmployeeId", null);
    expect(
      editAdminBody(formFromAdmin({ ...RHEA, linkedEmployee: null })),
    ).toHaveProperty("linkedEmployeeId", null);
  });

  it("is a body the server accepts, and one that takes the linked employee off", () => {
    const checked = checkAdminDetails(
      editAdminBody({ ...form, linkedEmployeeId: "" }),
      { creating: false },
    );
    expect(checked.error).toBeUndefined();
    expect(checked.fields.linkedEmployeeId).toBeNull();
    expect(checked.fields).not.toHaveProperty("username");
  });

  it("knows whether anything changed", () => {
    expect(formChanged(form, formFromAdmin(RHEA))).toBe(false);
    expect(formChanged({ ...form, firstName: "Rhea " }, form)).toBe(false);
    expect(formChanged({ ...form, payAccess: [BEN, ANA] }, form)).toBe(false);
    expect(formChanged({ ...form, firstName: "Rea" }, form)).toBe(true);
    expect(formChanged({ ...form, payAccess: [ANA] }, form)).toBe(true);
    expect(formChanged({ ...form, pages: [...form.pages, "reports"] }, form)).toBe(
      true,
    );
    expect(formChanged({ ...form, linkedEmployeeId: "" }, form)).toBe(true);
  });
});

describe("the list", () => {
  it('says "Disabled" for Inactive and "Active" for Active', () => {
    expect(statusLabel("Inactive")).toBe("Disabled");
    expect(statusLabel("Active")).toBe("Active");
    expect(isDisabled({ status: "Inactive" })).toBe(true);
    expect(isDisabled({ status: "Active" })).toBe(false);
  });

  it('says "None", "1 employee" or "n employees" for the pay list', () => {
    expect(payListText([])).toBe("None");
    expect(payListText(undefined)).toBe("None");
    expect(payListText([RHEA.payAccess[0]])).toBe("1 employee");
    expect(payListText(RHEA.payAccess)).toBe("2 employees");
    expect(payListText(new Array(12).fill({}))).toBe("12 employees");
  });

  it('says "Never" without a last login, the Manila date and time with one', () => {
    expect(lastLoginText(null)).toBe("Never");
    expect(lastLoginText(undefined)).toBe("Never");
    expect(lastLoginText("not a date")).toBe("Never");
    // 2026-11-11 18:05 UTC is 2026-11-12 02:05 in Manila
    const shown = lastLoginText("2026-11-11T18:05:00.000Z");
    expect(shown).toMatch(/^Nov 12, 2026, 2:05\sAM$/);
  });

  it("names an Admin by its name, or its username when it has none", () => {
    expect(adminName(RHEA)).toBe("Rhea Cruz");
    expect(adminName({ firstName: "", lastName: "", username: "rhea" })).toBe(
      "rhea",
    );
  });
});

describe("the employee pickers", () => {
  const rows = pickerRows(EMPLOYEES);
  const ids = (found) => found.map((row) => row.id);

  it("makes one row per person, with the account id the server wants", () => {
    expect(ids(rows)).toEqual([ANA, CARL, BEN]);
    expect(rows[0]).toEqual({
      id: ANA,
      name: "Ana Reyes",
      employeeId: "EMP-001",
      department: "Finance",
      resigned: false,
    });
  });

  it('labels a row "Name · Employee ID · Department"', () => {
    expect(pickerLabel(rows[0])).toBe("Ana Reyes · EMP-001 · Finance");
  });

  it('adds "(resigned)" to resigned people only', () => {
    expect(pickerLabel(rows[2])).toBe(
      "Ben Cruz · EMP-002 · Human Resources (resigned)",
    );
    expect(personName(rows[2])).toBe("Ben Cruz (resigned)");
    expect(pickerLabel(rows[0])).not.toMatch(/resigned/);
    expect(personName(rows[0])).toBe("Ana Reyes");
  });

  it("leaves a blank part out of the label", () => {
    const [row] = pickerRows([
      { _id: ANA, firstName: "Ana", lastName: "Reyes", status: "Active" },
    ]);
    expect(pickerLabel(row)).toBe("Ana Reyes");
    expect(pickerLabel(row)).not.toMatch(/undefined/);
  });

  it.each([
    ["ana", [ANA]],
    ["REYES", [ANA]],
    ["Ana Reyes", [ANA]],
    ["emp-002", [BEN]],
    ["EMP-00", [ANA, CARL, BEN]],
    ["finance", [ANA]],
    ["human RESOURCES", [BEN]],
    ["oPeRaTiOnS", [CARL]],
    ["  cruz  ", [BEN]],
    ["", [ANA, CARL, BEN]],
    ["   ", [ANA, CARL, BEN]],
    ["nobody here", []],
  ])("search %j finds by name, Employee ID or department in any case", (query, expected) => {
    expect(ids(searchRows(rows, query))).toEqual(expected);
  });

  it("writes the chosen people under the list, in list order", () => {
    expect(chosenText([BEN, ANA], rows)).toBe(
      "Chosen (2): Ana Reyes, Ben Cruz (resigned)",
    );
    expect(chosenText([], rows)).toBe("Chosen (0): nobody");
  });

  it("keeps a saved person who is missing from the employee list, with the saved name", () => {
    const withSaved = pickerRows([EMPLOYEES[0]], RHEA.payAccess);
    expect(ids(withSaved)).toEqual([ANA, BEN]);
    expect(withSaved[0].department).toBe("Finance");
    expect(pickerLabel(withSaved[1])).toBe("Ben Cruz · EMP-002 (resigned)");
    expect(chosenText([ANA, BEN], withSaved)).toBe(
      "Chosen (2): Ana Reyes, Ben Cruz (resigned)",
    );
  });

  it("gives no rows for a list that has not loaded", () => {
    expect(pickerRows(undefined)).toEqual([]);
  });
});

describe("the form checks", () => {
  const filled = {
    firstName: "Rhea",
    lastName: "Cruz",
    username: "rhea",
    email: "rhea@example.com",
  };

  it("passes a filled form", () => {
    expect(checkAdminForm(filled)).toBe("");
  });

  it.each(["firstName", "lastName", "username", "email"])(
    "refuses a blank %s with the server's own words",
    (key) => {
      expect(checkAdminForm({ ...filled, [key]: "" })).toBe(
        "First name, last name, username and email are required.",
      );
      expect(checkAdminForm({ ...filled, [key]: "   " })).toBe(
        FORM_MESSAGES.required,
      );
    },
  );

  it("uses the same required message as the server", () => {
    expect(FORM_MESSAGES.required).toBe(MESSAGES.required);
  });

  it.each(["rhea", "rhea@", "@example.com", "rhea@example", "rhea cruz@example.com"])(
    "refuses the email %j",
    (email) => {
      expect(checkAdminForm({ ...filled, email })).toBe(
        "Enter a valid email address.",
      );
    },
  );

  it("asks for the blanks before the email's shape", () => {
    expect(checkAdminForm({ ...filled, firstName: "", email: "bad" })).toBe(
      FORM_MESSAGES.required,
    );
  });
});

describe("messages", () => {
  const refusal = (message) => ({ response: { data: { message } } });

  it("shows the server's words as sent", () => {
    for (const message of [
      "Username is already taken.",
      "Email is already registered.",
      "Admin not found",
      "You do not have access to this page",
    ]) {
      expect(refusalText(refusal(message), "fallback")).toBe(message);
    }
  });

  it("hides the raw id of an employee that is no longer available", () => {
    const shown = refusalText(refusal(`Not an employee: ${ANA}`), "fallback");
    expect(shown).toBe(
      "A chosen employee is no longer available. Close this form and open it again.",
    );
    expect(shown).toBe(NOT_AVAILABLE);
    expect(shown).not.toContain(ANA);
  });

  it("falls back when the server sent no message", () => {
    expect(refusalText(new Error("Network Error"), "Could not save the Admin account.")).toBe(
      "Could not save the Admin account.",
    );
    expect(refusalText(refusal(""), "Could not update the Admin account.")).toBe(
      "Could not update the Admin account.",
    );
  });

  it("writes the temporary password note with the name and \"they\"", () => {
    expect(temporaryPasswordNote("Rhea Cruz")).toBe(
      "This is shown only once. Give it to Rhea Cruz yourself; they must change it when they first sign in.",
    );
  });

  it('never says "Super Admin"', () => {
    const texts = [
      ...Object.values(ACTION_HINTS),
      ...Object.values(FORM_MESSAGES),
      NOT_AVAILABLE,
      temporaryPasswordNote("Rhea Cruz"),
      statusLabel("Inactive"),
      payListText([]),
      ...[...splitAdminPages(PAGES).pages, ...splitAdminPages(PAGES).actions].map(
        tickLabel,
      ),
    ];
    for (const text of texts) expect(text).not.toMatch(/super\s*admin/i);
  });
});

describe("accountName (the header)", () => {
  const employee = { firstName: "Ana", lastName: "Reyes" };

  it("uses the employee's name first", () => {
    const userData = {
      username: "ana",
      firstName: "Auth",
      lastName: "Name",
      employee,
    };
    expect(accountName(userData)).toBe("Ana Reyes");
    expect(accountFirstName(userData)).toBe("Ana");
  });

  it("then the Auth record's first and last name (an Admin account: employee is null)", () => {
    const userData = {
      username: "rhea",
      firstName: "Rhea",
      lastName: "Cruz",
      role: "Admin",
      employee: null,
    };
    expect(accountName(userData)).toBe("Rhea Cruz");
    expect(accountFirstName(userData)).toBe("Rhea");
  });

  it("then the username", () => {
    const userData = { username: "admin", employee: null };
    expect(accountName(userData)).toBe("admin");
    expect(accountFirstName(userData)).toBe("admin");
    expect(accountName({ username: "admin", firstName: " ", lastName: "" })).toBe(
      "admin",
    );
  });

  it("keeps a first name of two words whole", () => {
    expect(
      accountFirstName({ employee: { firstName: "Mary Ann", lastName: "Lim" } }),
    ).toBe("Mary Ann");
  });

  it("uses whichever name there is when one is missing", () => {
    expect(accountName({ username: "x", employee: { firstName: "Ana" } })).toBe(
      "Ana",
    );
    expect(accountName({ username: "x", lastName: "Cruz" })).toBe("Cruz");
    expect(accountFirstName({ username: "x", lastName: "Cruz" })).toBe("Cruz");
  });

  it.each([
    [undefined],
    [null],
    [{}],
    [{ employee: null }],
    [{ employee: {} }],
    [{ employee: { firstName: undefined, lastName: undefined } }],
    [{ firstName: null, lastName: undefined, username: undefined }],
  ])('is never "undefined" (%j)', (userData) => {
    for (const name of [accountName(userData), accountFirstName(userData)]) {
      expect(name).toBe("");
      expect(name).not.toMatch(/undefined|null/);
    }
  });
});
