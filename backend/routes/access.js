const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/authUsers");
const { PAGES, pagesForRole } = require("../config/pages");
const { getAllowedPages } = require("../utils/pageAccess");
const { requireAdmin } = require("../middleware/accessMiddleware");

const router = express.Router();

const describeAccess = (user) => ({
  userId: user._id,
  role: user.role,
  // true when an admin has set explicit access, false when the role default applies
  customized: Array.isArray(user.pageAccess),
  allowedPages: getAllowedPages(user),
  pages: pagesForRole(user.role),
});

const validUserId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.userId)) {
    return res.status(400).json({ message: "Invalid user id" });
  }
  next();
};

// Every page that exists
router.get("/pages", requireAdmin, (req, res) => {
  res.json(PAGES);
});

// What one user can currently open
router.get("/users/:userId", requireAdmin, validUserId, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select("role pageAccess")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(describeAccess(user));
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Set a user's pages: { pages: ["payroll", "filing"] }
// or return them to the role default: { reset: true }
router.put("/users/:userId", requireAdmin, validUserId, async (req, res) => {
  try {
    const { userId } = req.params;
    const { pages, reset } = req.body || {};

    if (String(req.user.userId) === userId) {
      return res
        .status(403)
        .json({ message: "You cannot change your own page access" });
    }

    const target = await User.findById(userId).select("role").lean();
    if (!target) return res.status(404).json({ message: "User not found" });

    let update;
    if (reset === true) {
      update = { $unset: { pageAccess: 1 }, $set: { updatedAt: new Date() } };
    } else {
      if (
        !Array.isArray(pages) ||
        pages.some((key) => typeof key !== "string")
      ) {
        return res
          .status(400)
          .json({ message: "`pages` must be an array of page keys" });
      }

      const rolePages = pagesForRole(target.role);
      const validKeys = new Set(rolePages.map((page) => page.key));
      const invalid = [...new Set(pages)].filter((key) => !validKeys.has(key));
      if (invalid.length > 0) {
        return res.status(400).json({
          message: `Not a page for the ${target.role} role: ${invalid.join(", ")}`,
        });
      }

      const keep = new Set(pages);
      const normalized = rolePages
        .filter((page) => page.locked || keep.has(page.key))
        .map((page) => page.key);

      update = { $set: { pageAccess: normalized, updatedAt: new Date() } };
    }

    const updated = await User.findByIdAndUpdate(userId, update, {
      new: true,
    })
      .select("role pageAccess")
      .lean();

    res.json(describeAccess(updated));
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
