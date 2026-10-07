// Single source of truth for every page that can be granted or revoked.
//
// key    - matches the route path without the leading slash (e.g. "/payroll" -> "payroll")
// role   - the role whose sidebar the page belongs to
// locked - always available to that role and cannot be revoked. Dashboards are the
//          landing pages, and admin-settings stops an admin from losing the screens
//          needed to repair access.
const PAGES = [
  // Employee pages
  { key: "dashboard", label: "Dashboard", role: "Employee", locked: true },
  { key: "payroll", label: "Payroll", role: "Employee" },
  { key: "payslips", label: "Pay Slips", role: "Employee" },
  { key: "attendance", label: "Attendance", role: "Employee" },
  { key: "calendar", label: "Calendar", role: "Employee" },
  { key: "filing", label: "Filing", role: "Employee" },
  { key: "settings", label: "Settings", role: "Employee", locked: true },

  // Admin pages
  { key: "admin-dashboard", label: "Dashboard", role: "Admin", locked: true },
  { key: "employees", label: "Employees", role: "Admin" },
  { key: "deductions", label: "Deductions", role: "Admin" },
  { key: "admin-payslips", label: "Pay Slips", role: "Admin" },
  { key: "admin-attendance", label: "Attendance", role: "Admin" },
  { key: "admin-calendar", label: "Calendar", role: "Admin" },
  { key: "admin-filing", label: "Filing", role: "Admin" },
  { key: "reports", label: "Reports", role: "Admin" },
  { key: "admin-settings", label: "Settings", role: "Admin", locked: true },
];

const pagesForRole = (role) => PAGES.filter((page) => page.role === role);

module.exports = { PAGES, pagesForRole };
