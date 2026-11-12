const mongoose = require("mongoose");
const { HOLIDAY_TYPE_NAMES } = require("../config/holidays");

// The company holiday list, kept on the admin Calendar screen and typed in by hand from
// the official list (nothing is seeded). One holiday per date: `date` is the Manila day
// stored at 00:00 UTC (new Date("YYYY-MM-DDT00:00:00Z")), so its "YYYY-MM-DD" key reads
// the same everywhere. The types are listed in config/holidays.js.
const holidaySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: HOLIDAY_TYPE_NAMES },
    // Who added it
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Holiday", holidaySchema, "holidays");
