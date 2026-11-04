const mongoose = require("mongoose");
const { PROJECT_STATUSES } = require("../config/logistics");

// A construction project (site). Membership for the logistics module lives here:
// the In-charge and the Document Controllers are picked by Admin on Setup > Projects.
// Whether they still hold the matching position is checked in the route and in
// utils/logisticsAccess.js, not by the schema.
const projectSchema = new mongoose.Schema(
  {
    // Used in document numbers (MR-<CODE>-<YYYY>-0001), so it cannot change once
    // any document exists for the project (route check).
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      match: /^[A-Z0-9]{2,8}$/,
    },
    name: { type: String, required: true, trim: true },
    // Site address; default delivery address on purchase orders
    location: { type: String, required: true, trim: true },
    status: { type: String, enum: PROJECT_STATUSES, default: "Active" },
    inChargeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      default: null,
    },
    documentControllerIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Auth" }],
      default: [],
    },
    // Calendar date as "YYYY-MM-DD", informational only
    startDate: { type: String, default: "" },
    remarks: { type: String, default: "" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
    },
  },
  { timestamps: true },
);

projectSchema.index({ inChargeId: 1 });
projectSchema.index({ documentControllerIds: 1 });
projectSchema.index({ status: 1 });

module.exports = mongoose.model("Project", projectSchema, "projects");
