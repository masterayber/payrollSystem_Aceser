const mongoose = require("mongoose");

const deductionsSchema = new mongoose.Schema({
  governmentDeductions: {
    type: Map,
    of: Number,
    default: {},
  },
  loans: {
    type: Map,
    of: String,
    default: {},
  },
});

module.exports = mongoose.model("Deductions", deductionsSchema);
