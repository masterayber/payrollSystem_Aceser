const mongoose = require("mongoose");

const dropdownSchema = new mongoose.Schema({
  designations: [String],
  departments: [String],
  itemCategories: [String],
  unitsOfMeasure: [String],
  positions: {
    type: Map,
    of: [String],
    default: {},
  },
  employmentTypes: [String],
});

module.exports = mongoose.model("Dropdown", dropdownSchema);
