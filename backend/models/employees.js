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
  employeeId: {
    type: String,
    unique: true,
    default: "",
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
  birthday: {
    type: Date,
    default: "",
  },
  contactNumber: {
    type: String,
    default: "",
  },
  gender: {
    type: String,
  },
  address: {
    country: {
      type: String,
      default: "Philippines",
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
  },
  emergencyDetails: {
    contactFirstName: {
      type: String,
    },
    contactLastName: {
      type: String,
    },
    contactEmergency: {
      type: String,
    },
    contactAddress: {
      type: String,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Employee", employeeSchema, "employees");
