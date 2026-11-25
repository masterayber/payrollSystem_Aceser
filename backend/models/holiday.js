const mongoose = require("mongoose");
const { HOLIDAY_TYPE_NAMES } = require("../config/holidays");
const { HOLIDAY_SOURCES } = require("../config/regularHolidays");

// The company holiday list, kept on the admin Calendar screen: typed in by hand from the
// official list, or saved by the import after an Admin has checked its preview (nothing
// is seeded, nothing is added without an Admin's click). One holiday per date: `date` is
// the Manila day stored at 00:00 UTC (new Date("YYYY-MM-DDT00:00:00Z")), so its
// "YYYY-MM-DD" key reads the same everywhere. The types are listed in config/holidays.js.
const holidaySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: HOLIDAY_TYPE_NAMES },
    // How it got here, set by the server: "Manual" (the Add form) or "Imported" (the
    // import's Save). A holiday saved before the import existed has no mark and reads as
    // "Manual". Pay and the attendance sheet treat both the same.
    source: {
      type: String,
      enum: Object.values(HOLIDAY_SOURCES),
      default: HOLIDAY_SOURCES.MANUAL,
    },
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
