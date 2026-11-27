const mongoose = require("mongoose");
const {
  KINDS,
  TYPES,
  REPEATS,
  SCHEDULES,
  STATUS,
  STORED_STATUSES,
  isCutoffValue,
} = require("../utils/payItems");

const accountRef = {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Auth",
  default: null,
};

// A pay item (DED-4): an earning or a deduction typed in for one employee (an
// Employee-role account on payroll), such as a Company Loan paid back in instalments or
// an allowance on every cut-off. The rules are in utils/payItems.js. What is paid on it
// comes from issued payslips (DED-6) and is never stored here; its balance and the
// "Completed" status are worked out from that. A stopped item stays on record.
const payItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
    },
    kind: { type: String, required: true, enum: KINDS },
    type: {
      type: String,
      required: true,
      enum: [...TYPES.deduction, ...TYPES.earning],
    },
    // Shown on the payslip next to the type; "" when none was typed
    label: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
    amountPerCutoff: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => value > 0,
        message: "The amount must be more than 0.",
      },
    },
    // Set for instalments only; null for one-off and until-stopped items
    total: { type: Number, default: null },
    repeat: { type: String, required: true, enum: REPEATS },
    schedule: { type: String, required: true, enum: SCHEDULES },
    // The first cut-off it can land on, as toCutoffValue writes it ("2026-12-1st")
    startCutoff: {
      type: String,
      required: true,
      validate: {
        validator: isCutoffValue,
        message: "Not a cut-off.",
      },
    },
    // Earnings only; a deduction is stored as false
    taxable: { type: Boolean, default: true },
    // "Completed" is worked out, never stored
    status: {
      type: String,
      enum: STORED_STATUSES,
      default: STATUS.ACTIVE,
    },
    createdBy: accountRef,
    stoppedBy: accountRef,
    stoppedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

payItemSchema.index({ userId: 1 });

module.exports = mongoose.model("PayItem", payItemSchema, "payItems");
