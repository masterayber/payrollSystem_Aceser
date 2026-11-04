const mongoose = require("mongoose");
const { ITEM_STATUSES } = require("../config/logistics");

// The Item Master: one shared list of materials for every project. A Pending item
// is one a Document Controller asked for from an MR form; Procurement gives it a
// code when approving it.
const itemSchema = new mongoose.Schema(
  {
    // Not required: Pending items have no code yet. Sparse unique so the missing
    // codes do not collide with each other.
    code: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    description: { type: String, required: true, trim: true },
    // From Dropdown.itemCategories
    category: { type: String, required: true },
    // Unit of measure, from Dropdown.unitsOfMeasure
    unit: { type: String, required: true },
    specs: { type: String, default: "" },
    status: { type: String, enum: ITEM_STATUSES, default: "Active" },
    // Set on new-item requests
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Auth" },
    requestedForProjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },
    // Set when Procurement approves or rejects the request
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Auth" },
    reviewedAt: { type: Date },
    reviewRemarks: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
    },
  },
  { timestamps: true },
);

itemSchema.index({ status: 1, description: 1 });
itemSchema.index({ status: 1, createdAt: 1 });
itemSchema.index({ description: "text", specs: "text" });

// An empty code must be stored as "no code", or the sparse unique index would
// treat every "" as the same value.
itemSchema.pre("validate", function (next) {
  if (this.code === "") this.code = undefined;
  next();
});

module.exports = mongoose.model("Item", itemSchema, "items");
