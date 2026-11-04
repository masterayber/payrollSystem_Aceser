const { getAllowedPages } = require("../utils/pageAccess");
const { LOGISTICS_PAGE_KEYS, isLogisticsPage } = require("../config/pages");

const EMPLOYEE_LOGISTICS_KEYS = LOGISTICS_PAGE_KEYS.filter(
  (key) => key !== "logistics-setup",
);

describe("getAllowedPages", () => {
  it("lists the eleven logistics keys", () => {
    expect(LOGISTICS_PAGE_KEYS).toEqual([
      "logistics-dashboard",
      "logistics-material-requests",
      "logistics-mr-approvals",
      "logistics-procurement",
      "logistics-purchase-orders",
      "logistics-po-approvals",
      "logistics-accounting",
      "logistics-deliveries",
      "logistics-inventory",
      "logistics-movements",
      "logistics-setup",
    ]);
    expect(isLogisticsPage("logistics-dashboard")).toBe(true);
    expect(isLogisticsPage("dashboard")).toBe(false);
    expect(isLogisticsPage("logistics")).toBe(false);
  });

  it("leaves every logistics page off for an employee by default", () => {
    const allowed = getAllowedPages({ role: "Employee" });
    for (const key of LOGISTICS_PAGE_KEYS) {
      expect(allowed).not.toContain(key);
    }
    expect(allowed).toContain("dashboard");
    expect(allowed).toContain("payroll");
  });

  it("includes a ticked logistics page and keeps the others off", () => {
    const allowed = getAllowedPages({
      role: "Employee",
      pageAccess: ["logistics-material-requests"],
    });
    expect(allowed).toContain("logistics-material-requests");
    for (const key of LOGISTICS_PAGE_KEYS) {
      if (key !== "logistics-material-requests") {
        expect(allowed).not.toContain(key);
      }
    }
  });

  it("lets an admin tick every employee logistics page", () => {
    const allowed = getAllowedPages({
      role: "Employee",
      pageAccess: EMPLOYEE_LOGISTICS_KEYS,
    });
    for (const key of EMPLOYEE_LOGISTICS_KEYS) {
      expect(allowed).toContain(key);
    }
  });

  it("always includes all eleven logistics pages for an admin", () => {
    const allowed = getAllowedPages({ role: "Admin" });
    for (const key of LOGISTICS_PAGE_KEYS) {
      expect(allowed).toContain(key);
    }
  });

  it("never grants logistics-setup to an employee, even when ticked", () => {
    const allowed = getAllowedPages({
      role: "Employee",
      pageAccess: ["logistics-setup", "logistics-dashboard"],
    });
    expect(allowed).not.toContain("logistics-setup");
    expect(allowed).toContain("logistics-dashboard");
  });

  it("grants nothing for the old logistics key", () => {
    const allowed = getAllowedPages({
      role: "Employee",
      pageAccess: ["logistics"],
    });
    expect(allowed).not.toContain("logistics");
    for (const key of LOGISTICS_PAGE_KEYS) {
      expect(allowed).not.toContain(key);
    }
  });
});
