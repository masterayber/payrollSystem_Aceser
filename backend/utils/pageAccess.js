const { pagesForRole } = require("../config/pages");
const { isAdminRole } = require("../config/roles");

// Which page keys a user may open.
//
// - Admin and Super Admin: always every admin page. Page access is an Employee-only
//   setting, so an admin can never be restricted, whatever is stored on the account.
// - Employee with no `pageAccess` stored: every employee page. This keeps all existing
//   accounts working exactly as before.
// - Employee with `pageAccess` stored: only those pages, plus the locked ones. Keys
//   that do not belong to the Employee role are ignored.
const getAllowedPages = (user) => {
  const rolePages = pagesForRole(user.role);

  if (isAdminRole(user.role)) {
    return rolePages.map((page) => page.key);
  }

  if (!Array.isArray(user.pageAccess)) {
    return rolePages.filter((page) => !page.defaultOff).map((page) => page.key);
  }

  const granted = new Set(user.pageAccess);
  return rolePages
    .filter((page) => page.locked || granted.has(page.key))
    .map((page) => page.key);
};

// The page list to store when an admin ticks `pages` for an account of `role`: that
// role's pages in config order, the locked ones always included, any other key dropped.
const normalizePageAccess = (role, pages) => {
  const keep = new Set(pages);
  return pagesForRole(role)
    .filter((page) => page.locked || keep.has(page.key))
    .map((page) => page.key);
};

module.exports = { getAllowedPages, normalizePageAccess };
