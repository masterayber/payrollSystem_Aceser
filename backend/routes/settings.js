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
  const isOwner = String(req.user.userId) === String(req.params.userId);

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ message: "Access denied" });
  }

  next();
};

// Route for updating general settings
router.put(
  "/updateGeneralSettings/:id",
  requireAuthenticated,
  requireSelfOrAdmin,
  async (req, res) => {
    try {
      const userId = req.params.id;
      const { employee, settings, ...userData } = req.body;

      // Page access is only editable through /api/access (admin only)
      delete userData.pageAccess;
      delete userData.allowedPages;

      const existingUser = await User.findById(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!userData.profilePhoto && existingUser.profilePhoto) {
        userData.profilePhoto = existingUser.profilePhoto;
      }

      // Update Auths
      const updatedUser = await User.findByIdAndUpdate(userId, userData, {
        new: true,
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update Employees
      const updatedEmployee = await Employee.findOneAndUpdate(
        { email: updatedUser.email },
        { $set: employee },
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
  upload.single("profilePhoto"),
  requireAuthenticated,
  requireSelfOrAdmin,
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
