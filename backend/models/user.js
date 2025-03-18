const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
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
    enum: ["admin", "employee"],
    default: "employee",
  },
  status: {
    type: String,
    enum: ["pending", "active", "inactive"],
    default: "pending",
  },
  profilePhoto: {
    type: String,
    default: "/frontend/public/assets/user-circle.svg",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  resetToken: {
    type: String,
    default: null,
  },
});

UserSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

UserSchema.virtual("formattedCreatedAt").get(function () {
  return this.createdAt.toLocaleString("en-US", {
    week,
  });
});

module.exports = mongoose.model("User", UserSchema);
