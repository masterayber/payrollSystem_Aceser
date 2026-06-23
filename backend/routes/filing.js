const express = require("express");
const mongoose = require("mongoose");

const LeaveApplication = require("../models/leaveApplication");
const OvertimeApplication = require("../models/overtimeApplication");
const Attendance = require("../models/attendance");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

const getDateRange = (startDate, endDate) => {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  current.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);

  while (current <= end) {
    const day = current.getUTCDay();

    if (day !== 0 && day !== 6) {
      const yyyy = current.getUTCFullYear();
      const mm = String(current.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(current.getUTCDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
};

router.get("/", auth, async (req, res) => {
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

// Route for applying for leave
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

// Route for editing leave request
router.patch("/edit-leave/:id", auth, async (req, res) => {
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
router.delete("/leave/:id", auth, async (req, res) => {
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
router.patch("/leave/:id/status", auth, async (req, res) => {
  if (req.user.role !== "Admin")
    return res.status(400).json({ msg: "Access Denied" });

  const { status } = req.body;

  try {
    const app = await LeaveApplication.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );

    if (!app) {
      return res.status(404).json({ error: "Leave application not found." });
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
            timeIn: "--:--",
            timeOut: "--:--",
            behavior: "On-Leave",
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
                timeIn: "--:--",
                timeOut: "--:--",
                behavior: "On-Leave",
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
    }

    res.json(app);
  } catch (err) {
    console.error("Error updating leave requests:", err);
    res.status(500).json({ error: err.message });
  }
});

// Route for approving overtime requests of user by admin
// router.patch("/overtime/:id/status", auth, async (req, res) => {
//   if (req.user.role !== "Admin")
//     return res.status(400).json({ msg: "Access Denied" });

//   const { status } = req.body;

//   try {
//     const app = await OvertimeApplication.findByIdAndUpdate(
//       req.params.id,
//       { status },
//       { new: true },
//     );

//     if (!app) {
//       return res.status(404).json({ error: "Leave application not found." });
//     }

//     if (status === "Approved") {

//     }
//   }
// });

// Route for getting the eligible overtime of the user
router.get("/user-overtime-candidates", auth, async (req, res) => {
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
});

// Route for getting overtime requests of the user
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

// Route for applying overtime of the user
router.post("/apply-overtime", auth, async (req, res) => {
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
router.patch("/edit-overtime/:id", auth, async (req, res) => {
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
router.delete("/overtime/:id", auth, async (req, res) => {
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
router.get("/overtime", auth, async (req, res) => {
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
