const express = require("express");

const router = express.Router();

const Attendance = require("../models/attendance");
const Employee = require("../models/employees");
const User = require("../models/authUsers");

// Route Record for Admin
router.get("/attendance", async (req, res) => {
  try {
    const { date } = req.query;

    let attendance;

    if (date) {
      attendance = await Attendance.find({ date: date.trim() });
    } else {
      attendance = await Attendance.find({});
    }

    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route for user's attendance today
router.get("/:userId/today", async (req, res) => {
  try {
    const { userId } = req.params;

    const today = new Date().toISOString().slice(0, 10);

    const attendance = await Attendance.findOne({
      userId,
      date: today,
    });

    if (!attendance) {
      return res
        .status(404)
        .json({ message: "Attendance not found for today" });
    }

    res.json(attendance);
  } catch (error) {
    console.error("Error fetching today's attendance:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:userId/records", async (req, res) => {
  try {
    const { userId } = req.params;
    const attendance = await Attendance.find({ userId });
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const attendanceRecords = await Attendance.find({ userId }).sort({
      date: -1,
    });

    res.json({
      total: attendanceRecords.length,
      data: attendanceRecords,
    });
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/create-blank.today", async (req, res) => {
  try {
    const employees = await Employee.find();
    const today = new Date().toISOString().split("T")[0];
    const createdRecords = [];
    const skippedRecords = [];

    for (const emp of employees) {
      if (emp.role === "Admin") {
        skippedRecords.push({
          name: `${emp.firstName} ${emp.lastName}`,
          reason: "Admin user",
        });
        continue;
      }

      const user = await User.findOne({ email: emp.email });

      if (!user || user.status === "Pending") {
        skippedRecords.push({
          name: `${emp.firstName} ${emp.lastName}`,
          reason: user ? "Pending status" : "User not found",
        });
        continue;
      }

      const existingAttendance = await Attendance.findOne({
        userId: user._id,
        date: today,
      });

      if (!existingAttendance) {
        const newAttendance = await Attendance.create({
          userId: user._id,
          timeIn: "--:--",
          timeOut: "--:--",
          date: today,
        });

        createdRecords.push({
          name: `${emp.firstName} ${emp.lastName}`,
          behavior: newAttendance.behavior,
        });
      } else {
        skippedRecords.push({
          name: `${emp.firstName} ${emp.lastName}`,
          reason: "Record already exists",
        });
      }
    }

    res.json({
      success: true,
      created: createdRecords.length,
      skipped: skippedRecords.length,
      createdRecords,
      skippedRecords,
      date: today,
    });
  } catch (err) {
    console.error("Error creating blank attendance:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
