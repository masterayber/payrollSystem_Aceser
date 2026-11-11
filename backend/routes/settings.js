const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const CompanySettings = require("../models/companySettings");
const {
  requireAdminPage,
  requireAuthenticated,
  PAGE_ACCESS_DENIED,
} = require("../middleware/accessMiddleware");
const { isAdminRole } = require("../config/roles");
const { isHiddenAccount } = require("../utils/hiddenAccounts");
const { canUseAdminPage } = require("../utils/pageAccess");
const { takenRefusal } = require("../utils/takenIdentifiers");
const {
  payScope,
  settingsFor,
  ownSettings,
} = require("../utils/payVisibility");
const {
  OWN_RECORD_MESSAGE,
  isOwnLinkedEmployee,
} = require("../utils/linkedEmployee");
const {
  defaultPhotoFor,
  refreshDefaultIcon,
} = require("../utils/profileIcon");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "../uploads");

const uploadDestination = (req, file, cb) => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  cb(null, UPLOAD_DIR);
};

// Image types an upload may be. The extension comes from this list, never from the
// upload file name, so the file is always served as an image. No SVG: it can hold scripts.
const IMAGE_TYPES = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

// Upload middleware for one image field: PNG, JPG, WEBP or GIF up to 2 MB, saved as
// <prefix>-<time>.<ext>. Multer errors become a 400 with a message instead of a 500.
const imageUpload = (field, prefix, label) => {
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadDestination,
      filename: (req, file, cb) => {
        cb(null, `${prefix}-${Date.now()}${IMAGE_TYPES[file.mimetype]}`);
      },
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (IMAGE_TYPES[file.mimetype]) return cb(null, true);
      cb(new Error(`The ${label} must be a PNG, JPG, WEBP or GIF image`));
    },
  }).single(field);

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (!err) return next();
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? `The ${label} must be 2 MB or smaller`
          : err.message;
      res.status(400).json({ message });
    });
  };
};

const uploadLogo = imageUpload("logo", "company-logo", "logo");
const uploadProfilePhoto = imageUpload(
  "profilePhoto",
  "profile-photo",
  "profile photo",
);

// Deletes a file saved under /uploads; anything else (such as a default icon) is left alone
const removeUpload = (urlPath) => {
  if (!urlPath?.startsWith("/uploads/")) return;
  const filePath = path.join(__dirname, "..", urlPath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

const requireSelfOrAdmin = async (req, res, next) => {
  const isAdmin = isAdminRole(req.currentUser.role);
  const isOwner = String(req.user.userId) === String(req.params.id);

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ message: "Access denied" });
  }

  // Another account's details are part of the Employees screen: an Admin needs the
  // "employees" tick, and can't edit its own linked employee
  if (!isOwner) {
    if (!canUseAdminPage(req.currentUser, "employees")) {
      return res.status(403).json(PAGE_ACCESS_DENIED);
    }
    if (isOwnLinkedEmployee(req.currentUser, req.params.id)) {
      return res
        .status(403)
        .json({ message: OWN_RECORD_MESSAGE, code: "OWN_EMPLOYEE_RECORD" });
    }
  }

  // Super Admin and Admin accounts are hidden from other accounts: answered as missing.
  // The account itself still edits its own settings.
  if (!isOwner) {
    try {
      if (await isHiddenAccount(req.params.id)) {
        return res.status(404).json({ message: "User not found" });
      }
    } catch (err) {
      return res.status(500).json({ message: "Server error", error: err.message });
    }
  }

  next();
};

const EDITABLE_EMPLOYEE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "birthday",
  "contactNumber",
  "gender",
  "address",
  "emergencyDetails",
];

// Route for updating general settings
router.put(
  "/updateGeneralSettings/:id",
  requireAuthenticated,
  requireSelfOrAdmin,
  async (req, res) => {
    try {
      const userId = req.params.id;
      const { employee, email } = req.body;

      // An email another account uses, in any case (the account email and the
      // employee record's email); keeping one's own, even in a new case, is fine.
      // Refused before anything is saved.
      const taken = await takenRefusal(
        { email: [email, employee?.email] },
        userId,
      );
      if (taken) {
        return res.status(400).json({ message: taken });
      }

      // Only whitelisted fields reach the Auth record. Role, status, password and
      // page access are changed through their own admin routes, never from here.
      const userUpdate = {};
      if (email !== undefined) userUpdate.email = email;

      const updatedUser = await User.findByIdAndUpdate(userId, userUpdate, {
        new: true,
        runValidators: true,
      }).select("-password");

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update Employee
      const employeeUpdate = {};
      for (const field of EDITABLE_EMPLOYEE_FIELDS) {
        if (employee?.[field] !== undefined) {
          employeeUpdate[field] = employee[field];
        }
      }

      // The gender before the save, to tell whether it changed
      const before =
        employeeUpdate.gender !== undefined
          ? await Employee.findOne({ userId }).select("gender").lean()
          : null;

      const updatedEmployee = await Employee.findOneAndUpdate(
        { userId },
        { $set: employeeUpdate },
        { new: true },
      );

      // A changed gender switches a default icon to the new gender's (the plain icon
      // for an admin role); an uploaded photo stays (utils/profileIcon.js)
      if (before && updatedEmployee && before.gender !== updatedEmployee.gender) {
        const icon = await refreshDefaultIcon(updatedUser, {
          gender: updatedEmployee.gender,
        });
        if (icon.changed) {
          await User.updateOne(
            { _id: updatedUser._id },
            { $set: { profilePhoto: icon.profilePhoto } },
          );
        }
      }

      // Settings aren't edited here: job details change through the admin employee
      // routes and company details through /company. Read them for the response only.
      // The pay in them follows the caller's pay list; the caller's own record keeps
      // its pay. Either way a shown pay carries the "Pay not set" flag.
      const currentSettings = await Settings.findOne({ userId });
      const isOwner = String(req.user.userId) === String(userId);
      const settingsReply = currentSettings ? currentSettings.toObject() : {};

      // Only what the screen shows: never the reset token, page or pay access, the
      // forced-change flag or the admin links
      const combined = {
        _id: updatedUser._id,
        email: updatedUser.email,
        profilePhoto: updatedUser.profilePhoto,
        employee: updatedEmployee ? updatedEmployee.toObject() : {},
        settings: isOwner
          ? ownSettings(settingsReply)
          : settingsFor(payScope(req.currentUser), userId, settingsReply),
      };

      res.json(combined);
    } catch (error) {
      console.error("Error updating all user data:", error);
      res.status(500).json({ message: "Error updating user data" });
    }
  },
);

// Route for uploading a profile photo
router.put(
  "/users/:id/profile-photo",
  requireAuthenticated,
  requireSelfOrAdmin,
  uploadProfilePhoto,
  async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) {
        if (req.file) removeUpload(`/uploads/${req.file.filename}`);
        return res.status(404).json({ message: "User not found" });
      }

      if (!req.file)
        return res.status(400).json({ message: "No file uploaded" });

      // Only a previous upload is deleted; a default icon under /assets stays
      removeUpload(user.profilePhoto);

      user.profilePhoto = `/uploads/${req.file.filename}`;
      await user.save();

      res.status(200).json({
        message: "Profile photo updated",
        profilePhoto: user.profilePhoto,
      });
    } catch (error) {
      console.error("Error updating profile photo:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Route for removing profile photo of user. The reply carries only the new icon path,
// never the account record (it holds the password hash and reset token). The icon
// follows the gender on the Employee record (utils/profileIcon.js).
router.delete(
  "/remove-profile-photo/:id",
  requireAuthenticated,
  requireSelfOrAdmin,
  async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only an upload is deleted; a default icon (or no photo) is just replaced
      removeUpload(user.profilePhoto);

      user.profilePhoto = await defaultPhotoFor(user);
      await user.save();

      return res.status(200).json({
        message: "Profile photo set to default",
        profilePhoto: user.profilePhoto,
      });
    } catch (error) {
      console.error("Error removing profile photo:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

// ---- Company-wide settings ----

const COMPANY_FIELDS = ["name", "contact", "dateFormat", "timeFormat"];

// The one company record, created with the defaults the first time it's needed
const getCompany = () =>
  CompanySettings.findOneAndUpdate(
    { key: "company" },
    { $setOnInsert: { key: "company" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

const isBadInput = (err) => ["ValidationError", "CastError"].includes(err.name);

// Any signed-in user: the name, logo and formats are shown to employees too
router.get("/company", requireAuthenticated, async (req, res) => {
  try {
    res.json(await getCompany());
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Settings > Company writes: the "settings-company" tick (the Super Admin always)
const requireCompanySettings = requireAdminPage("settings-company");

// Admin: { name, contact, dateFormat, timeFormat }; any other field is ignored
router.put("/company", requireCompanySettings, async (req, res) => {
  try {
    const update = { updatedBy: req.user.userId };
    for (const field of COMPANY_FIELDS) {
      if (req.body?.[field] !== undefined) update[field] = req.body[field];
    }

    const company = await CompanySettings.findOneAndUpdate(
      { key: "company" },
      { $set: update },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    res.json(company);
  } catch (err) {
    if (isBadInput(err)) return res.status(400).json({ message: err.message });
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: multipart form with a "logo" image. The guard runs first, so an upload
// from anyone without the tick is never written to disk.
router.put("/company/logo", requireCompanySettings, uploadLogo, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const company = await getCompany();
    removeUpload(company.logo);
    company.logo = `/uploads/${req.file.filename}`;
    company.updatedBy = req.user.userId;
    await company.save();

    res.json(company);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.delete("/company/logo", requireCompanySettings, async (req, res) => {
  try {
    const company = await getCompany();
    removeUpload(company.logo);
    company.logo = "";
    company.updatedBy = req.user.userId;
    await company.save();

    res.json(company);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
