const mongoose = require("mongoose");

const dropdownSchema = new mongoose.Schema({
  designations: [String],
  departments: [String],
  positions: {
    type: Map,
    of: [String],
    default: {},
  },
  employmentTypes: [String],
});

module.exports = mongoose.model("Dropdown", dropdownSchema);
