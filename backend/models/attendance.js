const mongoose = require("mongoose");
const {
  calculateBehavior,
} = require("../../frontend/src/utils/attendance/behavior");

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
