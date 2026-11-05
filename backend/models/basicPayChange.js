const mongoose = require("mongoose");

// Basic pay history: one record per change of an employee's monthly basic pay saved by
// an admin, kept apart from Settings so a write that replaces the job description can't
// wipe it. The pay in force on a day is the latest record effective on or before it
// (utils/basicPayHistory.js). One record per employee per day: a second change on the
// same day replaces the first.
const basicPayChangeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Auth",
    required: true,
  },
  // Monthly basic pay in PHP, as saved on the job description
  amount: { type: Number, min: 0, required: true },
  // The Manila day the pay is in force from, stored as that day at 00:00 UTC (the same
  // way start dates are stored); read it back with toDateKey
  effectiveFrom: { type: Date, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Auth" },
  changedAt: { type: Date, default: Date.now },
});

basicPayChangeSchema.index({ userId: 1, effectiveFrom: 1 }, { unique: true });

module.exports = mongoose.model(
  "BasicPayChange",
  basicPayChangeSchema,
  "basicpaychanges",
);
