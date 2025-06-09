const express = require("express");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const authMiddleware = require("../middleware/authMiddleware");

const Dropdown = require("../models/dropdownOption");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const Attendance = require("../models/attendance");

const sendEmail = require("../utils/nodemailer");

const router = express.Router();
const JWT_SECRET = "your_jwt_secret_key_here";

let otpStorage = {}; // Temporarily stores OTPs for demonstration

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

// Signup route
router.post("/signup", async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    employeeId,
    username,
    password,
    role,
    status,
  } = req.body;

  // Check if email is already registered to the database
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    const defaultStatus = role === "Admin" ? "Regular" : "Probationary";

    const user = new User({
      username,
      password,
      email,
      role,
      status,
      createdAt: new Date(),
    });
    await user.save();

    let employeeData = {
      firstName,
      lastName,
      employeeId,
      email,
      role: user.role,
      createdAt: new Date(),
    };

    if (user.role === "Employee") {
      employeeData.contactNumber = "";
      employeeData.birthday = "";
      employeeData.gender = user.gender || "Male";

      employeeData.emergencyDetails = {
        contactFirstName: "",
        contactLastName: "",
        contactEmergency: "",
        contactAddress: "",
      };
    }

    const employee = new Employee(employeeData);
    await employee.save();

    const settings = new Settings({
      userId: user._id,
      general: {
        employmentType: defaultStatus,
      },
    });
    await settings.save();

    res.status(200).json({ message: "User created successfully", email });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Login route
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({ message: "Invalid Username" });
    }

    if (user.status !== "Active") {
      return res.status(403).json({ message: "Account is pending approval" });
    }

    // Check if the password matches the user input
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    });

    const employee = await Employee.findOne({ email: user.email });
    const settings = await Settings.findOne({ userId: user._id });

    const userObj = user.toObject();
    delete userObj.password;

    const employeeObj = employee ? employee.toObject() : {};
    const settingsObj = settings ? settings.toObject() : {};

    const combinedData = {
      ...userObj,
      employee: employeeObj,
      settings: settingsObj,
    };

    res
      .status(200)
      .json({ token, user: combinedData, message: "Login Successful" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Forgot Password route
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Email is not registered" });
    }

    const otp = String(Math.floor(10000 + Math.random() * 900000));
    const expiresAt = Date.now() + 5 * 60 * 1000;

    otpStorage[email] = {
      otp,
      expiresAt,
    };

    await sendEmail(email, otp);

    res.status(200).json({
      message: "Password reset has been sent to your email",
      expiresAt,
      otp,
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error. Please try again later",
      error: err.message,
    });
  }
});

// OTP route
router.post("/otp", async (req, res) => {
  const { email, otp } = req.body;
  const storedOtp = otpStorage[email];

  if (!storedOtp) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  if (Date.now() > storedOtp.expiresAt) {
    return res.status(400).json({ message: "OTP is expired" });
  }

  if (storedOtp.otp !== otp) {
    return res.status(400).json({ message: "Incorrect OTP" });
  }

  const resetToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: "5m" });
  delete otpStorage[email]; // Delete OTP from local storage

  res.status(200).json({ message: "OTP verified.", resetToken });
});

// Reset Password Route
router.post("/reset-password", async (req, res) => {
  const { resetToken, password } = req.body;

  if (!resetToken) {
    return res.status(400).json({ message: "Reset token is required" });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(resetToken, JWT_SECRET);
    const email = decoded.email;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    await User.updateOne({ email }, { $set: { password: hashedPassword } });

    res.status(200).json({
      message:
        "Password has been reset successfully. Please log in with your new password.",
    });
  } catch (error) {
    console.error("Token verification error:", error.message);
    res.status(400).json({ message: "Invalid or expired token" });
  }
});

// Additional Information Route
router.post("/update-info", async (req, res) => {
  const {
    email,
    birthday,
    contactNumber,
    gender,
    contactFirstName,
    contactLastName,
    contactEmergency,
    contactAddress,
  } = req.body;

  try {
    const employee = await Employee.findOne({ email });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    employee.birthday = birthday;
    employee.contactNumber = contactNumber;
    employee.gender = gender;
    employee.emergencyDetails.contactFirstName = contactFirstName;
    employee.emergencyDetails.contactLastName = contactLastName;
    employee.emergencyDetails.contactEmergency = contactEmergency;
    employee.emergencyDetails.contactAddress = contactAddress;

    await employee.save();

    const user = await User.findOne({ email });
    if (user) {
      if (gender === "Male") {
        user.profilePhoto = "/assets/genderIcons/male.svg";
      } else if (gender === "Female") {
        user.profilePhoto = "/assets/genderIcons/female.svg";
      } else {
        user.profilePhoto = "/assets/user-circle.svg";
      }
      await user.save();
    }

    res.status(200).json({
      message: "Additional info updated successfully",
      userId: employee._id,
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error. Please try again later",
      error: err.message,
    });
  }
});

// Account Created Route
router.get("/created-account/:id", async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      firstName: employee.firstName,
      lastName: employee.lastName,
      gender: employee.gender,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error. Please try again later.",
      error: err.message,
    });
  }
});

router.get("/dashboard-data", authMiddleware, async (req, res) => {
  res.status(200).json({ message: "Protected Data" });
});

// Router for getting all the employees data
router.get("/employees", async (req, res) => {
  try {
    const employees = await Employee.aggregate([
      {
        $lookup: {
          from: "auths",
          localField: "email",
          foreignField: "email",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
      {
        $match: {
          "userDetails.status": "Active",
          "userDetails.role": "Employee",
        },
      },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          role: 1,
          type: 1,
          address: 1,
          birthday: 1,
          gender: 1,
          contactNumber: 1,
          createdAt: "$userDetails.createdAt",
        },
      },
    ]);

    res.status(200).json(employees);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching employees", error: err.message });
  }
});

router.put("/updateGeneralSettings/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const { employee, settings, ...userData } = req.body;

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
      { new: true }
    );

    // Update Settings
    const updatedSettings = await Settings.findOneAndUpdate(
      { userId },
      { $set: settings },
      { new: true }
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
});

router.put("/auths/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await User.findByIdAndUpdate(
      id,
      { status: "Active" },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User approved successfully", user: result });
  } catch (error) {
    res.status(500).json({ error: "Failed to approve user" });
  }
});

router.get("/pending-users", async (req, res) => {
  try {
    const pendingUsers = await User.find({ status: "Pending" });

    const enrichedUsers = await Promise.all(
      pendingUsers.map(async (user) => {
        const employee = await Employee.findOne({ email: user.email });
        return {
          _id: user._id,
          email: user.email,
          firstName: employee ? employee.firstName : "N/A",
          lastName: employee ? employee.lastName : "N/A",
          createdAt: user.createdAt,
        };
      })
    );

    res.json(enrichedUsers);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.put("/approve-user/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { status: "Active" },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    io.emit("userApproved", updatedUser);

    res
      .status(200)
      .json({ message: "User approved successfully", user: updatedUser });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.post("/add-employee", async (req, res) => {
  const { firstName, lastName, email, username, password, role } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const user = new User({
      email,
      username,
      password,
      role,
      status: "Active",
    });
    await user.save();

    const employee = new Employee({
      firstName,
      lastName,
      email,
      role,
    });
    await employee.save();

    res.status(200).json({ message: "Employee added successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.get("/:category", async (req, res) => {
  try {
    const dropdown = await Dropdown.findOne({ category: req.params.category });
    res.json(dropdown ? dropdown.options : []);
  } catch (error) {
    res.status(500).json({ message: "Error fetching dropdown options" });
  }
});

router.put(
  "/auths/:id/profile-photo",
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
  }
);

// Route for removing profile photo of user
router.delete("/remove-profile-photo/:id", async (req, res) => {
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

        console.log("Employee Gender:", gender);
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
});

// Route for adding employee via admin manually
router.post("/add-employee-via-admin", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      employeeId,
      gender,
      email,
      username,
      password,
      designation,
      department,
      position,
      employmentType,
      startDate,
    } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Email or username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      password: hashedPassword,
      email,
      status: "Active",
      createdAt: new Date(),
    });
    await user.save();

    const employee = new Employee({
      firstName,
      lastName,
      employeeId,
      email,
      role: user.role,
      type: employmentType,
      gender,
      createdAt: new Date(),
    });
    await employee.save();

    const settings = new Settings({
      userId: user._id,
      general: {
        designation: designation || "",
        department: department || "",
        position: position || "",
        employmentType: employmentType || "",
        startDate: startDate || "",
      },
    });
    await settings.save();

    res.status(201).json({
      message: "Employee account created successfully",
      user,
      employee,
      settings,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

module.exports = router;
