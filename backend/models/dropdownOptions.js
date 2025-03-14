const mongoose = require("mongoose");

const dropdownSchema = new mongoose.Schema({
  category: {
    type: String,
    require: true,
  },
  options: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Dropdown", dropdownSchema);
