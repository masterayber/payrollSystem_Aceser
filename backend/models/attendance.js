const mongoose = require("mongoose");
const { calculateBehavior } = require("../utils/attendance/behavior");

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  date: {
    type: Date,
    required: true,
  },
  timeIn: {
    type: Date,
  },
  timeOut: {
    type: Date,
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
  leaveType: {
    type: String,
    enum: ["Vacation Leave", "Sick Leave"],
    default: null,
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
    start: Date,
    end: Date,
    isFiled: {
      type: Boolean,
      default: false,
    },
  },
});

attendanceSchema.set("toJSON", {
  transform: (doc, ret) => {
    if (ret.timeIn) ret.timeIn = toTimeString(ret.timeIn);
    if (ret.timeOut) ret.timeOut = toTimeString(ret.timeOut);
    if (ret.overtime?.start)
      ret.overtime.start = toTimeString(ret.overtime.start);
    if (ret.overtime?.end) ret.overtime.end = toTimeString(ret.overtime.end);
    return ret;
  },
});

function toTimeString(value) {
  if (!value) return value;
  if (value instanceof Date) {
    return `${value.getUTCHours().toString().padStart(2, "0")}:${value
      .getUTCMinutes()
      .toString()
      .padStart(2, "0")}:${value.getSeconds().toString().padStart(2, "0")}`;
  }
  return value;
}

function createDateTime(dateValue, timeString) {
  if (!dateValue || !timeString) return null;
  return new Date(`${dateValue}T${timeString}Z`);
}

// Function to determine if an employee is eligible for overtime
function calculateOvertime({ date, timeIn, timeOut, schedule }) {
  const FALLBACK_TIMEOUT = "17:00:00";
  const scheduleTimeOut = schedule?.timeOut || FALLBACK_TIMEOUT;

  if (!date || !timeOut) {
    return { isEligible: false, hours: 0, start: undefined, end: undefined };
  }

  // const [hour, minute] = timeOut.split(":").map(Number);
  // let timeOutInMinutes = hour * 60 + minute;

  // const [timeOutHour, timeOutMinute] = scheduleTimeOut.split(":").map(Number);
  // const overtimeStartHour = timeOutHour + 1;
  // const overtimeStart = `${overtimeStartHour.toString().padStart(2, "0")}:${timeOutMinute
  //   .toString()
  //   .padStart(2, "0")}`;
  // const overtimeStartMinutes = overtimeStartHour * 60 + timeOutMinute;

  const attendanceDate = new Date(date).toISOString().split("T")[0];
  const overtimeStartTime = "18:00:00";
  const overtimeStart = createDateTime(attendanceDate, overtimeStartTime);
  const overtimeEnd = createDateTime(attendanceDate, timeOut);

  if (!overtimeStart || !overtimeEnd) {
    return { isEligible: false, hours: 0, start: undefined, end: undefined };
  }

  const [scheduledHour, schedledMinute] = scheduleTimeOut
    .split(":")
    .map(Number);
  const scheduledOutMinutes = scheduledHour * 60 + schedledMinute;
  const [timeOutHour, timeOutMinute, timeOutSecond = 0] = timeOut
    .split(":")
    .map(Number);
  const timeOutMinutes = timeOutHour * 60 + timeOutMinute + timeOutSecond / 60;

  if (timeIn) {
    const [inHour, inMinute, inSecond = 0] = timeIn.split(":").map(Number);
    const timeInMinutes = inHour * 60 + inMinute + inSecond / 60;

    if (timeOutMinutes < timeInMinutes) {
      overtimeEnd.setUTCDate(overtimeEnd.getUTCDate() + 1);
    }
  }

  const minimumOvertimeMinutes = 60;
  const overtimeDuration = (overtimeEnd - overtimeStart) / 60000;

  if (overtimeDuration >= minimumOvertimeMinutes) {
    return {
      isEligible: true,
      hours: overtimeDuration / 60,
      start: overtimeStart,
      end: overtimeEnd,
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
    const timeIn = toTimeString(this.timeIn);
    const timeOut = toTimeString(this.timeOut);
    const overtimeResult = this.timeOut
      ? calculateOvertime({
          date: this.date,
          timeIn,
          timeOut,
          schedule,
        })
      : { isEligible: false, hours: 0 };

    const leaveBehaviors = ["On-Leave"];
    if (!leaveBehaviors.includes(this.behavior)) {
      const behaviorDate = new Date(this.date).toISOString().split("T")[0];
      this.behavior = calculateBehavior({
        date: behaviorDate,
        timeIn,
        timeOut,
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

    if (update.behavior === "On-Leave") {
      return next();
    }

    if (update.timeIn || update.timeOut) {
      const doc = await this.model.findOne(this.getQuery());
      if (!doc) return next();
      const schedule = await getSchedule(doc.userId);
      const effectiveTimeIn = update.timeIn || doc.timeIn;
      const effectiveTimeOut = update.timeOut || doc.timeOut;
      const timeIn = toTimeString(effectiveTimeIn);
      const timeOut = toTimeString(effectiveTimeOut);
      const overtimeResult = effectiveTimeOut
        ? calculateOvertime({
            date: doc.date,
            timeIn,
            timeOut,
            schedule,
          })
        : { isEligible: false, hours: 0 };
      const behaviorDate = new Date(doc.date).toISOString().split("T")[0];
      update.behavior = calculateBehavior({
        date: behaviorDate,
        timeIn,
        timeOut,
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
