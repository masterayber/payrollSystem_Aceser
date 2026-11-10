// Account roles. The only place the role names are spelled.
//
// - "Super Admin": the one account that runs the whole system (the `admin` account).
//   It passes every check an Admin passes, can't be changed through any route, and is
//   never shown: screens show it as "Admin".
// - "Admin": a separate account the Super Admin creates (POST /api/admins), not an
//   employee and never paid. It opens only the admin pages and actions the Super Admin
//   ticks for it (stored in `pageAccess`), and is hidden like the Super Admin.
// - "Employee": everyone else.
// No route writes a role after an account is created: sign-up and Add Employee always
// make Employees, POST /api/admins always makes Admins, and nothing changes it later.
// The frontend keeps a mirror of this file with the same names.

const SUPER_ADMIN = "Super Admin";
const ADMIN = "Admin";
const ROLES = ["Super Admin", "Admin", "Employee"];
const ADMIN_ROLES = ["Super Admin", "Admin"];

const isAdminRole = (role) => ADMIN_ROLES.includes(role);

const isSuperAdmin = (role) => role === SUPER_ADMIN;

// An Admin account (limited by its ticks), not the Super Admin
const isPlainAdmin = (role) => role === ADMIN;

// The role whose pages (config/pages.js) an account uses: both admin roles use the
// Admin pages
const pageRole = (role) => (isAdminRole(role) ? "Admin" : role);

// The role as shown on screen; never "Super Admin"
const roleLabel = (role) => (isAdminRole(role) ? "Admin" : role);

module.exports = {
  SUPER_ADMIN,
  ADMIN,
  ROLES,
  ADMIN_ROLES,
  isAdminRole,
  isSuperAdmin,
  isPlainAdmin,
  pageRole,
  roleLabel,
};
