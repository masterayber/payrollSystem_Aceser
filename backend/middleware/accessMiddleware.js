const authMiddleware = require("./authMiddleware");
const jwt = require("jsonwebtoken");
const User = require("../models/authUsers");
const { getAllowedPages, canUseAdminPage } = require("../utils/pageAccess");
const { isAdminRole, isSuperAdmin } = require("../config/roles");
const {
  OWN_RECORD_MESSAGE,
  isOwnLinkedEmployee,
} = require("../utils/linkedEmployee");

// The JWT only proves who the caller was when the token was issued. Role, status,
// page access and the password flags can change afterwards, so they are re-read from
// the database on every request. That is what makes an admin's change take effect
// immediately. Every signed-in route goes through here. Checks, in order:
// 1. Status: an account that is missing or not Active (Pending, Inactive, Resigned) is
//    refused: 401 ACCOUNT_INACTIVE, so the screen signs the user out.
// 2. Role: if the role inside the token no longer matches the stored role (any change,
//    in either direction, Admin <-> Super Admin included), the session ends: 401
//    ROLE_CHANGED, and they sign in again with a token for the new role.
// 3. Password: while `mustChangePassword` is set, every route is refused with 403
//    PASSWORD_CHANGE_REQUIRED, except the ones marked with allowBeforePasswordChange
//    (GET /api/auth/me and POST /api/auth/change-password). Blocked by default, so a
//    new route can't forget the check.
// An Admin's ticks (`pageAccess`), pay list (`payAccess`) and linked employee are read
// here too, so a change the Super Admin makes applies on the Admin's next request
// without ending its session (they don't change the role).
const loadCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId)
      .select(
        "role status pageAccess mustChangePassword payAccess linkedEmployeeId",
      )
      .lean();

    if (!user || user.status !== "Active") {
      return res.status(401).json({
        message: "Account is not active",
        code: "ACCOUNT_INACTIVE",
      });
    }

    if (req.user.role !== user.role) {
      return res.status(401).json({
        message: "Your role has changed. Please sign in again.",
        code: "ROLE_CHANGED",
      });
    }

    if (user.mustChangePassword === true && !req.allowBeforePasswordChange) {
      return res.status(403).json({
        message: "Please change your password before continuing.",
        code: "PASSWORD_CHANGE_REQUIRED",
      });
    }

    req.currentUser = user;
    next();
  } catch (err) {
    console.error("Load current user error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Any admin role, whatever its ticks. Only for the read-only lists that forms and
// pickers on many pages need (the employee list, departments and positions, the
// attendance list the Dashboard counts); every other admin route uses
// requireAdminPage or requireSuperAdmin.
const requireAdmin = [
  authMiddleware,
  loadCurrentUser,
  (req, res, next) => {
    if (!isAdminRole(req.currentUser.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  },
];

const PAGE_ACCESS_DENIED = {
  message: "You do not have access to this page",
  code: "PAGE_ACCESS_DENIED",
};

// Guards an admin API route with its screen's page (or action) key, not only the role.
// The Super Admin always passes; an Admin passes only when the key is ticked for it
// (403 PAGE_ACCESS_DENIED otherwise); an Employee gets "Admin access required", as on
// requireAdmin. `pageKey` may be a function of the request, for a route whose key
// depends on its parameters, or a list of keys that must all be ticked (the 13th month
// report needs "reports" and "thirteenth-month").
const requireAdminPage = (pageKey) => [
  authMiddleware,
  loadCurrentUser,
  (req, res, next) => {
    if (!isAdminRole(req.currentUser.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const key = typeof pageKey === "function" ? pageKey(req) : pageKey;
    const keys = Array.isArray(key) ? key : [key];
    if (!keys.every((one) => canUseAdminPage(req.currentUser, one))) {
      return res.status(403).json(PAGE_ACCESS_DENIED);
    }
    next();
  },
];

// Super Admin only. Everyone else, Admins included, gets the same 403 as a page they
// can't open, with no hint that the screen exists.
const requireSuperAdmin = [
  authMiddleware,
  loadCurrentUser,
  (req, res, next) => {
    if (!isSuperAdmin(req.currentUser.role)) {
      return res.status(403).json(PAGE_ACCESS_DENIED);
    }
    next();
  },
];

// Refuses an Admin acting on its own linked employee: 403 "You can't act on your own
// employee record." `pickUserId(req)` gives the target employee's account id. Goes
// after a guard that ran loadCurrentUser.
const refuseOwnLinkedEmployee = (pickUserId) => (req, res, next) => {
  if (isOwnLinkedEmployee(req.currentUser, pickUserId(req))) {
    return res
      .status(403)
      .json({ message: OWN_RECORD_MESSAGE, code: "OWN_EMPLOYEE_RECORD" });
  }
  next();
};

// Guards an Employee API route so it follows the same page permissions as the UI.
// Admins (both admin roles) are never restricted by page access, so they always pass.
const requirePage = (pageKey) => [
  authMiddleware,
  loadCurrentUser,
  (req, res, next) => {
    if (isAdminRole(req.currentUser.role)) return next();

    if (!getAllowedPages(req.currentUser).includes(pageKey)) {
      return res.status(403).json({
        message: "You do not have access to this page",
        code: "PAGE_ACCESS_DENIED",
      });
    }
    next();
  },
];

// Keep loadCurrentUser second: middleware/logisticsAccess.js takes it from here
const requireAuthenticated = [authMiddleware, loadCurrentUser];

// Marks a route as usable while the account must still change its password.
// Goes before loadCurrentUser; only /me and change-password use it.
const allowBeforePasswordChange = (req, res, next) => {
  req.allowBeforePasswordChange = true;
  next();
};

const requireAuthenticatedBeforePasswordChange = [
  authMiddleware,
  allowBeforePasswordChange,
  loadCurrentUser,
];

// For the two signup steps after POST /api/auth/signup, before an admin approves the account.
// Accepts only the short-lived signup token, and only while the account is still Pending.
const requireSignupToken = async (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Signup session expired. Please sign up again." });
  }

  if (decoded.purpose !== "signup") {
    return res.status(401).json({ message: "Token is not valid" });
  }

  try {
    const user = await User.findById(decoded.userId).select("status").lean();
    if (!user) {
      return res.status(401).json({ message: "Token is not valid" });
    }
    if (user.status !== "Pending") {
      return res
        .status(403)
        .json({ message: "This account is already set up. Please log in." });
    }

    req.signupUserId = decoded.userId;
    next();
  } catch (err) {
    console.error("Signup token check error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  PAGE_ACCESS_DENIED,
  requireAdmin,
  requireAdminPage,
  requireSuperAdmin,
  refuseOwnLinkedEmployee,
  requirePage,
  requireAuthenticated,
  requireAuthenticatedBeforePasswordChange,
  allowBeforePasswordChange,
  requireSignupToken,
};
