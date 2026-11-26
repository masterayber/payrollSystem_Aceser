const mongoose = require("mongoose");
const {
  KIND_KEYS,
  BASES,
  DEFAULT_BASE,
  DEDUCT_ON,
  DEFAULT_DEDUCT_ON,
  STATUS,
} = require("../utils/deductionTables");

// One bracket of a table. It holds every base over `over` and up to `upTo`; the last row
// has no `upTo`. Its amounts are fixed + rate % x (base - excessOver), for the employee
// and for the employer; a flat bracket has rate 0 (utils/deductionTables.js).
const rowSchema = new mongoose.Schema(
  {
    over: { type: Number, required: true, min: 0 },
    upTo: { type: Number, default: null },
    employeeFixed: { type: Number, default: 0, min: 0 },
    employeeRate: { type: Number, default: 0, min: 0 },
    employerFixed: { type: Number, default: 0, min: 0 },
    employerRate: { type: Number, default: 0, min: 0 },
    excessOver: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

// The statutory deduction tables (SSS, PhilHealth, Pag-IBIG, withholding tax), one record
// per version. Every figure is typed in by the Super Admin from the official issuance and
// confirmed after HR or Accounting checked it; nothing is seeded and the code holds no
// rate. A new table is a new version with a later `effectiveFrom`, never an edit, so
// earlier payslips keep their figures: a Confirmed version is never changed or deleted
// (only its last check is stamped), a Draft can be. One version per kind per day:
// `effectiveFrom` is the Manila day stored at 00:00 UTC (new Date("YYYY-MM-DDT00:00:00Z")),
// so its "YYYY-MM-DD" key reads the same everywhere.
const deductionTableSchema = new mongoose.Schema(
  {
    kind: { type: String, required: true, enum: KIND_KEYS },
    effectiveFrom: { type: Date, required: true },
    // The official issuance the figures were copied from
    source: { type: String, required: true, trim: true },
    // What the brackets are read against, and which cut-off it is taken on ("both" takes
    // half on each)
    base: { type: String, enum: BASES, default: DEFAULT_BASE },
    deductOn: { type: String, enum: DEDUCT_ON, default: DEFAULT_DEDUCT_ON },
    rows: { type: [rowSchema], default: [] },
    // Only a Confirmed version is used for pay
    status: {
      type: String,
      enum: Object.values(STATUS),
      default: STATUS.DRAFT,
    },
    // Who confirmed it and when, and the HR or Accounting person who checked it
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      default: null,
    },
    confirmedAt: { type: Date, default: null },
    checkedWith: { type: String, default: "", trim: true },
    // The last check against the official table (the Manila day at 00:00 UTC), and who
    // made it. Confirming counts as the first check.
    lastCheckedOn: { type: Date, default: null },
    lastCheckedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      default: null,
    },
    // Who typed it in
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      default: null,
    },
  },
  { timestamps: true },
);

deductionTableSchema.index({ kind: 1, effectiveFrom: 1 }, { unique: true });

// Its own collection: the old, unused "deductions" collection is never read or written
module.exports = mongoose.model(
  "DeductionTable",
  deductionTableSchema,
  "deductionTables",
);
