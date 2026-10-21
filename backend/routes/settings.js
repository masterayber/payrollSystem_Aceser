const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const CompanySettings = require("../models/companySettings");
const {
  requireAdmin,
  requireAuthenticated,
} = require("../middleware/accessMiddleware");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "../uploads");

const uploadDestination = (req, file, cb) => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  cb(null, UPLOAD_DIR);
};

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDestination,
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  }),
});

// Image types a logo may be. The extension comes from this list, never from the
// upload file name, so the file is always served as an image. No SVG: it can hold scripts.
const LOGO_TYPES = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDestination,
    filename: (req, file, cb) => {
      cb(null, `company-logo-${Date.now()}${LOGO_TYPES[file.mimetype]}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (LOGO_TYPES[file.mimetype]) return cb(null, true);
    cb(new Error("The logo must be a PNG, JPG, WEBP or GIF image"));
  },
});

// Multer errors become a 400 with a message instead of a 500
const uploadLogo = (req, res, next) => {
  logoUpload.single("logo")(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "The logo must be 2 MB or smaller"
        : err.message;
    res.status(400).json({ message });
  });
};

// Deletes a file saved under /uploads; anything else (such as a default icon) is left alone
const removeUpload = (urlPath) => {
  if (!urlPath?.startsWith("/uploads/")) return;
  const filePath = path.join(__dirname, "..", urlPath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

const requireSelfOrAdmin = (req, res, next) => {
  const isAdmin = req.currentUser.role === "Admin";
  const isOwner = String(req.user.userId) === String(req.params.id);

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ message: "Access denied" });
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

      const updatedEmployee = await Employee.findOneAndUpdate(
        { userId },
        { $set: employeeUpdate },
        { new: true },
      );

      // Settings aren't edited here: job details change through the admin employee
      // routes and company details through /company. Read them for the response only.
      const currentSettings = await Settings.findOne({ userId });

      const combined = {
        ...updatedUser.toObject(),
        employee: updatedEmployee ? updatedEmployee.toObject() : {},
        settings: currentSettings ? currentSettings.toObject() : {},
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
  upload.single("profilePhoto"),
  async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) return res.status(404).json({ message: "User not found" });

      if (!req.file)
        return res.status(400).json({ message: "No file uploaded" });

      if (user.profilePhoto) {
        const oldFilePath = path.join(__dirname, "..", user.profilePhoto);

        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      user.profilePhoto = `/uploads/${req.file.filename}`;
      await user.save();

      res.status(200).json({
        message: "Profile photo updated",
        profilePhoto: user.profilePhoto,
      });
    } catch (error) {
      console.error("Error updating profile photo:", error);
      res.status(500).json({ message: "Server error", error });
    }
  },
);

// Route for removing profile photo of user
router.delete(
  "/remove-profile-photo/:id",
  requireAuthenticated,
  requireSelfOrAdmin,
  async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user || !user.profilePhoto) {
        return res.status(404).json({ message: "User not found" });
      }

      const filePath = path.join(__dirname, "..", user.profilePhoto);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("File deleted successfully:", filePath);
      } else {
        console.log("File not found:", filePath);
      }

      let defaultPhoto = "/assets/user-circle.svg";

      if (user.role === "Employee") {
        const employee = await Employee.findOne({ email: user.email });

        if (employee && employee.gender) {
          const gender = employee.gender;

          if (gender === "Male") {
            defaultPhoto = "/assets/genderIcons/male.svg";
          } else if (gender === "Female") {
            defaultPhoto = "/assets/genderIcons/female.svg";
          }
        }
      }

      user.profilePhoto = defaultPhoto;
      await user.save();

      return res
        .status(200)
        .json({ message: "Profile photo set to default", user });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error", error });
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

// Admin: { name, contact, dateFormat, timeFormat }; any other field is ignored
router.put("/company", requireAdmin, async (req, res) => {
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

// Admin: multipart form with a "logo" image. requireAdmin runs first, so a
// non-admin's upload is never written to disk.
router.put("/company/logo", requireAdmin, uploadLogo, async (req, res) => {
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

router.delete("/company/logo", requireAdmin, async (req, res) => {
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
