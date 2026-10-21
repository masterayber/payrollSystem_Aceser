const mongoose = require("mongoose");

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
