const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const { requireAuthenticated } = require("../middleware/accessMiddleware");

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(__dirname, "../uploads");

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  }),
});

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
      const { employee, settings, email } = req.body;

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

      // Update Settings
      const updatedSettings = await Settings.findOneAndUpdate(
        { userId },
        { $set: settings },
        { new: true },
      );

      const combined = {
        ...updatedUser.toObject(),
        employee: updatedEmployee ? updatedEmployee.toObject() : {},
        settings: updatedSettings ? updatedSettings.toObject() : {},
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

module.exports = router;
