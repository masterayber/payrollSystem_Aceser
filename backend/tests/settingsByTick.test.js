// The rules behind PR D2's screens (frontend/src/utils/pageAccess.js and
// frontend/src/components/Profile/profileForm.js): which Settings tabs each admin
// sees, the fallback to General, who gets Delete Employee and the Page Access card,
// and the Admin account's own General form (names, Save body, yellow messages). The
// route behind the Admin's Save is proved in adminGeneralSettings.test.js; the tick
// names are checked against the page list the server really sends (config/pages.js).
// Friday batch, Group 4: the requests an admin screen sends on load only with their
// tick (canLoad), and the buttons hidden on an Admin's own linked employee
// (isOwnLinkedEmployee), each checked against the server's own rule function. The
// routes' guards themselves are proved in adminPageAccess.test.js.
import {
  ADMIN_FILING,
  ADMIN_LOAD_REQUESTS,
  EMPLOYEE_ACCESS,
  EMPLOYEES_PAGE,
  GENERAL_TAB,
  OWN_RECORD_NOTE,
  SETTINGS_COMPANY,
  SETTINGS_MANAGE,
  adminSettingsTabs,
  canDeleteEmployee,
  canLoad,
  canManageEmployeeAccess,
  hasAnyLogisticsTick,
  isLogisticsKey,
  isOwnLinkedEmployee,
  visibleSettingsTab,
} from "../../frontend/src/utils/pageAccess";
import {
  ACCOUNT_FORM_MESSAGES,
  checkAccountForm,
  hasEmployeeRecord,
  isAccountOnly,
  toAccountPayload,
  toProfileForm,
  toProfilePayload,
} from "../../frontend/src/components/Profile/profileForm";

const { PAGES, LOGISTICS_PAGE_KEYS, isLogisticsPage } = require("../config/pages");
const {
  getAllowedPages,
  canUseAdminPage,
  hasLogisticsAdminPower,
} = require("../utils/pageAccess");
const {
  isOwnLinkedEmployee: serverIsOwnLinkedEmployee,
} = require("../utils/linkedEmployee");

const MAIN = { role: "Super Admin", allowedPages: [] };
const admin = (allowedPages) => ({ role: "Admin", allowedPages });
const EMPLOYEE = { role: "Employee", allowedPages: ["dashboard"] };

const names = (tabs) => tabs.map((tab) => tab.name);

const EMPTY_TABS = [
  "Employees",
  "Payroll & Benefits",
  "Attendance",
  "System Log",
];

describe("the tick names", () => {
  test("are keys the server sends", () => {
    const keys = PAGES.map((page) => page.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        SETTINGS_COMPANY,
        SETTINGS_MANAGE,
        EMPLOYEE_ACCESS,
      ]),
    );
  });
});

describe("Settings tabs (rules 1 to 3)", () => {
  test("rule 1: the main account sees every tab with content, in order", () => {
    expect(names(adminSettingsTabs(MAIN))).toEqual([
      "General",
      "Company",
      "Manage",
      "Accessibility",
      "Security & Privacy",
      "Admins",
      "About",
    ]);
  });

  test("rule 1: the main account's tabs do not depend on allowedPages", () => {
    expect(adminSettingsTabs({ role: "Super Admin" })).toEqual(
      adminSettingsTabs(MAIN),
    );
  });

  test("rule 2: an Admin with no Settings ticks sees General, Accessibility, About", () => {
    expect(
      names(adminSettingsTabs(admin(["admin-dashboard", "employees"]))),
    ).toEqual(["General", "Accessibility", "About"]);
  });

  test("rule 2: Company only with settings-company", () => {
    expect(names(adminSettingsTabs(admin([SETTINGS_COMPANY])))).toEqual([
      "General",
      "Company",
      "Accessibility",
      "About",
    ]);
  });

  test("rule 2: Manage only with settings-manage", () => {
    expect(names(adminSettingsTabs(admin([SETTINGS_MANAGE])))).toEqual([
      "General",
      "Manage",
      "Accessibility",
      "About",
    ]);
  });

  test("rule 2: both ticks give both tabs, in order", () => {
    expect(
      names(adminSettingsTabs(admin([SETTINGS_MANAGE, SETTINGS_COMPANY]))),
    ).toEqual(["General", "Company", "Manage", "Accessibility", "About"]);
  });

  test("rule 2: an Admin never sees Security & Privacy or Admins, whatever its ticks", () => {
    const every = PAGES.map((page) => page.key);
    const shown = names(adminSettingsTabs(admin(every)));
    expect(shown).not.toContain("Security & Privacy");
    expect(shown).not.toContain("Admins");
  });

  test("rule 2: no account sees the four empty tabs", () => {
    const every = PAGES.map((page) => page.key);
    for (const user of [MAIN, admin(every), admin([])]) {
      const shown = names(adminSettingsTabs(user));
      for (const tab of EMPTY_TABS) expect(shown).not.toContain(tab);
    }
  });

  test("rule 3: an Admin whose allowedPages is missing sees only the tabs without a tick", () => {
    expect(names(adminSettingsTabs({ role: "Admin" }))).toEqual([
      "General",
      "Accessibility",
      "About",
    ]);
    expect(
      names(adminSettingsTabs({ role: "Admin", allowedPages: null })),
    ).toEqual(["General", "Accessibility", "About"]);
  });

  test("each tab carries only its name and key", () => {
    for (const tab of adminSettingsTabs(MAIN)) {
      expect(Object.keys(tab).sort()).toEqual(["key", "name"]);
    }
  });

  test("no tab name says Super Admin", () => {
    const every = PAGES.map((page) => page.key);
    for (const user of [MAIN, admin(every)]) {
      for (const tab of adminSettingsTabs(user)) {
        expect(tab.name).not.toMatch(/super/i);
      }
    }
  });
});

describe("the selected tab (rule 4)", () => {
  const tabs = adminSettingsTabs(admin([SETTINGS_COMPANY]));

  test("a selected tab in the list stays selected", () => {
    expect(visibleSettingsTab(tabs, "company")).toBe("company");
    expect(visibleSettingsTab(tabs, "about")).toBe("about");
  });

  test("a selected tab not in the list gives General", () => {
    expect(visibleSettingsTab(tabs, "manage")).toBe(GENERAL_TAB);
    expect(visibleSettingsTab(tabs, "admins")).toBe(GENERAL_TAB);
    expect(visibleSettingsTab(tabs, "employees")).toBe(GENERAL_TAB);
    expect(visibleSettingsTab(tabs, undefined)).toBe(GENERAL_TAB);
    expect(visibleSettingsTab(undefined, "company")).toBe(GENERAL_TAB);
    expect(GENERAL_TAB).toBe("general");
  });

  test("a tick taken away drops its tab back to General", () => {
    const before = adminSettingsTabs(admin([SETTINGS_MANAGE]));
    const after = adminSettingsTabs(admin([]));
    expect(visibleSettingsTab(before, "manage")).toBe("manage");
    expect(visibleSettingsTab(after, "manage")).toBe(GENERAL_TAB);
  });
});

describe("profile buttons (rule 5)", () => {
  test("canDeleteEmployee is true only for the main account", () => {
    const every = PAGES.map((page) => page.key);
    expect(canDeleteEmployee(MAIN)).toBe(true);
    expect(canDeleteEmployee(admin(every))).toBe(false);
    expect(canDeleteEmployee(admin(undefined))).toBe(false);
    expect(canDeleteEmployee(EMPLOYEE)).toBe(false);
    expect(canDeleteEmployee(null)).toBe(false);
  });

  test("canManageEmployeeAccess: the main account, or an Admin with employee-access", () => {
    expect(canManageEmployeeAccess(MAIN)).toBe(true);
    expect(canManageEmployeeAccess(admin([EMPLOYEE_ACCESS]))).toBe(true);
    expect(canManageEmployeeAccess(admin(["employees"]))).toBe(false);
    expect(canManageEmployeeAccess(admin(undefined))).toBe(false);
    expect(canManageEmployeeAccess(null)).toBe(false);
  });
});

describe("toProfileForm names (rule 6)", () => {
  test("the employee record's names come first", () => {
    const form = toProfileForm({
      firstName: "Account",
      lastName: "Name",
      employee: { firstName: "Ana", lastName: "Reyes" },
    });
    expect(form.firstName).toBe("Ana");
    expect(form.lastName).toBe("Reyes");
  });

  test("an account with no employee record takes the account's names", () => {
    for (const employee of [null, undefined, {}]) {
      const form = toProfileForm({
        role: "Admin",
        firstName: "Rhea",
        lastName: "Cruz",
        email: "rhea@aceser.com",
        employee,
      });
      expect(form.firstName).toBe("Rhea");
      expect(form.lastName).toBe("Cruz");
      expect(form.email).toBe("rhea@aceser.com");
    }
  });

  test("one blank part on the employee falls back on its own", () => {
    const form = toProfileForm({
      firstName: "Rhea",
      lastName: "Cruz",
      employee: { firstName: "Ana", lastName: "" },
    });
    expect(form).toMatchObject({ firstName: "Ana", lastName: "Cruz" });
  });

  test("never 'undefined' or 'null' when no name is anywhere", () => {
    for (const user of [
      null,
      {},
      { employee: null },
      { firstName: undefined, lastName: null, employee: {} },
      { firstName: 7, lastName: {}, employee: { firstName: null } },
    ]) {
      const form = toProfileForm(user);
      expect(form.firstName).toBe("");
      expect(form.lastName).toBe("");
      expect(form.email).toBe("");
    }
  });
});

describe("the Admin account's Save (rule 7)", () => {
  const RECORD = { _id: "x", firstName: "A" };

  test("isAccountOnly is true for an Admin with no employee record", () => {
    expect(isAccountOnly({ role: "Admin", employee: null })).toBe(true);
    expect(isAccountOnly({ role: "Admin", employee: {} })).toBe(true);
    expect(isAccountOnly({ role: "Admin" })).toBe(true);
    expect(isAccountOnly({ role: "Admin", employee: undefined })).toBe(true);
  });

  test("isAccountOnly: a record without an _id, or not an object, is no record", () => {
    expect(isAccountOnly({ role: "Admin", employee: { firstName: "A" } })).toBe(
      true,
    );
    expect(isAccountOnly({ role: "Admin", employee: "x" })).toBe(true);
    expect(isAccountOnly({ role: "Admin", employee: 7 })).toBe(true);
    expect(hasEmployeeRecord({ employee: {} })).toBe(false);
    expect(hasEmployeeRecord({ employee: null })).toBe(false);
    expect(hasEmployeeRecord(null)).toBe(false);
    expect(hasEmployeeRecord({ employee: RECORD })).toBe(true);
  });

  test("isAccountOnly is false for an older Admin that has an employee record", () => {
    expect(isAccountOnly({ role: "Admin", employee: RECORD })).toBe(false);
  });

  test("isAccountOnly is false for the main account and an Employee, record or not", () => {
    for (const role of ["Super Admin", "Employee"]) {
      expect(isAccountOnly({ role, employee: null })).toBe(false);
      expect(isAccountOnly({ role, employee: {} })).toBe(false);
      expect(isAccountOnly({ role })).toBe(false);
      expect(isAccountOnly({ role, employee: RECORD })).toBe(false);
    }
    expect(isAccountOnly(null)).toBe(false);
  });

  test("an older Admin's Save reply keeps it on the full form", () => {
    // GeneralSettings merges `employee` from the reply for the full form; the
    // reply's record has an _id, so the mode does not flip after a save
    const before = { role: "Admin", employee: RECORD };
    const after = { ...before, employee: { ...RECORD, firstName: "B" } };
    expect(isAccountOnly(before)).toBe(false);
    expect(isAccountOnly(after)).toBe(false);
  });

  test("an account-only Admin's Save keeps it account-only", () => {
    // The account-only branch merges only email and the names, never `employee`
    const before = { role: "Admin", employee: null };
    const after = {
      ...before,
      email: "rhea@aceser.com",
      firstName: "Rhea",
      lastName: "Cruz",
    };
    expect(isAccountOnly(after)).toBe(true);
  });

  test("the body is exactly email, firstName and lastName, trimmed", () => {
    const form = {
      ...toProfileForm({
        role: "Admin",
        firstName: "Rhea",
        lastName: "Cruz",
        email: "rhea@aceser.com",
      }),
      firstName: "  Rhea ",
      lastName: " Cruz-Santos  ",
      email: " rhea@aceser.com ",
      employee: { firstName: "x" },
      role: "Super Admin",
      pages: ["settings-company"],
      payAccess: ["all"],
      linkedEmployeeId: "64b000000000000000000001",
      username: "rhea",
    };
    const body = toAccountPayload(form);
    expect(body).toEqual({
      email: "rhea@aceser.com",
      firstName: "Rhea",
      lastName: "Cruz-Santos",
    });
    expect(Object.keys(body).sort()).toEqual([
      "email",
      "firstName",
      "lastName",
    ]);
  });

  test("missing or non-text values are sent as blank text, never undefined", () => {
    expect(toAccountPayload({ firstName: 3 })).toEqual({
      email: "",
      firstName: "",
      lastName: "",
    });
    expect(toAccountPayload(undefined)).toEqual({
      email: "",
      firstName: "",
      lastName: "",
    });
  });

  test("the employee Save body is unchanged (it still carries the employee record)", () => {
    const body = toProfilePayload(
      toProfileForm({ email: "e@aceser.com", employee: { firstName: "Ana" } }),
    );
    expect(Object.keys(body).sort()).toEqual(["email", "employee"]);
    expect(body.employee.firstName).toBe("Ana");
  });
});

describe("the Admin account's form check (rule 8)", () => {
  const good = {
    firstName: "Rhea",
    lastName: "Cruz",
    email: "rhea@aceser.com",
  };

  test("the two yellow messages are the agreed words", () => {
    expect(ACCOUNT_FORM_MESSAGES).toEqual({
      required: "First name, last name and email are required.",
      email: "Enter a valid email address.",
    });
  });

  test("a blank first name, last name or email gives the required message", () => {
    for (const key of ["firstName", "lastName", "email"]) {
      for (const blank of ["", "   ", undefined, null]) {
        expect(checkAccountForm({ ...good, [key]: blank })).toBe(
          "First name, last name and email are required.",
        );
      }
    }
  });

  test("a bad email shape gives the email message", () => {
    for (const email of [
      "rhea@",
      "rhea",
      "rhea@aceser",
      "rh ea@aceser.com",
      "@aceser.com",
    ]) {
      expect(checkAccountForm({ ...good, email })).toBe(
        "Enter a valid email address.",
      );
    }
  });

  test("a good form gives no message, spaces around the values included", () => {
    expect(checkAccountForm(good)).toBe("");
    expect(
      checkAccountForm({
        firstName: " Rhea ",
        lastName: " Cruz ",
        email: " rhea@aceser.com ",
      }),
    ).toBe("");
  });

  test("the form needs no username (the Admin never edits it here)", () => {
    expect(checkAccountForm({ ...good, username: "" })).toBe("");
  });
});

// ---- Friday batch, Group 4 ----

// The screen's userData for a stored account: allowedPages as login and /me send it
const signedIn = (account) => ({
  ...account,
  allowedPages: getAllowedPages(account),
});

const ADMIN_KEYS = PAGES.filter((page) => page.role === "Admin").map(
  (page) => page.key,
);

// Stored Admin accounts with only some ticks (pageAccess as the database holds it)
const STORED_ADMINS = [
  { role: "Admin" },
  { role: "Admin", pageAccess: [] },
  { role: "Admin", pageAccess: ["admin-dashboard", "admin-settings"] },
  { role: "Admin", pageAccess: ["employees"] },
  { role: "Admin", pageAccess: ["employees", "admin-attendance"] },
  { role: "Admin", pageAccess: ["admin-filing"] },
  { role: "Admin", pageAccess: ["employee-access"] },
  { role: "Admin", pageAccess: ["logistics-dashboard"] },
  { role: "Admin", pageAccess: ["logistics-setup"] },
  { role: "Admin", pageAccess: ["employees", "logistics-deliveries"] },
  {
    role: "Admin",
    pageAccess: ["employees", "admin-attendance", "admin-calendar", "admin-filing"],
  },
  { role: "Admin", pageAccess: ADMIN_KEYS },
  { role: "Super Admin" },
  { role: "Super Admin", pageAccess: [] },
];

// The server's guard for each request the screens send on load
const SERVER_GUARD = {
  pendingUsers: (user) => canUseAdminPage(user, "employees"),
  leaveCredits: (user) => canUseAdminPage(user, "admin-filing"),
  logisticsProjects: (user) => hasLogisticsAdminPower(user),
  pageAccess: (user) => canUseAdminPage(user, "employee-access"),
};

describe("requests sent on load only with their tick (Group 4)", () => {
  test("the four requests, by name", () => {
    expect([...ADMIN_LOAD_REQUESTS].sort()).toEqual([
      "leaveCredits",
      "logisticsProjects",
      "pageAccess",
      "pendingUsers",
    ]);
  });

  test("the tick names are Admin keys the server sends", () => {
    for (const key of [EMPLOYEES_PAGE, ADMIN_FILING, EMPLOYEE_ACCESS]) {
      expect(ADMIN_KEYS).toContain(key);
    }
  });

  test("isLogisticsKey matches the server's isLogisticsPage on every key", () => {
    for (const key of [...PAGES.map((page) => page.key), "logistics", "", null, 7]) {
      expect(isLogisticsKey(key)).toBe(isLogisticsPage(key));
    }
    for (const key of LOGISTICS_PAGE_KEYS) expect(isLogisticsKey(key)).toBe(true);
  });

  test("each request is asked exactly when the server's guard lets it through", () => {
    for (const account of STORED_ADMINS) {
      const userData = signedIn(account);
      for (const request of ADMIN_LOAD_REQUESTS) {
        expect({ account, request, ask: canLoad(userData, request) }).toEqual({
          account,
          request,
          ask: SERVER_GUARD[request](account),
        });
      }
    }
  });

  test("an Admin without Logistics ticks does not ask for Logistics projects", () => {
    expect(canLoad(admin(["employees", "admin-filing"]), "logisticsProjects")).toBe(
      false,
    );
    expect(hasAnyLogisticsTick(admin(["employees"]))).toBe(false);
    expect(hasAnyLogisticsTick(admin(["logistics-inventory"]))).toBe(true);
    expect(hasAnyLogisticsTick(admin(["logistics-setup"]))).toBe(true);
    expect(hasAnyLogisticsTick(MAIN)).toBe(true);
  });

  test("an Admin without the Employees tick does not ask for pending sign-ups", () => {
    expect(canLoad(admin(["admin-attendance"]), "pendingUsers")).toBe(false);
    expect(canLoad(admin(["employees"]), "pendingUsers")).toBe(true);
    expect(canLoad(MAIN, "pendingUsers")).toBe(true);
  });

  test("Leave Credits on a profile only with the Filing tick", () => {
    expect(canLoad(admin(["employees"]), "leaveCredits")).toBe(false);
    expect(canLoad(admin(["employees", "admin-filing"]), "leaveCredits")).toBe(true);
  });

  test("the Page Access read follows canManageEmployeeAccess", () => {
    for (const account of STORED_ADMINS) {
      const userData = signedIn(account);
      expect(canLoad(userData, "pageAccess")).toBe(
        canManageEmployeeAccess(userData),
      );
    }
  });

  test("an unloaded allowedPages asks for nothing (the Super Admin still asks)", () => {
    for (const userData of [
      { role: "Admin" },
      { role: "Admin", allowedPages: null },
      null,
      undefined,
    ]) {
      for (const request of ADMIN_LOAD_REQUESTS) {
        expect(canLoad(userData, request)).toBe(false);
      }
    }
    for (const request of ADMIN_LOAD_REQUESTS) {
      expect(canLoad({ role: "Super Admin" }, request)).toBe(true);
    }
  });

  test("an unknown request name is never asked", () => {
    for (const name of ["", "toString", "constructor", "attendance", undefined]) {
      expect(canLoad(MAIN, name)).toBe(false);
    }
  });
});

describe("an Admin's own linked employee (Group 4)", () => {
  const OWN = "64b000000000000000000001";
  const OTHER = "64b000000000000000000002";

  test("the line under the profile header is the agreed words", () => {
    expect(OWN_RECORD_NOTE).toBe(
      "This is your own record. Another Admin makes changes to it.",
    );
  });

  test("true only for an Admin on its own linked employee", () => {
    const linked = { role: "Admin", linkedEmployeeId: OWN, allowedPages: [] };
    expect(isOwnLinkedEmployee(linked, OWN)).toBe(true);
    expect(isOwnLinkedEmployee(linked, OTHER)).toBe(false);
    expect(isOwnLinkedEmployee({ role: "Admin" }, OWN)).toBe(false);
    expect(isOwnLinkedEmployee({ ...linked, linkedEmployeeId: null }, OWN)).toBe(
      false,
    );
    expect(isOwnLinkedEmployee(linked, undefined)).toBe(false);
    expect(isOwnLinkedEmployee(null, OWN)).toBe(false);
  });

  test("never for the Super Admin or an Employee, even with a stored link", () => {
    for (const role of ["Super Admin", "Employee"]) {
      expect(isOwnLinkedEmployee({ role, linkedEmployeeId: OWN }, OWN)).toBe(false);
    }
  });

  test("an id sent as text matches the same id as an object (JSON vs ObjectId)", () => {
    const asObject = { toString: () => OWN };
    expect(isOwnLinkedEmployee({ role: "Admin", linkedEmployeeId: OWN }, asObject)).toBe(
      true,
    );
  });

  test("agrees with the server's rule (utils/linkedEmployee.js) on every case", () => {
    const users = [
      { role: "Admin", linkedEmployeeId: OWN },
      { role: "Admin", linkedEmployeeId: OTHER },
      { role: "Admin" },
      { role: "Admin", linkedEmployeeId: null },
      { role: "Super Admin", linkedEmployeeId: OWN },
      { role: "Employee", linkedEmployeeId: OWN },
      null,
    ];
    for (const user of users) {
      for (const target of [OWN, OTHER, null, undefined]) {
        expect(isOwnLinkedEmployee(user, target)).toBe(
          serverIsOwnLinkedEmployee(user, target),
        );
      }
    }
  });
});
