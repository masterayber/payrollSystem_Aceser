const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");

const router = express.Router();

router.get("/latest-employeeId", async (req, res) => {
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

router.put("/edit-employee-via-admin/:id", async (req, res) => {
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

    // Check if user exists
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update User
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

    // Update Employee
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

    // Update Settings
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

    res.status(200).json({
      message: "Employee updated successfully",
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update employee", error: error.message });
  }
});

module.exports = router;
