const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const {
  requireAdminPage,
  refuseOwnLinkedEmployee,
  requireAuthenticatedBeforePasswordChange,
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
const { VISIBLE_ROLE } = require("../utils/hiddenAccounts");
const { checkNewPassword } = require("../utils/password");
const { takenRefusal } = require("../utils/takenIdentifiers");
const { ownSettings } = require("../utils/payVisibility");

const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const isFilledString = (value) =>
  typeof value === "string" && value.trim() !== "";

// Why an account that is not Active is refused (sign-in and Forgot password reset use
// the same words), or null for an Active account
const statusRefusal = (user) => {
  if (user.status === "Active") return null;
  if (user.status === "Resigned") return "This account is no longer active.";
  if (user.status === "Inactive") return "This account is disabled.";
  return "Account is pending approval.";
};

// Forgot password answers the same for every email, registered or not, so a code is
// kept for any email typed. The longest address an email can have: anything longer is
// turned away before it is stored.
const MAX_EMAIL_LENGTH = 254;
const FORGOT_PASSWORD_REPLY =
  "If that email is registered, a 6-digit code has been sent to it.";
const INVALID_RESET_TOKEN = "Invalid or expired token";

// The password flag as a boolean (false on accounts created before it existed)
const passwordFlags = (user) => ({
  mustChangePassword: user.mustChangePassword === true,
});

// Fields never sent back in the login and /me replies: the password hash, the reset
// token, and createdBySuperAdmin, a retired field some older records still carry
const stripPrivateFields = (user) => {
  delete user.password;
  delete user.resetToken;
  delete user.createdBySuperAdmin;
  return user;
};

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

    const refusal = statusRefusal(user);
    if (refusal) {
      return res.status(403).json({ message: refusal });
    }

    // A pending password change does not stop the login: the token is issued and
    // every route but /me and change-password answers PASSWORD_CHANGE_REQUIRED.

    // Recorded for the Super Admin's Admins list ("last login")
    user.lastLogin = new Date();
    await User.updateOne(
      { _id: user._id },
      { $set: { lastLogin: user.lastLogin } },
    );

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

    const userObj = stripPrivateFields(user.toObject());

    const combinedData = {
      ...userObj,
      ...passwordFlags(userObj),
      allowedPages: getAllowedPages(userObj),
      employee: employee || null,
      settings: settings ? ownSettings(settings) : null,
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
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Signup route
router.post("/signup", async (req, res) => {
  const { firstName, lastName, email, username, password, gender } = req.body;

  // The password rule, before anything is looked up or created
  const passwordRefusal = checkNewPassword({ next: password, wording: "plain" });
  if (passwordRefusal) {
    return res.status(400).json({ message: passwordRefusal });
  }

  // A username or email another account already uses, in any case, is refused before
  // anything is created
  try {
    const taken = await takenRefusal({ username, email });
    if (taken) {
      return res.status(400).json({ message: taken });
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
      // A self sign-up starts on a basic pay of 0, marked "Pay needs an update" until
      // someone who can see the pay enters the real amount
      settingsData.general = {
        jobDescription: {
          designation: "",
          department: "",
          position: "",
          employmentType: defaultStatus,
          startDate: new Date(),
          basicPay: 0,
          payNotSet: true,
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
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Forgot Password route. The reply never tells whether an account has the email: the
// status, the message, the keys and the one-minute wait are the same either way. Only
// the email itself differs: it goes out when an account has the address.
router.post("/forgot-password", async (req, res) => {
  if (!isFilledString(req.body.email)) {
    return res.status(400).json({ message: "Email is required" });
  }
  const email = req.body.email.trim();
  if (email.length > MAX_EMAIL_LENGTH) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }

  try {
    const user = await User.findOne({ email });

    // A code for every email, so the wait and `expiresAt` do not depend on the lookup.
    // One for an email nobody has is never sent and expires unused.
    const code = issueCode(email);
    if (code.retryAfterMs) {
      return res.status(429).json({
        message: "Please wait a minute before requesting another code.",
      });
    }

    // Not waited for: a registered email is neither slower to answer nor able to show
    // a mail fault. A failed send is logged here on the server.
    if (user) {
      Promise.resolve()
        .then(() => sendEmail(email, code.otp))
        .catch((err) => console.error("Forgot password email error:", err));
    }

    res.status(200).json({
      message: FORGOT_PASSWORD_REPLY,
      expiresAt: code.expiresAt,
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error. Please try again later" });
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

  // The password rule, the same for every account (no database needed, so it is
  // checked first). No "different from the current one" check here.
  const refusal = checkNewPassword({ next: password });
  if (refusal) {
    return res.status(400).json({ message: refusal });
  }

  // Only a token that fails this check is "invalid or expired"; a fault further down
  // is a server error, answered as one
  let email;
  try {
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    if (decoded.purpose !== "reset" || !isFilledString(decoded.email)) {
      return res.status(400).json({ message: INVALID_RESET_TOKEN });
    }
    email = decoded.email;
  } catch (error) {
    console.error("Token verification error:", error.message);
    return res.status(400).json({ message: INVALID_RESET_TOKEN });
  }

  try {
    // No account for the token's email answers like a bad token, so this step does
    // not tell whether an email is registered either
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: INVALID_RESET_TOKEN });
    }

    // An account that may not sign in may not set a new password; nothing is saved
    const statusProblem = statusRefusal(user);
    if (statusProblem) {
      return res.status(403).json({ message: statusProblem });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // The person chose their own password, so a pending forced change is done too
    await User.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword, mustChangePassword: false } },
    );

    res.status(200).json({
      message:
        "Password has been reset successfully. Please log in with your new password.",
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error. Please try again later" });
  }
});

// Change password, for any signed-in account. Also the forced change at first sign-in,
// so it works while `mustChangePassword` is set. Refusals in this order: missing,
// current wrong, too short (the password rule), same as the current one.
router.post(
  "/change-password",
  requireAuthenticatedBeforePasswordChange,
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!isFilledString(currentPassword) || !isFilledString(newPassword)) {
      return res
        .status(400)
        .json({ message: "Current and new password are required." });
    }

    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!(await bcrypt.compare(currentPassword, user.password))) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect." });
      }

      const refusal = checkNewPassword({
        next: newPassword,
        current: currentPassword,
      });
      if (refusal) {
        return res.status(400).json({ message: refusal });
      }

      // save() runs the pre-save hook that hashes the password
      user.password = newPassword;
      user.mustChangePassword = false;
      user.updatedAt = new Date();
      await user.save();

      res
        .status(200)
        .json({ message: "Password changed.", mustChangePassword: false });
    } catch (err) {
      console.error("Change password error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// Route for refresh the signed-in user (works while a password change is pending, so
// the screen can learn it has to show the change-password page)
router.get("/me", requireAuthenticatedBeforePasswordChange, async (req, res) => {
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

    stripPrivateFields(user);

    res.status(200).json({
      user: {
        ...user,
        ...passwordFlags(user),
        allowedPages: getAllowedPages(user),
        employee: employee || null,
        settings: settings ? ownSettings(settings) : null,
        attendance: (attendance || []).map(toClientAttendance),
        leaveRequests: leaveRequests || [],
        overtimeRequests: overtimeRequests || [],
      },
    });
  } catch (err) {
    console.error("Signed-in user refresh error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Route for approving an account by changing its auth status (the "employees" tick).
// The reply never carries the password hash or a reset token.
router.put(
  "/users/:id/status",
  requireAdminPage("employees"),
  refuseOwnLinkedEmployee((req) => req.params.id),
  async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    try {
      // Approves pending accounts only; a resigned employee is reinstated from their
      // profile. A Super Admin or Admin account is hidden: answered as missing
      const result = await User.findOneAndUpdate(
        { _id: id, status: "Pending", role: VISIBLE_ROLE },
        { status: "Active" },
        { new: true },
      )
        .select("-password -resetToken")
        .lean();

      if (!result) {
        return res
          .status(404)
          .json({ error: "No pending account with that id" });
      }

      res.json({ message: "User approved successfully", user: result });
    } catch (error) {
      res.status(500).json({ error: "Failed to approve user" });
    }
  },
);

// List route for pending accounts for the admin approval workflow
router.get("/pending-users", requireAdminPage("employees"), async (req, res) => {
  try {
    const pendingUsers = await User.find({
      status: "Pending",
      role: VISIBLE_ROLE,
    });

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
    console.error("Pending users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
