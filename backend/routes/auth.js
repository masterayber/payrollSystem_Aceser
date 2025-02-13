const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/user");
const Employee = require("../models/employees");
const sendEmail = require("../utils/nodemailer");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
const JWT_SECRET = "your_jwt_secret_key_here";

let otpStorage = {}; // Temporarily stores OTPs for demonstration

// Signup route
router.post("/signup", async (req, res) => {
  // Extract data from the request body
  const { firstName, lastName, email, username, password, role } = req.body;

  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    // Create user in `users` collection
    const user = new User({
      email,
      username,
      password,
      role, //Optional
    });
    await user.save();

    // Create corresponding employee in 'employees' collection
    const newEmployee = new Employee({
      firstName,
      lastName,
      email,
    });
    await newEmployee.save();

    res.status(200).json({ message: "User created successfully", email });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Login route
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "Invalid Username" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid Password" });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    });

    const employee = await Employee.findOne({ email: user.email });

    const userObj = user.toObject();
    delete userObj.password;
    const employeeObj = employee ? employee.toObject() : {};

    const combinedData = {
      ...userObj,
      firstName: employeeObj.firstName,
      lastName: employeeObj.lastName,
      gender: employeeObj.gender,
    };

    res
      .status(200)
      .json({ token, user: combinedData, message: "Login successful" });
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
    address,
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

    // Update employee details
    employee.address = address;
    employee.birthday = birthday;
    employee.contactNumber = contactNumber;
    employee.gender = gender;
    employee.contactFirstName = contactFirstName;
    employee.contactLastName = contactLastName;
    employee.contactEmergency = contactEmergency;
    employee.contactAddress = contactAddress;

    await employee.save();

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

module.exports = router;
