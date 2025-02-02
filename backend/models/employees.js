const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  address: {
    type: String,
    default: "",
  },
  birthday: {
    type: Date,
    default: null,
  },
  contactNumber: {
    type: String,
    default: "",
  },
  gender: {
    type: String,
    default: "",
  },
  contactFirstName: {
    type: String,
    default: "",
  },
  contactLastName: {
    type: String,
    default: "",
  },
  contactEmergency: {
    type: String,
    default: "",
  },
  contactAddress: {
    type: String,
    default: "",
  },
});

module.exports = mongoose.model("Employee", employeeSchema);
