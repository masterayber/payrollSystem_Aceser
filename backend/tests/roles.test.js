const {
  SUPER_ADMIN,
  ROLES,
  ADMIN_ROLES,
  isAdminRole,
  isSuperAdmin,
  pageRole,
  roleLabel,
} = require("../config/roles");
const { pagesForRole } = require("../config/pages");
const {
  getAllowedPages,
  normalizePageAccess,
} = require("../utils/pageAccess");

const adminPageKeys = () => pagesForRole("Admin").map((page) => page.key);

describe("role names", () => {
  it("has the three roles, two of them admin roles", () => {
    expect(SUPER_ADMIN).toBe("Super Admin");
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
