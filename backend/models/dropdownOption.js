const mongoose = require("mongoose");

const dropdownSchema = new mongoose.Schema({
  Departments: [String],
});

module.exports = mongoose.model("Dropdown", dropdownSchema);
