const express = require("express");
const mongoose = require("mongoose");

const LeaveApplication = require("../models/leaveApplication");
const OvertimeApplication = require("../models/overtimeApplication");
const Attendance = require("../models/attendance");
const Settings = require("../models/settings");
const { requirePage, requireAdmin } = require("../middleware/accessMiddleware");
const { isAdminRole } = require("../config/roles");
const {
  findVisibleUser,
  isHiddenAccount,
  hiddenUserIds,
} = require("../utils/hiddenAccounts");

const {
  CREDIT_LEAVE_TYPES,
  toDateKey,
  manilaToday,
  leaveBalance,
  checkLeaveDates,
  checkLeaveCredits,
} = require("../utils/leaveCredits");

const router = express.Router();

// After a Pending-only update or delete matched nothing: 404 if the request isn't the
// caller's, 409 if it is but an admin already decided it.
const respondNotPending = async (res, Model, id, userId, label) => {
  const existing = await Model.findOne({ _id: id, userId })
    .select("status")
    .lean();

  if (!existing) {
    return res.status(404).json({ error: `${label} not found.` });
  }

  return res.status(409).json({
    error: `This ${label.toLowerCase()} was already ${existing.status.toLowerCase()}, so it can't be changed.`,
  });
};

// The job description and VL/SL requests an employee's leave credits are worked out from.
// `excludeId` leaves out the request being edited or approved.
const loadCreditData = async (userId, excludeId) => {
  const [settings, leaves] = await Promise.all([
    Settings.findOne({ userId }).select("general.jobDescription").lean(),
    LeaveApplication.find({
      userId,
      leaveType: { $in: CREDIT_LEAVE_TYPES },
      status: { $in: ["Pending", "Approved"] },
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).lean(),
  ]);
  return { job: settings?.general?.jobDescription || {}, leaves };
};

// Why a VL or SL request doesn't fit the employee's credits, or null when it does
const creditError = async (userId, request, excludeId) => {
  if (!CREDIT_LEAVE_TYPES.includes(request.leaveType)) return null;
  const { job, leaves } = await loadCreditData(userId, excludeId);
  return checkLeaveCredits(job, leaves, request);
};

// The attendance day an overtime request points to must be the caller's own, eligible
// for overtime, and not already used by another request. `keepAttendanceId` is the day
// the request already uses when editing, which is allowed to stay filed.
// Returns an error message, or null when the day is fine.
const checkOvertimeDay = async (attendanceId, userId, keepAttendanceId) => {
  if (!attendanceId) return null;

  if (!mongoose.isValidObjectId(attendanceId)) {
    return "Invalid attendance record.";
  }

  const day = await Attendance.findOne({
    _id: attendanceId,
    userId,
    "overtime.isEligible": true,
  })
    .select("overtime.isFiled")
    .lean();

  if (!day) {
    return "That day isn't one of your overtime days.";
  }

  if (day.overtime?.isFiled && attendanceId.toString() !== keepAttendanceId) {
    return "Overtime for that day is already filed.";
  }

  return null;
};

// The role is read from the database (requireAdmin loads it), not from the token,
// so a token issued before a role change still works
router.get("/", requireAdmin, async (req, res) => {
  if (!isAdminRole(req.currentUser.role))
    return res.status(400).json({ msg: "Access Denied" });

  // Super Admin and Admin requests never show in the list
  const apps = await LeaveApplication.aggregate([
    { $match: { userId: { $nin: await hiddenUserIds() } } },
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

// The caller's own VL and SL balance
router.get("/leave-credits", requirePage("filing"), async (req, res) => {
  try {
    const { job, leaves } = await loadCreditData(req.user.userId);
    res.json(leaveBalance(job, leaves, manilaToday()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// An employee's VL and SL balance, for the admin profile page
router.get("/leave-credits/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ error: "Invalid user ID." });
  }

  try {
    // A missing account and a hidden one (Super Admin or Admin) have no credits
    if (!(await findVisibleUser(userId))) {
      return res.status(404).json({ error: "User not found." });
    }

    const { job, leaves } = await loadCreditData(userId);
    res.json(leaveBalance(job, leaves, manilaToday()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route for applying for leave. VL and SL must fit the employee's credits.
router.post("/apply-leave", requirePage("filing"), async (req, res) => {
  const { leaveType, leaveDetails, startDate, endDate } = req.body;

  const dates = checkLeaveDates({ startDate, endDate });
  if (dates.error) {
    return res.status(400).json({ error: dates.error });
  }

  try {
    const error = await creditError(req.user.userId, { leaveType, ...dates });
    if (error) {
      return res.status(400).json({ error });
    }

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

// Route for editing leave request. A change of type or dates is checked again.
router.patch("/edit-leave/:id", requirePage("filing"), async (req, res) => {
  const { leaveType, leaveDetails, startDate, endDate } = req.body;

  try {
    const current =
      [leaveType, startDate, endDate].some((value) => value !== undefined) &&
      (await LeaveApplication.findOne({
        _id: req.params.id,
        userId: req.user.userId,
        status: "Pending",
      }).lean());

    // Not found or no longer Pending: the update below answers 404 or 409
    if (current) {
      const dates = checkLeaveDates({
        startDate: startDate ?? toDateKey(current.startDate),
        endDate: endDate ?? toDateKey(current.endDate),
      });
      if (dates.error) {
        return res.status(400).json({ error: dates.error });
      }

      const error = await creditError(
        req.user.userId,
        { leaveType: leaveType ?? current.leaveType, ...dates },
        current._id,
      );
      if (error) {
        return res.status(400).json({ error });
      }
    }

    const updatedLeave = await LeaveApplication.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId, status: "Pending" },
      {
        leaveType,
        leaveDetails,
        startDate,
        endDate,
      },
      { new: true },
    );

    if (!updatedLeave) {
      return respondNotPending(
        res,
        LeaveApplication,
        req.params.id,
        req.user.userId,
        "Leave request",
      );
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
      status: "Pending",
    });

    if (!leave) {
      return respondNotPending(
        res,
        LeaveApplication,
        req.params.id,
        req.user.userId,
        "Leave request",
      );
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
    // A Super Admin or Admin request is hidden: answered as missing
    const owner = await LeaveApplication.findById(id).select("userId").lean();
    if (owner && (await isHiddenAccount(owner.userId))) {
      return res.status(404).json({ error: "Leave application not found." });
    }

    // VL and SL are checked again: the credits may have changed since it was filed
    if (status === "Approved") {
      const pending = await LeaveApplication.findOne({
        _id: id,
        status: "Pending",
      }).lean();

      if (pending) {
        const error = await creditError(
          pending.userId,
          {
            leaveType: pending.leaveType,
            startKey: toDateKey(pending.startDate),
            endKey: toDateKey(pending.endDate),
          },
          pending._id,
        );
        if (error) {
          return res.status(409).json({ error });
        }
      }
    }

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
    // A Super Admin or Admin request is hidden: answered as missing
    const owner = await OvertimeApplication.findById(id).select("userId").lean();
    if (owner && (await isHiddenAccount(owner.userId))) {
      return res.status(404).json({ error: "Overtime request not found." });
    }

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
    const dayError = await checkOvertimeDay(attendanceId, req.user.userId);
    if (dayError) {
      return res.status(400).json({ error: dayError });
    }

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

    if (existingApp.status !== "Pending") {
      return res.status(409).json({
        error: `This overtime request was already ${existingApp.status.toLowerCase()}, so it can't be changed.`,
      });
    }

    const previousAttendanceId = existingApp.attendanceId?.toString();

    const dayError = await checkOvertimeDay(
      attendanceId,
      req.user.userId,
      previousAttendanceId,
    );
    if (dayError) {
      return res.status(400).json({ error: dayError });
    }

    const updatedApp = await OvertimeApplication.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId, status: "Pending" },
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
      return respondNotPending(
        res,
        OvertimeApplication,
        req.params.id,
        req.user.userId,
        "Overtime request",
      );
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
      status: "Pending",
    });

    if (!overtime) {
      return respondNotPending(
        res,
        OvertimeApplication,
        req.params.id,
        req.user.userId,
        "Overtime request",
      );
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
  if (!isAdminRole(req.currentUser.role))
    return res.status(400).json({ msg: "Access Denied" });

  // Super Admin and Admin requests never show in the list
  const apps = await OvertimeApplication.aggregate([
    { $match: { userId: { $nin: await hiddenUserIds() } } },
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
