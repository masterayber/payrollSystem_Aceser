const express = require("express");

const router = express.Router();

const Attendance = require("../models/attendance");
const Employee = require("../models/employees");
const User = require("../models/authUsers");

const ZKTecoService = require("../utils/zktecoService");

const toLocalDateString = (dateValue) => {
  const offsetAdjustedDate = new Date(
    dateValue.getTime() - dateValue.getTimezoneOffset() * 60000,
  );

  return offsetAdjustedDate.toISOString().split("T")[0];
};

const createDateTime = (date, time) => new Date(`${date}T${time}Z`);

const normalizeToString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const parsedZkTime = (value) => {
  if (!value) return null;

  const raw = normalizeToString(value);
  if (!raw) return null;

  const isoCandidate = raw.includes("T") ? raw : raw.replace(" ", "T");

  const parsed = new Date(isoCandidate);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const [datePart, timePart] = raw.split(/[T\s]/);
  if (!datePart || !timePart) return null;

  const timeDate = new Date(`${datePart}T${timePart}`);
  if (!Number.isNaN(timeDate.getTime())) return timeDate;

  return null;
};

const extractDevicePunch = (payload) => {
  if (!payload) return null;

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed);
      return extractDevicePunch(parsed);
    } catch {
      const xmlMatch = {
        userId:
          trimmed.match(
            /<(?:PIN|USERID|UID|UserId|EmployeeID|EmployeeId)>(.*?)<\/(?:PIN|USERID|UID|UserId|EmployeeID|EmployeeId)>/i,
          )?.[1] ||
          trimmed.match(/(?:PIN|USERID|UID|EmployeeID)[=: ](\d+)/i)?.[1],
        dateTime:
          trimmed.match(
            /<(?:DateTime|DateTime2|Time|CheckTime|PunchTime|Date|DateTimeStamp)>(.*?)<\/(?:DateTime|DateTime2|Time|CheckTime|PunchTime|Date|DateTimeStamp)>/i,
          )?.[1] ||
          trimmed.match(
            /(?:DateTime|CheckTime|PunchTime|DateTimeStamp)[=: ]([^\s&<]+)/i,
          )?.[1],
        state:
          trimmed.match(
            /<(?:Status|State|Type|VerifyMode|CheckType|EventType)>(.*?)<\/(?:Status|State|Type|VerifyMode|CheckType|EventType)>/i,
          )?.[1] ||
          trimmed.match(
            /(?:Status|State|Type|VerifyMode|CheckType|EventType)[=: ]([^\s&<]+)/i,
          )?.[1],
      };

      if (xmlMatch.userId || xmlMatch.dateTime) {
        return xmlMatch;
      }

      return null;
    }
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const result = extractDevicePunch(item);
      if (result) return result;
    }
    return null;
  }

  const candidate = {
    userId:
      payload.userId ||
      payload.UserID ||
      payload.PIN ||
      payload.uid ||
      payload.employeeId ||
      payload.EmployeeID ||
      payload.UserID ||
      payload.userid ||
      payload.uid ||
      payload.user ||
      payload.user_id,
    dateTime:
      payload.dateTime ||
      payload.DateTime ||
      payload.checkTime ||
      payload.CheckTime ||
      payload.punchTime ||
      payload.PunchTime ||
      payload.timestamp ||
      payload.Timestamp ||
      payload.time ||
      payload.Time ||
      payload.date ||
      payload.Date,
    state:
      payload.state ||
      payload.State ||
      payload.type ||
      payload.Type ||
      payload.status ||
      payload.Status ||
      payload.eventType ||
      payload.EventType ||
      payload.checkType ||
      payload.CheckType,
  };

  if (candidate.userId || candidate.dateTime) {
    return candidate;
  }

  const possibleEntries = Object.values(payload || {});
  for (const value of possibleEntries) {
    const nested = extractDevicePunch(value);
    if (nested) return nested;
  }

  return null;
};

const getPunchDirection = (value) => {
  const raw = normalizeToString(value).toUpperCase();
  if (["I", "IN", "CHECKIN", "CLOCKIN", "0"].includes(raw)) return "in";
  if (["O", "OUT", "CHECKOUT", "CLOCKOUT", "1"].includes(raw)) return "out";
  return "in";
};

const upsertBiometricAttendance = async ({
  employeeId,
  timestamp,
  direction,
}) => {
  if (!employeeId || !timestamp) return null;

  const employee = await Employee.findOne({
    employeeId: normalizeToString(employeeId),
  });
  if (!employee) return null;

  const userRecord = await User.findOne({ email: employee.email });
  if (!userRecord) return null;

  const parsedDate = parsedZkTime(timestamp);
  if (!parsedDate) return null;

  const dateStr = toLocalDateString(parsedDate);
  const timeStr = `${parsedDate.getHours().toString().padStart(2, "0")}:${parsedDate
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${parsedDate.getSeconds().toString().padStart(2, "0")}`;
  const dateKey = new Date(dateStr);

  let attendanceRecord = await Attendance.findOne({
    userId: userRecord._id,
    date: dateKey,
  });

  if (!attendanceRecord) {
    attendanceRecord = new Attendance({
      userId: userRecord._id,
      date: dateKey,
      timeIn: null,
      timeOut: null,
    });
  }

  const punchDate = createDateTime(dateStr, timeStr);
  const currentDirection = getPunchDirection(direction);

  if (currentDirection === "in") {
    if (
      !attendanceRecord.timeIn ||
      punchDate < new Date(attendanceRecord.timeIn)
    ) {
      attendanceRecord.timeIn = punchDate;
    }
  } else {
    if (
      !attendanceRecord.timeOut ||
      punchDate > new Date(attendanceRecord.timeOut)
    ) {
      attendanceRecord.timeOut = punchDate;
    }
  }

  await attendanceRecord.save();
  return attendanceRecord;
};

router.post("/iclock/cdata", async (req, res) => {
  try {
    const incoming =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const parsedPayload =
      extractDevicePunch(payload) || extractDevicePunch(incoming);

    if (!parsedPayload) {
      console.log("ZKTeco payload received but not recognized:", incoming);
      return res
        .status(200)
        .json({ success: false, message: "Payload not recognized" });
    }

    const employeeId = normalizeToString(
      parsedPayload.userId ||
        parsedPayload.employeeId ||
        parsedPayload.uid ||
        parsedPayload.PIN,
    );
    const timestamp =
      parsedPayload.dateTime ||
      parsedPayload.timestamp ||
      parsedPayload.checkTime ||
      parsedPayload.punchTime;

    const saved = await upsertBiometricAttendance({
      employeeId,
      timestamp,
      direction: parsedPayload.state,
    });

    if (!saved) {
      return res
        .status(200)
        .json({ success: false, message: "Employee not matched" });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance received",
      record: saved,
    });
  } catch (error) {
    console.error("Error saving ZKTeco payload:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Post route to import biometric data from ZKTeco device
router.post("/import-biometric", async (req, res) => {
  try {
    const { deviceIp, devicePort } = req.body;

    if (!deviceIp) {
      return res.status(400).json({ error: "Device IP is required" });
    }

    const zkService = new ZKTecoService(deviceIp, devicePort);

    const connected = await zkService.connect();
    if (!connected) {
      return res
        .status(500)
        .json({ error: "Failed to connect to ZKTeco device" });
    }

    // Fetching attendance records from the device
    const zkRecords = await zkService.getAttendanceRecords();
    const employees = await Employee.find();

    const processedRecords = [];
    const errors = [];

    for (const zkRecord of zkRecords) {
      try {
        // Map ZKTeco user ID to employee
        const employee = employees.find(
          (e) => e.employeeId === zkRecord.userId.toString(),
        );

        if (!employee) {
          errors.push({
            zkUserId: zkRecord.userId,
            reason: "Employee not found",
          });
          continue;
        }

        const recordDate = new Date(zkRecord.timestamp);
        const dateStr = recordDate.toISOString().split("T")[0];

        let attendanceRecord = await Attendance.findOne({
          userId: employee._id,
          date: dateStr,
        });

        if (!attendanceRecord) {
          attendanceRecord = new Attendance({
            user: employee._id,
            date: dateStr,
          });
        }

        if (!attendanceRecord.timeIn) {
          attendanceRecord.timeIn = new Date(
            `${dateStr}T${zkRecord.time.substring(0, 8)}`,
          );
        } else {
          attendanceRecord.timeOut = new Date(
            `${dateStr}T${zkRecord.time.substring(0, 8)}`,
          );
        }

        await attendanceRecord.save();
        processedRecords.push({
          employeeId: employee.employeeId,
          date: dateStr,
          timeIn: attendanceRecord.timeIn,
          timeOut: attendanceRecord.timeOut,
        });
      } catch (error) {
        errors.push({
          zkRecord,
          error: error.message,
        });
      }
    }

    await zkService.disconnect();

    res.json({
      success: true,
      processed: processedRecords.length,
      errors: errors.length,
      processedRecords,
      errors,
    });
  } catch (error) {
    console.error("Error importing biometric data:", error);
    res.status(500).json({ error: error.message });
  }
});

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
          timeIn: null,
          timeOut: null,
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
