const { pagesForRole, isLogisticsPage } = require("../config/pages");
const { isSuperAdmin, isPlainAdmin } = require("../config/roles");

// Which page keys a user may open.
//
// - Super Admin: always every admin page and action, whatever is stored on the account.
// - Admin: the locked admin pages (Dashboard, Settings) plus the admin keys the Super
//   Admin ticked in its `pageAccess`. Nothing stored means only the locked pages.
// - Employee with no `pageAccess` stored: every employee page. This keeps all existing
//   accounts working exactly as before.
// - Employee with `pageAccess` stored: only those pages, plus the locked ones.
// Keys that do not belong to the account's role are ignored.
const getAllowedPages = (user) => {
  const rolePages = pagesForRole(user.role);

  if (isSuperAdmin(user.role)) {
    return rolePages.map((page) => page.key);
  }

  if (!Array.isArray(user.pageAccess)) {
    if (isPlainAdmin(user.role)) {
      return rolePages.filter((page) => page.locked).map((page) => page.key);
    }
    return rolePages.filter((page) => !page.defaultOff).map((page) => page.key);
  }

  const granted = new Set(user.pageAccess);
  return rolePages
    .filter((page) => page.locked || granted.has(page.key))
    .map((page) => page.key);
};

// True when an admin-role account may use the admin page or action `key`: the Super
// Admin always, an Admin only when it is ticked (or locked). False for any other role.
const canUseAdminPage = (user, key) => {
  if (!user) return false;
  if (isSuperAdmin(user.role)) return true;
  if (!isPlainAdmin(user.role)) return false;
  return getAllowedPages(user).includes(key);
};

// The Logistics "admin" power (acting at every step): the Super Admin always; an Admin
// only when the Super Admin ticked at least one Logistics page for it.
const hasLogisticsAdminPower = (user) => {
  if (!user) return false;
  if (isSuperAdmin(user.role)) return true;
  if (!isPlainAdmin(user.role)) return false;
  return getAllowedPages(user).some((key) => isLogisticsPage(key));
};

// The page list to store when an admin ticks `pages` for an account of `role`: that
// role's pages in config order, the locked ones always included, any other key dropped.
const normalizePageAccess = (role, pages) => {
  const keep = new Set(pages);
  return pagesForRole(role)
    .filter((page) => page.locked || keep.has(page.key))
    .map((page) => page.key);
};

module.exports = {
  getAllowedPages,
  canUseAdminPage,
  hasLogisticsAdminPower,
  normalizePageAccess,
};
