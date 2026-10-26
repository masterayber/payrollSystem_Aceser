const express = require("express");
const mongoose = require("mongoose");

const {
  requireAdmin,
  requireSignupToken,
} = require("../middleware/accessMiddleware");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");

const { checkJobDetails } = require("../utils/jobDetails");

const router = express.Router();

// Router for getting all the employees data
router.get("/employees", requireAdmin, async (req, res) => {
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
          "userDetails.status": "Active",
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
router.get("/employees/:userId", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const [user, employee, settings] = await Promise.all([
      User.findById(userId)
        .select("username email role status profilePhoto createAt lastLogin")
        .lean(),
      Employee.findOne({ userId }).lean(),
      Settings.findOne({ userId }).select("general.jobDescription").lean(),
    ]);

    if (!user) {
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

// Route for duplicate user identifiers
router.post("/check-user-exists", requireAdmin, async (req, res) => {
  const { email, username, employeeId, excludeId } = req.body;
  const result = {};

  if (email) {
    const emailExists = await User.findOne({ email, _id: { $ne: excludeId } });
    if (emailExists) result.email = true;
  }

  if (username) {
    const usernameExists = await User.findOne({
      username,
      _id: { $ne: excludeId },
    });
    if (usernameExists) result.username = true;
  }

  if (employeeId) {
    const employeeIdExists = await Employee.findOne({
      employeeId,
      userId: { $ne: excludeId },
    });
    if (employeeIdExists) result.employeeId = true;
  }

  res.json(result);
});

// Route for deleting employee
router.delete(
  "/delete-employee/:employeeId",
  requireAdmin,
  async (req, res) => {
    try {
      const { employeeId } = req.params;

      const employee = await Employee.findOne({ employeeId });
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      await User.deleteOne({ _id: employee.userId });

      await Settings.deleteOne({ userId: employee.userId });

      await Employee.deleteOne({ employeeId });

      res.status(200).json({ message: "Employee deleted successfully" });
    } catch (error) {
      res
        .status(500)
        .json({ message: "Internal server error", error: error.message });
    }
  },
);

router.get("/latest-employeeId", requireAdmin, async (req, res) => {
  try {
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

    res.json({ newEmployeeId });
  } catch (error) {
    console.error("Error fetching latest Employee ID", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch latest employee ID" });
  }
});

// Route for adding employee via admin manually
router.post("/add-employee-via-admin", requireAdmin, async (req, res) => {
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
      timeIn,
      timeOut,
    } = req.body;

    const job = checkJobDetails(req.body);
    if (job.error) {
      return res.status(400).json({ message: job.error });
    }

    const user = new User({
      username,
      password,
      email,
      role: "Employee",
      status: "Active",
      createdAt: new Date(),
    });
    await user.save();

    let employeeData = {
      userId: user._id,
      firstName,
      lastName,
      employeeId,
      email,
      gender,
      role: user.role,
      birthday: "",
      contactNumber: "",
      emergencyDetails: {
        contactFirstName: "",
        contactLastName: "",
        contactEmergency: "",
        contactAddress: "",
      },
      createdAt: new Date(),
    };

    const employee = new Employee(employeeData);
    await employee.save();

    const settings = new Settings({
      userId: user._id,
      general: {
        jobDescription: {
          designation: designation,
          department: department,
          position: position,
          employmentType: employmentType,
          startDate: startDate,
          ...job.fields,
          schedule: {
            timeIn: timeIn,
            timeOut: timeOut,
          },
        },
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

router.put("/edit-employee-via-admin/:id", requireAdmin, async (req, res) => {
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
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const saved = await Settings.findOne({ userId })
      .select("general.jobDescription")
      .lean();
    const job = checkJobDetails(req.body, saved?.general?.jobDescription);
    if (job.error) {
      return res.status(400).json({ message: job.error });
    }

    if (username !== undefined) user.username = username;
    if (email !== undefined) user.email = email;
    // A non-empty password is a reset. save() runs the pre-save hook that hashes
    // it; findByIdAndUpdate would skip the hook and store it in plain text.
    if (typeof password === "string" && password.trim() !== "") {
      user.password = password;
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

    res.status(200).json({ message: "Employee updated successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update employee", error: error.message });
  }
});

module.exports = router;
