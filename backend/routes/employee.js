const express = require("express");
const mongoose = require("mongoose");

const {
  requireAdmin,
  requireAdminPage,
  requireSuperAdmin,
  refuseOwnLinkedEmployee,
  requireSignupToken,
} = require("../middleware/accessMiddleware");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const BasicPayChange = require("../models/basicPayChange");

const { checkJobDetails, checkResignation } = require("../utils/jobDetails");
const { payChangesToRecord } = require("../utils/basicPayHistory");
const { manilaToday } = require("../utils/leaveCredits");
const { emitToUsers } = require("../utils/realtime");
const {
  nextEmployeeId,
  createEmployeeAccount,
} = require("../utils/employeeAccount");
const { isAdminRole } = require("../config/roles");
const { isHiddenAccount } = require("../utils/hiddenAccounts");
const { ignoreCase } = require("../utils/ignoreCase");
const { takenRefusal } = require("../utils/takenIdentifiers");
const {
  checkNewPassword,
  forcesPasswordChange,
} = require("../utils/password");

const router = express.Router();

// Super Admin and Admin accounts are hidden: the profile, edit, delete, resign and
// reinstate routes answer for them exactly as for a missing account (404).
//
// Guards: the employee list is open to any Admin (pickers on other pages need it);
// everything else on the Employees screen needs the "employees" tick; delete is Super
// Admin only. An Admin can't edit, resign or reinstate its own linked employee.
const requireEmployeesPage = requireAdminPage("employees");
const notOwnRecord = (param) =>
  refuseOwnLinkedEmployee((req) => req.params[param]);

// Router for getting all the employees data. Only active employees, unless
// ?includeResigned=true (the Employees page lists resigned employees at the bottom).
router.get("/employees", requireAdmin, async (req, res) => {
  const statuses =
    req.query.includeResigned === "true" ? ["Active", "Resigned"] : ["Active"];

  try {
    const employees = await Employee.aggregate([
      {
        $lookup: {
          from: "settings",
          localField: "userId",
          foreignField: "userId",
          as: "settings",
        },
      },
      {
        $unwind: {
          path: "$settings",
          preserveNullAndEmptyArrays: true,
        },
      },
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
          "userDetails.status": { $in: statuses },
          "userDetails.role": "Employee",
        },
      },
      {
        $project: {
          _id: "$userDetails._id",
          employeeId: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          gender: 1,
          username: "$userDetails.username",
          status: "$userDetails.status",
          createdAt: "$userDetails.createdAt",
          jobDescription: {
            $ifNull: [
              "$settings.general.jobDescription",
              {
                designation: "",
                department: "",
                position: "",
                employmentType: "",
                startDate: "",
                regularizationDate: null,
                basicPay: null,
                schedule: { timeIn: "", timeOut: "" },
              },
            ],
          },
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

// One employee's full profile, for the admin profile page
router.get("/employees/:userId", requireEmployeesPage, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const [user, employee, settings] = await Promise.all([
      User.findById(userId)
        .select("username email role status profilePhoto createdAt lastLogin")
        .lean(),
      Employee.findOne({ userId }).lean(),
      Settings.findOne({ userId }).select("general.jobDescription").lean(),
    ]);

    if (!user || isAdminRole(user.role)) {
      return res.status(404).json({ message: "User not found" });
    }

    const job = settings?.general?.jobDescription || {};

    res.status(200).json({
      ...user,
      employee: employee || {},
      jobDescription: {
        designation: job.designation || "",
        department: job.department || "",
        position: job.position || "",
        employmentType: job.employmentType || "",
        startDate: job.startDate || "",
        regularizationDate: job.regularizationDate || "",
        basicPay: job.basicPay ?? null,
        vacationLeaveOpening: job.vacationLeaveOpening || 0,
        resignationDate: job.resignationDate || "",
        resignationReason: job.resignationReason || "",
        schedule: {
          timeIn: job.schedule?.timeIn || "",
          timeOut: job.schedule?.timeOut || "",
        },
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching employee", error: err.message });
  }
});

// Additional Information Route
router.post("/update-info", requireSignupToken, async (req, res) => {
  const {
    birthday,
    contactNumber,
    gender,
    contactFirstName,
    contactLastName,
    contactEmergency,
    contactAddress,
  } = req.body;

  try {
    const employee = await Employee.findOne({ userId: req.signupUserId });
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

    const user = await User.findById(req.signupUserId);
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

// Account Created Route (last signup step, same signup token)
router.get("/created-account/:id", requireSignupToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const employee = await Employee.findOne({
      _id: req.params.id,
      userId: req.signupUserId,
    });

    if (!employee) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      firstName: employee.firstName,
      lastName: employee.lastName,
      gender: employee.gender,
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error. Please try again later.",
      error: err.message,
    });
  }
});

// Route for duplicate user identifiers. Username, email and Employee ID are compared
// ignoring case.
router.post("/check-user-exists", requireEmployeesPage, async (req, res) => {
  const { email, username, employeeId, excludeId } = req.body;
  const result = {};

  if (email) {
    const emailExists = await User.findOne({
      email: ignoreCase(email),
      _id: { $ne: excludeId },
    });
    if (emailExists) result.email = true;
  }

  if (username) {
    const usernameExists = await User.findOne({
      username: ignoreCase(username),
      _id: { $ne: excludeId },
    });
    if (usernameExists) result.username = true;
  }

  if (employeeId) {
    const employeeIdExists = await Employee.findOne({
      employeeId: ignoreCase(employeeId),
      userId: { $ne: excludeId },
    });
    if (employeeIdExists) result.employeeId = true;
  }

  res.json(result);
});

// Route for deleting employee (Super Admin only). The person is also taken off every
// Admin's pay list and unlinked from any Admin.
router.delete(
  "/delete-employee/:employeeId",
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { employeeId } = req.params;

      const employee = await Employee.findOne({ employeeId });
      if (
        !employee ||
        isAdminRole(employee.role) ||
        (await isHiddenAccount(employee.userId))
      ) {
        return res.status(404).json({ message: "Employee not found" });
      }

      await User.deleteOne({ _id: employee.userId });

      await Settings.deleteOne({ userId: employee.userId });

      await Employee.deleteOne({ employeeId });

      await User.updateMany(
        { payAccess: employee.userId },
        { $pull: { payAccess: employee.userId } },
      );
      await User.updateMany(
        { linkedEmployeeId: employee.userId },
        { $unset: { linkedEmployeeId: 1 } },
      );

      res.status(200).json({ message: "Employee deleted successfully" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Internal server error", error: error.message });
    }
  },
);

router.get("/latest-employeeId", requireEmployeesPage, async (req, res) => {
  try {
    const newEmployeeId = await nextEmployeeId();
    res.json({ newEmployeeId });
  } catch (error) {
    console.error("Error fetching latest Employee ID", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch latest employee ID" });
  }
});

// Marks an employee as resigned. They can no longer log in (every route only lets
// Active accounts through), and their attendance, filings and pay records are kept.
router.patch(
  "/employees/:userId/resign",
  requireEmployeesPage,
  notOwnRecord("userId"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }
      if (String(req.user.userId) === userId) {
        return res
          .status(400)
          .json({ message: "You can't mark your own account as resigned." });
      }
      if (await isHiddenAccount(userId)) {
        return res.status(404).json({ message: "User not found" });
      }

      const settings = await Settings.findOne({ userId })
        .select("general.jobDescription")
        .lean();
      const resignation = checkResignation(
        req.body,
        settings?.general?.jobDescription,
      );
      if (resignation.error) {
        return res.status(400).json({ message: resignation.error });
      }

      // The Active filter is part of the update, so it only happens once
      const user = await User.findOneAndUpdate(
        { _id: userId, status: "Active" },
        { status: "Resigned", updatedAt: new Date() },
      );
      if (!user) {
        const exists = await User.exists({ _id: userId });
        return exists
          ? res
              .status(409)
              .json({ message: "Only an active employee can resign." })
          : res.status(404).json({ message: "User not found" });
      }

      await Settings.findOneAndUpdate(
        { userId },
        {
          $set: {
            "general.jobDescription.resignationDate":
              resignation.fields.resignationDate,
            "general.jobDescription.resignationReason":
              resignation.fields.resignationReason,
          },
        },
        { upsert: true },
      );

      res.status(200).json({ message: "Employee marked as resigned" });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to mark as resigned", error: err.message });
    }
  },
);

// Undoes a resignation, e.g. one marked by mistake: the account can log in again
router.patch(
  "/employees/:userId/reinstate",
  requireEmployeesPage,
  notOwnRecord("userId"),
  async (req, res) => {
    try {
      const { userId } = req.params;
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }
      if (await isHiddenAccount(userId)) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = await User.findOneAndUpdate(
        { _id: userId, status: "Resigned" },
        { status: "Active", updatedAt: new Date() },
      );
      if (!user) {
        const exists = await User.exists({ _id: userId });
        return exists
          ? res
              .status(409)
              .json({ message: "Only a resigned employee can be reinstated." })
          : res.status(404).json({ message: "User not found" });
      }

      await Settings.findOneAndUpdate(
        { userId },
        {
          $set: {
            "general.jobDescription.resignationDate": null,
            "general.jobDescription.resignationReason": "",
          },
        },
      );

      res.status(200).json({ message: "Employee reinstated" });
    } catch (err) {
      res
        .status(500)
        .json({ message: "Failed to reinstate", error: err.message });
    }
  },
);

// Route for adding employee via admin manually
router.post("/add-employee-via-admin", requireEmployeesPage, async (req, res) => {
  try {
    // The password rule, whoever adds the employee; checked before anything is created
    const passwordRefusal = checkNewPassword({
      next: req.body.password,
      wording: "plain",
    });
    if (passwordRefusal) {
      return res.status(400).json({ message: passwordRefusal });
    }

    const job = checkJobDetails(req.body);
    if (job.error) {
      return res.status(400).json({ message: job.error });
    }

    // A username, email or Employee ID someone else uses, in any case
    const { username, email, employeeId } = req.body;
    const taken = await takenRefusal({ username, email, employeeId });
    if (taken) {
      return res.status(400).json({ message: taken });
    }

    // Always an Employee-role account; a role or mustChangePassword sent in the body
    // is ignored. The admin chose this password, so the new account must change it
    // at first sign-in.
    const { user, employee, settings } = await createEmployeeAccount(
      req.body,
      job.fields,
      { mustChangePassword: true },
    );

    // Never send the password hash or a reset token back
    const userReply = user.toObject();
    delete userReply.password;
    delete userReply.resetToken;

    res.status(201).json({
      message: "Employee account created successfully",
      user: userReply,
      employee,
      settings,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

router.put(
  "/edit-employee-via-admin/:id",
  requireEmployeesPage,
  notOwnRecord("id"),
  async (req, res) => {
    try {
      const userId = req.params.id;
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ message: "Invalid user id" });
      }

      const {
        username,
        password,
        email,
        designation,
        department,
        position,
        employmentType,
        startDate,
        timeIn,
        timeOut,
      } = req.body;

      const user = await User.findById(userId);
      if (!user || isAdminRole(user.role)) {
        return res.status(404).json({ message: "User not found" });
      }

      const saved = await Settings.findOne({ userId })
        .select("general.jobDescription")
        .lean();
      const job = checkJobDetails(req.body, saved?.general?.jobDescription);
      if (job.error) {
        return res.status(400).json({ message: job.error });
      }

      // A non-empty password is a reset and follows the password rule, whoever is
      // editing; refused before anything is saved. Blank means "no change".
      const resetsPassword = typeof password === "string" && password.trim() !== "";
      if (resetsPassword) {
        const passwordRefusal = checkNewPassword({
          next: password,
          wording: "plain",
        });
        if (passwordRefusal) {
          return res.status(400).json({ message: passwordRefusal });
        }
      }

      // A username, email or Employee ID another account uses, in any case; the
      // employee keeping their own (even in a new case) is fine
      const taken = await takenRefusal(
        { username, email, employeeId: req.body.employeeId },
        userId,
      );
      if (taken) {
        return res.status(400).json({ message: taken });
      }

      if (username !== undefined) user.username = username;
      if (email !== undefined) user.email = email;
      // save() runs the pre-save hook that hashes the password; findByIdAndUpdate would
      // skip the hook and store it in plain text. A password set for someone else must
      // be changed at their next sign-in; one set for the editor's own account does not
      // (the forced-change rule in utils/password.js). Without a password the flag is
      // left as it is.
      if (resetsPassword) {
        user.password = password;
        user.mustChangePassword = forcesPasswordChange({
          setBy: req.user.userId,
          account: user._id,
        });
      }
      await user.save();

      const employeeUpdate = {};
      for (const field of [
        "firstName",
        "lastName",
        "employeeId",
        "email",
        "gender",
        "birthday",
        "contactNumber",
        "address",
        "emergencyDetails",
      ]) {
        if (req.body[field] !== undefined)
          employeeUpdate[field] = req.body[field];
      }
      await Employee.findOneAndUpdate({ userId }, { $set: employeeUpdate });

      const jobUpdate = {};
      const jobFields = {
        designation,
        department,
        position,
        employmentType,
        startDate,
      };
      for (const [field, value] of Object.entries(jobFields)) {
        if (value !== undefined) {
          jobUpdate[`general.jobDescription.${field}`] = value;
        }
      }

      for (const [field, value] of Object.entries(job.fields)) {
        jobUpdate[`general.jobDescription.${field}`] = value;
      }

      if (timeIn !== undefined) {
        jobUpdate["general.jobDescription.schedule.timeIn"] = timeIn;
      }
      if (timeOut !== undefined) {
        jobUpdate["general.jobDescription.schedule.timeOut"] = timeOut;
      }
      if (Object.keys(jobUpdate).length > 0) {
        await Settings.findOneAndUpdate({ userId }, { $set: jobUpdate });
      }

      // A changed basic pay goes into the pay history (13th month uses the pay in force
      // each day). The first change also records the old pay, so earlier days keep it.
      if (job.fields.basicPay !== undefined) {
        const savedJob = saved?.general?.jobDescription || {};
        const todayKey = manilaToday();
        const changes = payChangesToRecord({
          oldPay: savedJob.basicPay,
          newPay: job.fields.basicPay,
          hasHistory: Boolean(await BasicPayChange.exists({ userId })),
          startDate: startDate !== undefined ? startDate : savedJob.startDate,
          todayKey,
        });
        for (const { amount, effectiveFrom } of changes) {
          await BasicPayChange.findOneAndUpdate(
            { userId, effectiveFrom: new Date(`${effectiveFrom}T00:00:00Z`) },
            {
              $set: { amount, changedBy: req.user.userId, changedAt: new Date() },
            },
            { upsert: true, runValidators: true, setDefaultsOnInsert: true },
          );
        }
      }

      // A changed position or department changes the person's logistics roles
      if (position !== undefined || department !== undefined) {
        emitToUsers([userId], "access.changed", { reason: "jobDescription" });
      }

      res.status(200).json({ message: "Employee updated successfully" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Failed to update employee", error: error.message });
    }
  },
);

module.exports = router;
