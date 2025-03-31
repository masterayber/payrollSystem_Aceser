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
  role: {
    type: String,
    enum: ["Admin", "Employee"],
  },
  type: {
    type: String,
    enum: ["Probationary", "Regular", "Project-Based"],
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
  country: {
    type: String,
    default: "",
  },
  region: {
    type: String,
    default: "",
  },
  province: {
    type: String,
    default: "",
  },
  city: {
    type: String,
    default: "",
  },
  barangay: {
    type: String,
    default: "",
  },
  street: {
    type: String,
    default: "",
  },
  postalCode: {
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Employee", employeeSchema, "employees");
