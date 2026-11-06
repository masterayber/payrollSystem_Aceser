const { pageRole } = require("./roles");

// Single source of truth for every page that can be granted or revoked.
//
// key        - matches the route path without the leading slash (e.g. "/payroll" -> "payroll")
// role       - the role whose sidebar the page belongs to
// locked     - always available to that role and cannot be revoked. Dashboards are the
//              landing pages, and admin-settings stops an admin from losing the screens
//              needed to repair access.
// defaultOff - hidden from employees until an admin grants it in Manage Access

// Logistics pages. Each key is a sub-page under /logistics/*, listed once for
// Employee (off until ticked in Manage Access) and once for Admin (a normal admin
// page), except Setup, which is Admin only. The labels carry the "Logistics:"
// prefix so Manage Access reads clearly; the sidebar uses its own names.
const LOGISTICS_PAGES = [
  { key: "logistics-dashboard", label: "Logistics: Dashboard" },
  { key: "logistics-material-requests", label: "Logistics: Material Requests" },
  { key: "logistics-mr-approvals", label: "Logistics: MR Approvals" },
  { key: "logistics-procurement", label: "Logistics: Procurement Queue" },
  { key: "logistics-purchase-orders", label: "Logistics: Purchase Orders" },
  { key: "logistics-po-approvals", label: "Logistics: PO Approvals" },
  { key: "logistics-accounting", label: "Logistics: Accounting" },
  { key: "logistics-deliveries", label: "Logistics: Deliveries" },
  { key: "logistics-inventory", label: "Logistics: Project Inventory" },
  { key: "logistics-movements", label: "Logistics: Withdrawals and Transfers" },
  { key: "logistics-setup", label: "Logistics: Setup", adminOnly: true },
];

const LOGISTICS_PAGE_KEYS = LOGISTICS_PAGES.map((page) => page.key);

const isLogisticsPage = (key) =>
  typeof key === "string" && key.startsWith("logistics-");

const employeeLogisticsPages = LOGISTICS_PAGES.filter(
  (page) => !page.adminOnly,
).map(({ key, label }) => ({ key, label, role: "Employee", defaultOff: true }));

const adminLogisticsPages = LOGISTICS_PAGES.map(({ key, label }) => ({
  key,
  label,
  role: "Admin",
}));

const PAGES = [
  // Employee pages
  { key: "dashboard", label: "Dashboard", role: "Employee", locked: true },
  { key: "payroll", label: "Payroll", role: "Employee" },
  { key: "payslips", label: "Pay Slips", role: "Employee" },
  { key: "attendance", label: "Attendance", role: "Employee" },
  ...employeeLogisticsPages,
  { key: "calendar", label: "Calendar", role: "Employee" },
  { key: "filing", label: "Filing", role: "Employee" },
  { key: "settings", label: "Settings", role: "Employee", locked: true },

  // Admin pages
  { key: "admin-dashboard", label: "Dashboard", role: "Admin", locked: true },
  { key: "employees", label: "Employees", role: "Admin" },
  { key: "deductions", label: "Deductions", role: "Admin" },
  { key: "admin-payslips", label: "Pay Slips", role: "Admin" },
  { key: "admin-attendance", label: "Attendance", role: "Admin" },
  ...adminLogisticsPages,
  { key: "admin-calendar", label: "Calendar", role: "Admin" },
  { key: "admin-filing", label: "Filing", role: "Admin" },
  { key: "reports", label: "Reports", role: "Admin" },
  { key: "admin-settings", label: "Settings", role: "Admin", locked: true },
];

// Both admin roles (Admin, Super Admin) get the Admin pages
const pagesForRole = (role) =>
  PAGES.filter((page) => page.role === pageRole(role));

module.exports = { PAGES, pagesForRole, LOGISTICS_PAGE_KEYS, isLogisticsPage };
