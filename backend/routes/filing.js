const express = require("express");
const mongoose = require("mongoose");

const LeaveApplication = require("../models/leaveApplication");
const OvertimeApplication = require("../models/overtimeApplication");
const Attendance = require("../models/attendance");
const auth = require("../middleware/authMiddleware");
const { requirePage, requireAdmin } = require("../middleware/accessMiddleware");

const router = express.Router();

router.get("/", requireAdmin, async (req, res) => {
  if (req.user.role !== "Admin")
    return res.status(400).json({ msg: "Access Denied" });

  const apps = await LeaveApplication.aggregate([
    {
      $lookup: {
        from: "employees",
        localField: "userId",
        foreignField: "userId",
        as: "employee",
      },
    },
    {
      $unwind: {
        path: "$employee",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        leaveType: 1,
        leaveDetails: 1,
        startDate: 1,
        endDate: 1,
        status: 1,
        appliedAt: 1,
        employeeFirstName: "$employee.firstName",
        employeeLastName: "$employee.lastName",
        employeeEmail: "$employee.email",
      },
    },
    { $sort: { appliedAt: -1 } },
  ]);

  res.json(apps);
});

// Route for getting all the leave requests of the user
router.get("/user-leave-requests", requirePage("filing"), async (req, res) => {
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

// Route for applying for leave
router.post("/apply-leave", requirePage("filing"), async (req, res) => {
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

// Route for editing leave request
router.patch("/edit-leave/:id", requirePage("filing"), async (req, res) => {
  const { leaveType, leaveDetails, startDate, endDate } = req.body;

  try {
    const updatedLeave = await LeaveApplication.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      {
        leaveType,
        leaveDetails,
        startDate,
        endDate,
      },
      { new: true },
    );

    if (!updatedLeave) {
      return res.status(404).json({ error: "Leave request not found." });
    }

    res.json(updatedLeave);
  } catch (err) {
    console.error({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Route for deleting leave request of the user
router.delete("/leave/:id", requirePage("filing"), async (req, res) => {
  try {
    const leave = await LeaveApplication.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!leave) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    res.json({ message: "Leave request deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route for approving leave requests of user by admin
const LEAVE_DECISIONS = ["Approved", "Disapproved"];

router.patch("/leave/:id/status", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid leave application ID." });
  }

  // An admin can only make a decision. Moving a request back to "Pending" is not allowed.
  if (!LEAVE_DECISIONS.includes(status)) {
    return res.status(400).json({
      error: `Status must be one of: ${LEAVE_DECISIONS.join(", ")}.`,
    });
  }

  try {
    // The Pending filter is part of the update itself, so two admins acting on the same
    // request at the same time cannot both succeed.
    const app = await LeaveApplication.findOneAndUpdate(
      { _id: id, status: "Pending" },
      { status },
      { new: true, runValidators: true },
    );

    if (!app) {
      const existing = await LeaveApplication.findById(id).select("status");

      if (!existing) {
        return res.status(404).json({ error: "Leave application not found." });
      }

      return res.status(409).json({
        error: `This leave application was already ${existing.status.toLowerCase()}.`,
      });
    }

    if (status === "Approved") {
      const startDate = new Date(app.startDate);
      const endDate = new Date(app.endDate);

      const newAttendanceRecords = [];
      const updatePromises = [];

      for (
        let currentDate = new Date(startDate);
        currentDate <= endDate;
        currentDate.setDate(currentDate.getDate() + 1)
      ) {
        const formattedDate = currentDate.toISOString().split("T")[0];

        const existingAttendance = await Attendance.findOne({
          userId: app.userId,
          date: formattedDate,
        });

        if (!existingAttendance) {
          newAttendanceRecords.push({
            userId: app.userId,
            date: formattedDate,
            timeIn: null,
            timeOut: null,
            behavior: "On-Leave",
            leaveType: app.leaveType,
            overtime: {
              isEligible: false,
              hours: 0,
              isFiled: false,
            },
          });
        } else if (existingAttendance.behavior !== "On-Leave") {
          updatePromises.push(
            Attendance.findOneAndUpdate(
              { _id: existingAttendance._id },
              {
                timeIn: null,
                timeOut: null,
                behavior: "On-Leave",
                leaveType: app.leaveType,
                overtime: {
                  isEligible: false,
                  hours: 0,
                  isFiled: false,
                },
              },
            ),
          );
        }
      }

      if (newAttendanceRecords.length > 0) {
        await Attendance.insertMany(newAttendanceRecords);
      }

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }
    } else if (status === "Disapproved") {
      const dateKey = (date) => new Date(date).toISOString().split("T")[0];
      const startDateKey = dateKey(app.startDate);
      const endDateKey = dateKey(app.endDate);
      const startDate = new Date(`${startDateKey}T00:00:00.000Z`);
      const endDate = new Date(`${endDateKey}T23:59:59.999Z`);
      const todayKey = dateKey(new Date());

      const [attendanceRecords, otherApprovedLeaves] = await Promise.all([
        Attendance.find({
          userId: app.userId,
          behavior: "On-Leave",
          date: { $gte: startDate, $lte: endDate },
        }).select("_id date"),
        LeaveApplication.find({
          _id: { $ne: app._id },
          userId: app.userId,
          status: "Approved",
          startDate: { $lte: endDate },
          endDate: { $gte: startDate },
        }).select("startDate endDate"),
      ]);

      const activeLeaveRanges = otherApprovedLeaves.map((leave) => ({
        start: dateKey(leave.startDate),
        end: dateKey(leave.endDate),
      }));

      await Promise.all(
        attendanceRecords.map((record) => {
          const recordDateKey = dateKey(record.date);
          const coveredByOtherLeave = activeLeaveRanges.some(
            (range) =>
              range.start <= recordDateKey && recordDateKey <= range.end,
          );

          if (coveredByOtherLeave) {
            return Promise.resolve();
          }

          if (recordDateKey < todayKey) {
            return Attendance.findByIdAndUpdate(record._id, {
              timeIn: null,
              timeOut: null,
              behavior: "Absent",
              leaveType: null,
              overtime: {
                isEligible: false,
                hours: 0,
                start: null,
                end: null,
                isFiled: false,
              },
            });
          }

          return Attendance.findByIdAndDelete(record._id);
        }),
      );
    }

    res.json(app);
  } catch (err) {
    console.error("Error updating leave requests:", err);
    res.status(500).json({ error: err.message });
  }
});

// Route for approving or disapproving an overtime request (admin only)
const OVERTIME_DECISIONS = ["Approved", "Disapproved"];

router.patch("/overtime/:id/status", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid overtime request ID." });
  }

  // An admin can only make a decision. Moving a request back to "Pending" is not allowed.
  if (!OVERTIME_DECISIONS.includes(status)) {
    return res.status(400).json({
      error: `Status must be one of: ${OVERTIME_DECISIONS.join(", ")}.`,
    });
  }

  try {
    // The Pending filter is part of the update itself, so two admins acting on the same
    // request at the same time cannot both succeed.
    const app = await OvertimeApplication.findOneAndUpdate(
      { _id: id, status: "Pending" },
      { status },
      { new: true, runValidators: true },
    );

    if (!app) {
      const existing = await OvertimeApplication.findById(id).select("status");

      if (!existing) {
        return res.status(404).json({ error: "Overtime request not found." });
      }

      return res.status(409).json({
        error: `This overtime request was already ${existing.status.toLowerCase()}.`,
      });
    }

    // A disapproved request frees the day again, so the employee can file a corrected
    // one. An approved request keeps the day marked as filed.
    if (status === "Disapproved" && app.attendanceId) {
      try {
        await Attendance.findByIdAndUpdate(app.attendanceId, {
          "overtime.isFiled": false,
        });
      } catch (attendanceError) {
        console.error(
          "Overtime disapproved, but its attendance record could not be released:",
          attendanceError,
        );
      }
    }

    res.json(app);
  } catch (err) {
    console.error("Error updating overtime request:", err);
    res.status(500).json({ error: err.message });
  }
});

// Route for getting the eligible overtime of the user
router.get(
  "/user-overtime-candidates",
  requirePage("filing"),
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { mode } = req.query;

      const query = {
        userId,
        "overtime.isEligible": true,
      };

      if (mode !== "edit") {
        query["overtime.isFiled"] = false;
      }

      const attendance = await Attendance.find(query);

      res.json(attendance);
    } catch (error) {
      console.error("Error fetching overtime:", error);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

// Route for getting overtime requests of the user
router.get(
  "/user-overtime-requests",
  requirePage("filing"),
  async (req, res) => {
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
  },
);

// Route for applying overtime of the user
router.post("/apply-overtime", requirePage("filing"), async (req, res) => {
  const { attendanceId, selectedOvertime, start, end, overtimeDetails } =
    req.body;

  try {
    const app = new OvertimeApplication({
      userId: req.user.userId,
      attendanceId,
      selectedOvertime,
      start,
      end,
      overtimeDetails,
    });
    await app.save();

    if (attendanceId) {
      await Attendance.findByIdAndUpdate(
        attendanceId,
        { "overtime.isFiled": true },
        { new: true },
      );
    }

    res.status(201).json(app);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route for editing overtime of the user
router.patch("/edit-overtime/:id", requirePage("filing"), async (req, res) => {
  const { attendanceId, selectedOvertime, start, end, overtimeDetails } =
    req.body;

  try {
    const existingApp = await OvertimeApplication.findOne({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!existingApp) {
      return res.status(404).json({ error: "Overtime request not found." });
    }

    const previousAttendanceId = existingApp.attendanceId?.toString();

    const updatedApp = await OvertimeApplication.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      {
        attendanceId,
        selectedOvertime,
        start,
        end,
        overtimeDetails,
      },
      { new: true },
    );

    if (!updatedApp) {
      return res.status(404).json({ error: "Overtime request not found." });
    }

    if (
      previousAttendanceId &&
      previousAttendanceId !== attendanceId?.toString()
    ) {
      await Attendance.findByIdAndUpdate(previousAttendanceId, {
        "overtime.isFiled": false,
      });
    }

    if (attendanceId) {
      await Attendance.findByIdAndUpdate(attendanceId, {
        "overtime.isFiled": true,
      });
    }

    res.json(updatedApp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route for deleting pending overtime by user
router.delete("/overtime/:id", requirePage("filing"), async (req, res) => {
  try {
    const overtime = await OvertimeApplication.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!overtime) {
      return res.status(404).json({ error: "Overtime request not found" });
    }

    const attendanceId = overtime.attendanceId;
    if (attendanceId) {
      await Attendance.findByIdAndUpdate(
        attendanceId,
        { "overtime.isFiled": false },
        { new: true },
      );
    }

    res.json({ message: "Overtime request deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route for getting the overtime of all users
router.get("/overtime", requireAdmin, async (req, res) => {
  if (req.user.role !== "Admin")
    return res.status(400).json({ msg: "Access Denied" });

  const apps = await OvertimeApplication.aggregate([
    {
      $lookup: {
        from: "employees",
        localField: "userId",
        foreignField: "userId",
        as: "employee",
      },
    },
    {
      $unwind: {
        path: "$employee",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        selectedOvertime: 1,
        overtimeDetails: 1,
        start: 1,
        end: 1,
        status: 1,
        appliedAt: 1,
        employeeFirstName: "$employee.firstName",
        employeeLastName: "$employee.lastName",
        employeeEmail: "$employee.email",
      },
    },
    { $sort: { appliedAt: -1 } },
  ]);

  res.json(apps);
});

module.exports = router;
