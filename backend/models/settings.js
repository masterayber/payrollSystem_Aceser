const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  general: {
    companyName: { type: String, default: "" },
    companyLogo: { type: String, default: "" },
    companyContact: { type: String, default: "" },

    address: {
      country: { type: String, default: "" },
      region: { type: String, default: "" },
      city: { type: String, default: "" },
      barangay: { type: String, default: "" },
      street: { type: String, default: "" },
      postalCode: { type: String, default: "" },
    },

    dateFormat: { type: String, default: "MM-DD-YYYY" },
    timeFormat: { type: String, default: "12 Hour" },
    createdAt: { type: Date, default: Date.now },
  },
  manage: {
    roles: { type: [String], default: [] },
  },
  accessiblity: {
    theme: { type: String, default: "light" },
  },
  securityAndPrivacy: {
    twoFactorAuth: { type: Boolean, default: false },
    passwordPolicy: {
      minLength: { type: Number, default: 8 },
      requiredSpecialChar: { type: Boolean, default: false },
    },
  },
  payrollAndBenefits: {
    defaultSalaryCurrency: { type: String, default: "PHP" },
    taxPercentage: { type: Number, default: 15 },
  },
  attendance: {
    enableBiometrics: { type: Boolean, default: true },
    clockInOutPolicy: { type: String, default: "Strict" },
  },
  systemLog: {
    enableLogging: { type: Boolean, default: true },
    logRetentionDays: { type: Number, default: 90 },
  },
  about: {
    appVersion: { type: String, default: "1.0.0" },
    termsAndCondiditions: { type: String, default: "" },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Settings", settingsSchema, "settings");
