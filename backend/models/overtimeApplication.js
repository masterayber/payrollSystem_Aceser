const mongoose = require("mongoose");

const overtimeApplicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AuthUser",
    required: true,
  },
  selectedOvertime: { type: Date, required: true },
  start: { type: String, default: "18:00" },
  end: { type: String, required: true },
  overtimeDetails: { type: String, required: true },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
  },
  appliedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model(
  "OvertimeApplication",
  overtimeApplicationSchema,
);
