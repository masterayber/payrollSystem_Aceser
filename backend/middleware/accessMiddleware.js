const authMiddleware = require("./authMiddleware");
const jwt = require("jsonwebtoken");
const User = require("../models/authUsers");
const { getAllowedPages } = require("../utils/pageAccess");
const { isAdminRole } = require("../config/roles");

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
const loadCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("role status pageAccess mustChangePassword")
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
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

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
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  requireAdmin,
  requirePage,
  requireAuthenticated,
  requireAuthenticatedBeforePasswordChange,
  allowBeforePasswordChange,
  requireSignupToken,
};
