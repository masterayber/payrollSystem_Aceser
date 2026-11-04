const mongoose = require("mongoose");

// One counter per document number series, e.g. "MR-ACE01-2026" or "PO-2026".
// `seq` is the last number given out; utils/documentNumbers.js increments it
// atomically.
const documentCounterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 0 },
});

module.exports = mongoose.model(
  "DocumentCounter",
  documentCounterSchema,
  "documentCounters",
);
