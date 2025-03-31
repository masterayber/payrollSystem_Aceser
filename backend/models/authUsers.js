const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const AuthSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
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
    default: "Employee",
  },
  status: {
    type: String,
    enum: ["Pending", "Active", "Inactive"],
    default: "Pending",
  },
  profilePhoto: {
    type: String,
    default: "/assets/user-circle.svg",
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: null,
  },
  resetToken: {
    type: String,
    default: null,
  },
});

// Format createdAt date
AuthSchema.virtual("formattedCreatedAt").get(function () {
  return this.createdAt.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
});

// Hash password before saving
AuthSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

module.exports = mongoose.model("Auth", AuthSchema, "auths");
