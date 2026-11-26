const mongoose = require("mongoose");
const { KIND_KEYS } = require("../utils/deductionTables");

// Company-wide settings. There is only one record; the unique key stops a second one.
const companySettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "company", unique: true, immutable: true },
    name: { type: String, default: "", trim: true },
    contact: { type: String, default: "", trim: true },
    logo: { type: String, default: "" },
    dateFormat: {
      type: String,
      enum: ["MM-DD-YYYY", "DD-MM-YYYY", "YYYY-MM-DD"],
      default: "MM-DD-YYYY",
    },
    timeFormat: {
      type: String,
      enum: ["12 Hour", "24 Hour"],
      default: "12 Hour",
    },
    // The statutory deductions the Super Admin switched off ("sss", "philhealth",
    // "pagibig", "tax"); none by default. Set only by PUT /api/deductions/statutory-off.
    // Left out of every read unless it is asked for by name (select: "+statutoryOff"),
    // so the Settings > Company routes neither send nor accept it.
    statutoryOff: {
      type: [{ type: String, enum: KIND_KEYS }],
      default: [],
      select: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "CompanySettings",
  companySettingsSchema,
  "companySettings",
);
