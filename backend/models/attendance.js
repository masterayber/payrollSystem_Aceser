const mongoose = require("mongoose");
const { calculateBehavior } = require("../utils/attendance/behavior");

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  date: {
    type: String,
    required: true,
  },
  timeIn: {
    type: String,
  },
  timeOut: {
    type: String,
  },
  behavior: {
    type: String,
    enum: [
      "On-Time",
      "Late",
      "Absent",
      "Early-Out",
      "Half-Day",
      "On-Leave",
      "No Time-In",
      "No Time-Out",
      "Pending",
    ],
  },
  overtime: {
    isEligible: {
      type: Boolean,
      default: false,
    },
    hours: {
      type: Number,
      default: 0,
    },
    start: String,
    end: String,
    isFiled: {
      type: Boolean,
      default: false,
    },
  },
});

// Function to determine if an employee is eligible for overtime
function calculateOvertime({ timeOut, schedule }) {
  const FALLBACK_TIMEOUT = "17:00";
  const scheduleTimeOut = schedule?.timeOut || FALLBACK_TIMEOUT;

  if (!timeOut) {
    return { isEligible: false, hours: 0, start: undefined, end: undefined };
  }

  const [hour, minute] = timeOut.split(":").map(Number);
  let timeOutInMinutes = hour * 60 + minute;

  const [timeOutHour, timeOutMinute] = scheduleTimeOut.split(":").map(Number);
  const overtimeStartHour = timeOutHour + 1;
  const overtimeStart = `${overtimeStartHour.toString().padStart(2, "0")}:${timeOutMinute
    .toString()
    .padStart(2, "0")}`;
  const overtimeStartMinutes = overtimeStartHour * 60 + timeOutMinute;

  if (timeOutInMinutes < overtimeStartMinutes) {
    timeOutInMinutes += 24 * 60;
  }

  const minimumOvertimeMinutes = 60;
  const overtimeDuration = timeOutInMinutes - overtimeStartMinutes;

  if (overtimeDuration >= minimumOvertimeMinutes) {
    return {
      isEligible: true,
      hours: overtimeDuration / 60,
      start: overtimeStart,
      end: timeOut,
    };
  }

  return { isEligible: false, hours: 0, start: undefined, end: undefined };
}

// Fetches user's schedule from settings collection
async function getSchedule(userId) {
  const Settings = require("../models/settings");
  const settings = await Settings.findOne({ userId });
  return (
    settings?.general?.jobDescription?.schedule || {
      timeIn: "08:00",
      timeOut: "17:00",
    }
  );
}

attendanceSchema.pre("save", async function (next) {
  try {
    const schedule = await getSchedule(this.userId);

    const overtimeResult = this.timeOut
      ? calculateOvertime({ timeOut: this.timeOut, schedule })
      : { isEligible: false, hours: 0 };

    const leaveBehaviors = ["On Leave"];

    if (!leaveBehaviors.includes(this.behavior)) {
      this.behavior = calculateBehavior({
        date: this.date,
        timeIn: this.timeIn,
        timeOut: this.timeOut,
        schedule,
      });
    }

    this.overtime = {
      ...this.overtime,
      isEligible: overtimeResult.isEligible,
      hours: overtimeResult.hours,
      start: overtimeResult.start,
      end: overtimeResult.end,
      isFiled: this.overtime?.isFiled || false,
    };

    next();
  } catch (error) {
    next(error);
  }
});

attendanceSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();

    if (update.timeIn || update.timeOut) {
      const doc = await this.model.findOne(this.getQuery());
      if (!doc) return next();

      schedule = await getSchedule(doc.userId);

      effectiveTimeIn = update.timeIn || doc.timeIn;
      effectiveTimeOut = update.timeOut || doc.timeOut;

      const overtimeResult = effectiveTimeOut
        ? calculateOvertime({ timeOut: effectiveTimeOut, schedule })
        : { isEligible: false, hours: 0 };

      update.behavior = calculateBehavior({
        date: doc.date,
        timeIn: effectiveTimeIn,
        timeOut: effectiveTimeOut,
        schedule,
      });

      update.overtime = {
        ...doc.overtime,
        isEligible: overtimeResult.isEligible,
        hours: overtimeResult.hours,
        start: overtimeResult.start,
        end: overtimeResult.end,
        isFiled: doc.overtime?.isFiled || false,
      };
    }

    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("Attendance", attendanceSchema, "attendance");
