const express = require("express");
const mongoose = require("mongoose");

const LeaveApplication = require("../models/leaveApplication");
const OvertimeApplication = require("../models/overtimeApplication");
const Attendance = require("../models/attendance");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/apply-leave", auth, async (req, res) => {
  const { leaveType, leaveDetails, startDate, endDate } = req.body;

  try {
    const app = new LeaveApplication({
      userId: req.user.userId,
      leaveType,
      leaveDetails,
      startDate,
      endDate,
    });
    await app.save();
    res.status(201).json(app);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/user-leave-requests", auth, async (req, res) => {
  try {
    const leaveRequests = await LeaveApplication.find({
      userId: req.user.userId,
    }).sort({
      appliedAt: -1,
    });

    res.json(leaveRequests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/", auth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(400).json({ msg: "Access Denied" });
  const apps = await LeaveApplication.find().populate("userId", "name email");
  res.json(apps);
});

router.patch("/:id/status", auth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(400).json({ msg: "Access Denied" });
  const { status } = req.body;
  const app = await LeaveApplication.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true },
  );
  res.json(app);
});

router.get("/user-overtime-candidates", auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const attendance = await Attendance.find({
      userId,
      "overtime.isEligible": true,
      "overtime.isFiled": false,
    });

    res.json(attendance);
  } catch (error) {
    console.error("Error fetching overtime:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

router.post("/apply-overtime", auth, async (req, res) => {
  const { selectedOvertime, start, end, overtimeDetails } = req.body;

  try {
    const app = new OvertimeApplication({
      userId: req.user.userId,
      selectedOvertime,
      start,
      end,
      overtimeDetails,
    });
    await app.save();

    if (req.body.overtimeId) {
      await Attendance.findByIdAndUpdate(
        req.body.overtimeId,
        { "overtime.isFiled": true },
        { new: true },
      );
    }

    res.status(201).json(app);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/user-overtime-requests", auth, async (req, res) => {
  try {
    const overtimeRequests = await OvertimeApplication.find({
      userId: req.user.userId,
    }).sort({
      appliedAt: -1,
    });

    res.json(overtimeRequests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
