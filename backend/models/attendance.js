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

attendanceSchema.pre("save", async function (next) {
  const Settings = require("./settings");

  const settings = await Settings.findOne({ userId: this.userId });

  const schedule = settings?.general?.jobDescription?.schedule || {
    timeIn: "08:00",
    timeOut: "17:00",
  };

  this.behavior = calculateBehavior({
    date: this.date,
    timeIn: this.timeIn,
    timeOut: this.timeOut,
    schedule,
  });

  if (this.timeOut) {
    const [hour, minute] = this.timeOut.split(":").map(Number);

    const timeOutInMinutes = hour * 60 + minute;

    const [timeOutHour, timeOutMinute] = schedule.timeOut
      .split(":")
      .map(Number);
    const overtimeStartHour = timeOutHour + 1;
    const overtimeStart = `${overtimeStartHour.toString().padStart(2, "0")}:${timeOutMinute.toString().padStart(2, "0")}`;
    const overtimeStartMinutes = overtimeStartHour * 60 + timeOutMinute;

    const minimumOvertimeMinutes = 60;

    const overtimeDuration = timeOutInMinutes - overtimeStartMinutes;

    if (overtimeDuration >= minimumOvertimeMinutes) {
      const overtimeHours = overtimeDuration / 60;

      this.overtime = {
        ...this.overtime,
        isEligible: true,
        hours: overtimeHours,
        start: overtimeStart,
        end: this.timeOut,
        isFiled: false,
      };
    } else {
      this.overtime = {
        isEligible: false,
        hours: 0,
      };
    }
  }

  next();
});

attendanceSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();

    if (update.timeIn || update.timeOut) {
      const doc = await this.model.findOne(this.getQuery());

      const Settings = require("./settings");
      const settings = await Settings.findOne({ userId: doc.userId });

      const schedule = settings?.general?.jobDescription?.schedule || {
        timeIn: "08:00",
        timeOut: "17:00",
      };

      update.behavior = calculateBehavior({
        date: doc.date,
        timeIn: update.timeIn || doc.timeIn,
        timeOut: update.timeOut || doc.timeOut,
        schedule,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("Attendance", attendanceSchema, "attendance");
