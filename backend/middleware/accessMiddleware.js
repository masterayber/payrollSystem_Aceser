const authMiddleware = require("./authMiddleware");
const jwt = require("jsonwebtoken");
const User = require("../models/authUsers");
const { getAllowedPages } = require("../utils/pageAccess");
const { isAdminRole } = require("../config/roles");

// The JWT only proves who the caller was when the token was issued. Role, status and
// page access can change afterwards, so they are re-read from the database on every
// request. That is what makes an admin's change take effect immediately.
// Status is checked first: an account that is not Active is refused as such. Then, if
// the role inside the token no longer matches the stored role (any change, in either
// direction, Admin <-> Super Admin included), the session ends: 401 ROLE_CHANGED, so
// the screen signs the user out and they sign in again with a token for the new role.
const loadCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("role status pageAccess")
      .lean();

    if (!user || user.status !== "Active") {
      return res.status(401).json({ message: "Account is not active" });
    }

    if (req.user.role !== user.role) {
      return res.status(401).json({
        message: "Your role has changed. Please sign in again.",
        code: "ROLE_CHANGED",
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

const requireAuthenticated = [authMiddleware, loadCurrentUser];

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
  requireSignupToken,
};
