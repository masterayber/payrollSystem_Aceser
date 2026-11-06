// Account roles. The only place the role names are spelled.
//
// - "Super Admin": the one account that runs the whole system (the `admin` account).
//   It passes every check an Admin passes, can't be changed through any route, and is
//   never shown: screens show it as "Admin".
// - "Admin": kept for HR's admin accounts (not used yet).
// - "Employee": everyone else.
// The frontend keeps a mirror of this file with the same names.

const SUPER_ADMIN = "Super Admin";
const ROLES = ["Super Admin", "Admin", "Employee"];
const ADMIN_ROLES = ["Super Admin", "Admin"];

const isAdminRole = (role) => ADMIN_ROLES.includes(role);

const isSuperAdmin = (role) => role === SUPER_ADMIN;

// The role whose pages (config/pages.js) an account uses: both admin roles use the
// Admin pages
const pageRole = (role) => (isAdminRole(role) ? "Admin" : role);

// The role as shown on screen; never "Super Admin"
const roleLabel = (role) => (isAdminRole(role) ? "Admin" : role);

module.exports = {
  SUPER_ADMIN,
  ROLES,
  ADMIN_ROLES,
  isAdminRole,
  isSuperAdmin,
  pageRole,
  roleLabel,
};
