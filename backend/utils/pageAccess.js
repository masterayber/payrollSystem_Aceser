const { pagesForRole } = require("../config/pages");

// Which page keys a user may open.
//
// - Admin: always every admin page. Page access is an Employee-only setting, so an
//   admin can never be restricted, whatever is stored on the account.
// - Employee with no `pageAccess` stored: every employee page. This keeps all existing
//   accounts working exactly as before.
// - Employee with `pageAccess` stored: only those pages, plus the locked ones. Keys
//   that do not belong to the Employee role are ignored.
const getAllowedPages = (user) => {
  const rolePages = pagesForRole(user.role);

  if (user.role === "Admin" || !Array.isArray(user.pageAccess)) {
    return rolePages.map((page) => page.key);
  }

  const granted = new Set(user.pageAccess);
  return rolePages
    .filter((page) => page.locked || granted.has(page.key))
    .map((page) => page.key);
};

module.exports = { getAllowedPages };
