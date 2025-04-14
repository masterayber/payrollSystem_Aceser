const express = require("express");

const router = express.Router();

const Attendance = require("../models/attendance");

router.get("/attendance", async (req, res) => {
  try {
    const { date } = req.query;

    let attendance;

    if (date) {
      attendance = await Attendance.find({ date: date.trim() });
      console.log("Filtered by date:", date);
    } else {
      attendance = await Attendance.find({});
      console.log("Returning all attendance records");
    }

    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// router.get("/today", async (req, res) => {
//   try {
//     const today = new Date();
//     const formattedToday = today.toISOString().split("T")[0].trim();

//     console.log("Today's date:", formattedToday);

//     const todayAttendance = await Attendance.find({ date: formattedToday });
//     console.log("Today's Attendance:", todayAttendance);
//     res.json(todayAttendance);
//   } catch (error) {
//     res.json(500).json({ error: "Failed to fetch today's attendance" });
//   }
// });

module.exports = router;
