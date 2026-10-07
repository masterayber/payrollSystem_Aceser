const { pagesForRole } = require("../config/pages");

// Which page keys a user may open.
//
// - No `pageAccess` stored on the user: every page for their role. This keeps all
//   existing accounts working exactly as before.
// - `pageAccess` stored: only those pages, plus the locked ones. Keys that do not
//   belong to the user's role are ignored.
const getAllowedPages = (user) => {
  const rolePages = pagesForRole(user.role);

  if (!Array.isArray(user.pageAccess)) {
    return rolePages.map((page) => page.key);
  }

  const granted = new Set(user.pageAccess);
  return rolePages
    .filter((page) => page.locked || granted.has(page.key))
    .map((page) => page.key);
};

module.exports = { getAllowedPages };
