const mongoose = require("mongoose");
const { SUPPLIER_STATUSES, VAT_TYPES } = require("../config/logistics");

// Suppliers, maintained by the procurement department and Admin.
const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // name lower-cased, so two spellings of the same supplier cannot both exist
    nameKey: { type: String, required: true, unique: true },
    // Decides the PO's VAT rate at PO creation; changing it later leaves existing POs alone
    vatType: { type: String, enum: VAT_TYPES, required: true },
    contactPerson: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    // Tax Identification Number, stored as typed
    tin: { type: String, default: "" },
    // Payment terms, e.g. "COD", "30 days"; copied to the PO as the default
    terms: { type: String, default: "" },
    status: { type: String, enum: SUPPLIER_STATUSES, default: "Active" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
    },
  },
  { timestamps: true },
);

supplierSchema.pre("validate", function (next) {
  if (typeof this.name === "string") {
    this.nameKey = this.name.trim().toLowerCase();
  }
  next();
});

module.exports = mongoose.model("Supplier", supplierSchema, "suppliers");
