const mongoose = require("mongoose");

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
});

module.exports = mongoose.model("Attendance", attendanceSchema, "attendance");
