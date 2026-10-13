const express = require("express");
const mongoose = require("mongoose");

const { requireAdmin } = require("../middleware/accessMiddleware");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");

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
    console.log("User ID:", userId);

    const {
      firstName,
      lastName,
      employeeId,
      email,
      gender,
      designation,
      department,
      position,
      employmentType,
      startDate,
      timeIn,
      timeOut,
      username,
      password,
    } = req.body;

    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const updateUser = await User.findByIdAndUpdate(
      userId,
      {
        username,
        password,
        email,
        gender,
      },
      { new: true },
    );
    console.log("Updated User:", updateUser);

    const updateEmployee = await Employee.findOneAndUpdate(
      { userId },
      {
        firstName,
        lastName,
        employeeId,
        email,
        gender,
      },
      { new: true },
    );
    console.log("Updated Employee:", updateEmployee);

    await Settings.findOneAndUpdate(
      { userId },
      {
        $set: {
          "general.jobDescription.designation": designation,
          "general.jobDescription.department": department,
          "general.jobDescription.position": position,
          "general.jobDescription.employmentType": employmentType,
          "general.jobDescription.startDate": startDate,
          "general.jobDescription.schedule.timeIn": timeIn,
          "general.jobDescription.schedule.timeOut": timeOut,
        },
      },
      { new: true },
    );

    res.status(200).json({ message: "Employee updated successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update employee", error: error.message });
  }
});

module.exports = router;
