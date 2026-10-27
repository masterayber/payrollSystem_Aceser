const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const {
  requireAdmin,
  requireAuthenticated,
} = require("../middleware/accessMiddleware");
const { toClientAttendance } = require("../utils/clientAttendance");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const Attendance = require("../models/attendance");
const LeaveApplication = require("../models/leaveApplication");
const OvertimeApplication = require("../models/overtimeApplication");

const { issueCode, checkCode } = require("../utils/otpStore");

const sendEmail = require("../utils/nodemailer");
const { getAllowedPages } = require("../utils/pageAccess");

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const isFilledString = (value) =>
  typeof value === "string" && value.trim() !== "";

const router = express.Router();

// Login route
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!isFilledString(username) || !isFilledString(password)) {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }

    const user = await User.findOne({ username });
    const isMatch = await bcrypt.compare(
      password,
      user ? user.password : DUMMY_HASH,
    );

    // One reply for an unknown username and a wrong password
    if (!user || !isMatch) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    if (user.status !== "Active") {
      const message =
        user.status === "Resigned"
          ? "This account is no longer active."
          : "Account is pending approval.";
      return res.status(403).json({ message });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "24h",
      },
    );

    const [employee, settings, attendance, leaveRequests, overtimeRequests] =
      await Promise.all([
        Employee.findOne({ userId: user._id }).lean(),
        Settings.findOne({ userId: user._id }).lean(),
        Attendance.find({ userId: user._id }).lean(),
        LeaveApplication.find({ userId: user._id }).lean(),
        OvertimeApplication.find({ userId: user._id }).lean(),
      ]);

    const userObj = user.toObject();
    delete userObj.password;

    const combinedData = {
      ...userObj,
      allowedPages: getAllowedPages(userObj),
      employee: employee || null,
      settings: settings || null,
      attendance: (attendance || []).map(toClientAttendance),
      leaveRequests: leaveRequests || [],
      overtimeRequests: overtimeRequests || [],
    };

    res.status(200).json({
      token,
      user: combinedData,
      message: "Login Successful",
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Signup route
router.post("/signup", async (req, res) => {
  const { firstName, lastName, email, username, password, gender } = req.body;

  // Check if email is already registered to the database
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    const defaultStatus = "Probationary";

    const user = new User({
      username,
      password,
      email,
      role: "Employee",
      status: "Pending",
      createdAt: new Date(),
    });
    await user.save();

    let employeeData = {
      userId: user._id,
      firstName,
      lastName,
      email,
      role: user.role,
      createdAt: new Date(),
    };

    if (user.role === "Employee") {
      const lastEmployee = await Employee.findOne({
        employeeId: { $regex: /^AC-\d+$/ },
      })
        .sort({ employeeId: -1 })
        .collation({ locale: "en_US", numericOrdering: true });

      let newEmployeeId = "AC-001";
      if (lastEmployee && lastEmployee.employeeId) {
        const lastNumber = parseInt(lastEmployee.employeeId.split("-")[1], 10);
        newEmployeeId = `AC-${String(lastNumber + 1).padStart(3, "0")}`;
      }

      employeeData.employeeId = newEmployeeId;
      employeeData.birthday = "";
      employeeData.contactNumber = "";
      employeeData.gender = gender || "Male";
      employeeData.emergencyDetails = {
        contactFirstName: "",
        contactLastName: "",
        contactEmergency: "",
        contactAddress: "",
      };
    }

    const employee = new Employee(employeeData);
    await employee.save();

    let settingsData = {
      userId: user._id,
    };

    if (user.role === "Employee") {
      settingsData.general = {
        jobDescription: {
          designation: "",
          department: "",
          position: "",
          employmentType: defaultStatus,
          startDate: new Date(),
          schedule: {
            timeIn: "",
            timeOut: "",
          },
        },
      };
    }

    const settings = new Settings(settingsData);
    await settings.save();

    // Short-lived token that only lets this new account finish signup
    // (Additional Information and Created Account). authMiddleware rejects it everywhere else.
    const signupToken = jwt.sign(
      { userId: user._id, purpose: "signup" },
      process.env.JWT_SECRET,
      { expiresIn: "30m" },
    );

    res
      .status(200)
      .json({ message: "User created successfully", email, signupToken });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Forgot Password route
router.post("/forgot-password", async (req, res) => {
  if (!isFilledString(req.body.email)) {
    return res.status(400).json({ message: "Email is required" });
  }
  const email = req.body.email.trim();

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Email is not registered" });
    }

    const code = issueCode(email);
    if (code.retryAfterMs) {
      return res.status(429).json({
        message: "Please wait a minute before requesting another code.",
      });
    }

    await sendEmail(email, code.otp);

    res.status(200).json({
      message: "Password reset has been sent to your email",
      expiresAt: code.expiresAt,
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error. Please try again later",
      error: err.message,
    });
  }
});

// OTP route
router.post("/otp", (req, res) => {
  const { email, otp } = req.body;

  // A badly formed code is turned away without using up a try
  if (!isFilledString(email) || !/^\d{6}$/.test(otp)) {
    return res
      .status(400)
      .json({ message: "Enter the 6-digit code from your email." });
  }

  const { result, triesLeft } = checkCode(email.trim(), otp);
  if (result === "locked") {
    return res.status(429).json({
      message: "Too many incorrect codes. Please request a new one.",
    });
  }
  if (result === "expired") {
    return res.status(400).json({
      message: "This code has expired. Please request a new one.",
    });
  }
  if (result === "wrong") {
    return res.status(400).json({
      message: `Incorrect code. ${triesLeft} ${triesLeft === 1 ? "try" : "tries"} left.`,
    });
  }

  // The purpose keeps this token from working as a login, and a login from working here
  const resetToken = jwt.sign(
    { email: email.trim(), purpose: "reset" },
    process.env.JWT_SECRET,
    { expiresIn: "5m" },
  );

  res.status(200).json({ message: "OTP verified.", resetToken });
});

// Reset Password Route
router.post("/reset-password", async (req, res) => {
  const { resetToken, password } = req.body;

  if (!resetToken) {
    return res.status(400).json({ message: "Reset token is required" });
  }

  if (!isFilledString(password)) {
    return res.status(400).json({ message: "Password is required" });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);

    if (decoded.purpose !== "reset") {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

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

// Route for refresh the signed-in user
router.get("/me", requireAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const [employee, settings, attendance, leaveRequests, overtimeRequests] =
      await Promise.all([
        Employee.findOne({ userId: user._id }).lean(),
        Settings.findOne({ userId: user._id }).lean(),
        Attendance.find({ userId: user._id }).lean(),
        LeaveApplication.find({ userId: user._id }).lean(),
        OvertimeApplication.find({ userId: user._id }).lean(),
      ]);

    delete user.password;

    res.status(200).json({
      user: {
        ...user,
        allowedPages: getAllowedPages(user),
        employee: employee || null,
        settings: settings || null,
        attendance: (attendance || []).map(toClientAttendance),
        leaveRequests: leaveRequests || [],
        overtimeRequests: overtimeRequests || [],
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Route for approving an account by changing its auth status
router.put("/users/:id/status", requireAdmin, async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    // Approves pending accounts only; a resigned employee is reinstated from their profile
    const result = await User.findOneAndUpdate(
      { _id: id, status: "Pending" },
      { status: "Active" },
      { new: true },
    );

    if (!result) {
      return res.status(404).json({ error: "No pending account with that id" });
    }

    res.json({ message: "User approved successfully", user: result });
  } catch (error) {
    res.status(500).json({ error: "Failed to approve user" });
  }
});

// List route for pending accounts for the admin approval workflow
router.get("/pending-users", requireAdmin, async (req, res) => {
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
      }),
    );

    res.json(enrichedUsers);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// router.post("/add-employee", requireAdmin, async (req, res) => {
//   const { firstName, lastName, email, username, password, role } = req.body;

//   try {
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({ message: "Email already exists" });
//     }

//     const user = new User({
//       email,
//       username,
//       password,
//       role,
//       status: "Active",
//     });
//     await user.save();

//     const employee = new Employee({
//       firstName,
//       lastName,
//       email,
//       role,
//     });
//     await employee.save();

//     res.status(200).json({ message: "Employee added successfully" });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// });

module.exports = router;
