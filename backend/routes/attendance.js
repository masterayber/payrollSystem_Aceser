const express = require("express");

const router = express.Router();

const Attendance = require("../models/attendance");

// Route Record for Admin
router.get("/attendance", async (req, res) => {
  try {
    const { date } = req.query;

    let attendance;

    if (date) {
      attendance = await Attendance.find({ date: date.trim() });
      console.log("Filtered by date:", date);
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
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const total = await Attendance.countDocuments({ userId });
    const attendanceRecords = await Attendance.find({ userId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: attendanceRecords,
    });
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
