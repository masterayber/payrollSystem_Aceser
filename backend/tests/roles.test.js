const {
  SUPER_ADMIN,
  ADMIN,
  ROLES,
  ADMIN_ROLES,
  isAdminRole,
  isSuperAdmin,
  isPlainAdmin,
  pageRole,
  roleLabel,
} = require("../config/roles");
const {
  PAGES,
  pagesForRole,
  ADMIN_DEFAULT_PAGE_KEYS,
} = require("../config/pages");
const {
  getAllowedPages,
  canUseAdminPage,
  hasLogisticsAdminPower,
  normalizePageAccess,
} = require("../utils/pageAccess");

const adminPageKeys = () => pagesForRole("Admin").map((page) => page.key);

describe("role names", () => {
  it("has the three roles, two of them admin roles", () => {
    expect(SUPER_ADMIN).toBe("Super Admin");
    expect(ADMIN).toBe("Admin");
    expect(ROLES).toEqual(["Super Admin", "Admin", "Employee"]);
    expect(ADMIN_ROLES).toEqual(["Super Admin", "Admin"]);
  });
});

describe("isAdminRole", () => {
  it("is true for both admin roles", () => {
    expect(isAdminRole("Super Admin")).toBe(true);
    expect(isAdminRole("Admin")).toBe(true);
  });

  it("is false for an employee, a missing role and near spellings", () => {
    expect(isAdminRole("Employee")).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole("admin")).toBe(false);
    expect(isAdminRole("SuperAdmin")).toBe(false);
  });
});

describe("isSuperAdmin", () => {
  it("is true only for the Super Admin role", () => {
    expect(isSuperAdmin("Super Admin")).toBe(true);
    expect(isSuperAdmin("Admin")).toBe(false);
    expect(isSuperAdmin("Employee")).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });
});

describe("isPlainAdmin", () => {
  it("is true only for an Admin account, not the Super Admin", () => {
    expect(isPlainAdmin("Admin")).toBe(true);
    expect(isPlainAdmin("Super Admin")).toBe(false);
    expect(isPlainAdmin("Employee")).toBe(false);
    expect(isPlainAdmin(undefined)).toBe(false);
  });
});

describe("pageRole", () => {
  it("gives both admin roles the Admin pages", () => {
    expect(pageRole("Super Admin")).toBe("Admin");
    expect(pageRole("Admin")).toBe("Admin");
  });

  it("keeps any other role as it is", () => {
    expect(pageRole("Employee")).toBe("Employee");
    expect(pageRole(undefined)).toBeUndefined();
  });
});

describe("roleLabel", () => {
  it("shows both admin roles as Admin", () => {
    expect(roleLabel("Super Admin")).toBe("Admin");
    expect(roleLabel("Admin")).toBe("Admin");
    expect(roleLabel("Employee")).toBe("Employee");
  });

  it("never returns Super Admin", () => {
    for (const role of [...ROLES, undefined, null, ""]) {
      expect(roleLabel(role)).not.toBe("Super Admin");
    }
  });
});

describe("pages for the Super Admin", () => {
  it("lists the Admin pages for a Super Admin", () => {
    expect(pagesForRole("Super Admin")).toEqual(pagesForRole("Admin"));
    expect(pagesForRole("Super Admin").length).toBeGreaterThan(0);
  });

  it("allows every admin page, whatever page access is stored", () => {
    expect(getAllowedPages({ role: "Super Admin" })).toEqual(adminPageKeys());
    expect(
      getAllowedPages({ role: "Super Admin", pageAccess: ["dashboard"] }),
    ).toEqual(adminPageKeys());
    expect(getAllowedPages({ role: "Super Admin" })).toContain(
      "logistics-setup",
    );
  });

  it("gives a Super Admin no employee pages", () => {
    const allowed = getAllowedPages({ role: "Super Admin" });
    expect(allowed).not.toContain("dashboard");
    expect(allowed).not.toContain("payroll");
  });
});

describe("normalizePageAccess", () => {
  it("keeps the ticked pages in config order and adds the locked ones", () => {
    expect(
      normalizePageAccess("Employee", ["filing", "logistics-dashboard"]),
    ).toEqual(["dashboard", "logistics-dashboard", "filing", "settings"]);
  });

  it("drops keys that are not pages of the role", () => {
    expect(
      normalizePageAccess("Employee", ["payroll", "employees", "logistics-setup"]),
    ).toEqual(["dashboard", "payroll", "settings"]);
  });
});

// Rule 4: an Admin's pages are Dashboard and Settings (fixed) plus the admin keys stored
// in its pageAccess; nothing stored means only the fixed pages. Rule 3: the Super Admin
// can't be limited.
describe("pages for an Admin account", () => {
  it("has only Dashboard and Settings with nothing stored", () => {
    expect(getAllowedPages({ role: "Admin" })).toEqual([
      "admin-dashboard",
      "admin-settings",
    ]);
    expect(getAllowedPages({ role: "Admin", pageAccess: [] })).toEqual([
      "admin-dashboard",
      "admin-settings",
    ]);
  });

  it("adds the ticked admin keys and ignores employee or unknown keys", () => {
    expect(
      getAllowedPages({
        role: "Admin",
        pageAccess: ["reports", "employees", "payroll", "nope", "settings-manage"],
      }),
    ).toEqual([
      "admin-dashboard",
      "employees",
      "reports",
      "admin-settings",
      "settings-manage",
    ]);
  });

  it("can't lose Dashboard or Settings", () => {
    expect(getAllowedPages({ role: "Admin", pageAccess: ["reports"] })).toEqual(
      ["admin-dashboard", "reports", "admin-settings"],
    );
  });

  it("gives the Super Admin every admin page and action", () => {
    const all = getAllowedPages({ role: "Super Admin", pageAccess: [] });
    expect(all).toEqual(adminPageKeys());
    for (const key of ["employee-access", "settings-company", "settings-manage"]) {
      expect(all).toContain(key);
    }
  });
});

describe("admin page keys", () => {
  it("has the four action ticks as Admin keys", () => {
    const actions = pagesForRole("Admin").filter((page) => page.action);
    expect(actions.map((page) => page.key)).toEqual([
      "employee-access",
      "settings-company",
      "settings-manage",
      "thirteenth-month",
    ]);
  });

  it("has the 13th month tick as an Admin action, off for a new Admin", () => {
    expect(PAGES.find((page) => page.key === "thirteenth-month")).toEqual({
      key: "thirteenth-month",
      label: "13th month",
      role: "Admin",
      action: true,
    });
    expect(ADMIN_DEFAULT_PAGE_KEYS).not.toContain("thirteenth-month");
    expect(getAllowedPages({ role: "Super Admin" })).toContain("thirteenth-month");
    expect(
      getAllowedPages({ role: "Admin", pageAccess: ["thirteenth-month"] }),
    ).toContain("thirteenth-month");
    expect(canUseAdminPage({ role: "Admin", pageAccess: ["reports"] }, "thirteenth-month")).toBe(
      false,
    );
  });

  it("pre-ticks the HR set for a new Admin, with the fixed pages", () => {
    expect(ADMIN_DEFAULT_PAGE_KEYS).toEqual([
      "admin-dashboard",
      "employees",
      "admin-attendance",
      "admin-calendar",
      "admin-filing",
      "admin-settings",
    ]);
  });
});

describe("canUseAdminPage", () => {
  it("lets the Super Admin use every key, whatever is stored", () => {
    for (const key of adminPageKeys()) {
      expect(canUseAdminPage({ role: "Super Admin", pageAccess: [] }, key)).toBe(
        true,
      );
    }
  });

  it("lets an Admin use only its ticked and fixed keys", () => {
    const hr = { role: "Admin", pageAccess: ["employees"] };
    expect(canUseAdminPage(hr, "employees")).toBe(true);
    expect(canUseAdminPage(hr, "admin-dashboard")).toBe(true);
    expect(canUseAdminPage(hr, "reports")).toBe(false);
    expect(canUseAdminPage(hr, "employee-access")).toBe(false);
  });

  it("is false for an Employee, even one with the key stored, and for no user", () => {
    expect(
      canUseAdminPage({ role: "Employee", pageAccess: ["employees"] }, "employees"),
    ).toBe(false);
    expect(canUseAdminPage(null, "employees")).toBe(false);
  });
});

describe("hasLogisticsAdminPower", () => {
  it("is true for the Super Admin", () => {
    expect(hasLogisticsAdminPower({ role: "Super Admin" })).toBe(true);
  });

  it("is true for an Admin only with a Logistics page ticked", () => {
    expect(hasLogisticsAdminPower({ role: "Admin" })).toBe(false);
    expect(
      hasLogisticsAdminPower({ role: "Admin", pageAccess: ["employees"] }),
    ).toBe(false);
    expect(
      hasLogisticsAdminPower({
        role: "Admin",
        pageAccess: ["logistics-deliveries"],
      }),
    ).toBe(true);
  });

  it("is false for an Employee, whatever is ticked", () => {
    expect(
      hasLogisticsAdminPower({
        role: "Employee",
        pageAccess: ["logistics-dashboard"],
      }),
    ).toBe(false);
  });
});
