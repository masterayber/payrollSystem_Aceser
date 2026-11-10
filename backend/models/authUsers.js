const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES } = require("../config/roles");

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
    enum: ROLES,
    default: "Employee",
  },
  status: {
    type: String,
    enum: ["Pending", "Active", "Inactive", "Resigned"],
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
  pageAccess: {
    type: [String],
    default: undefined,
  },
  // True while the account must set its own password before using the app. Set true
  // only when someone else sets the password (Add Employee, Edit Employee with a
  // password, a new Admin account or the Super Admin's Reset password with a
  // temporary password); cleared by POST /api/auth/change-password or a Forgot
  // password reset. The default stays false, so existing accounts are not forced.
  mustChangePassword: {
    type: Boolean,
    default: false,
  },

  // Admin accounts only (role "Admin", created by the Super Admin with POST
  // /api/admins). An Admin is not an employee: it has no Employee or Settings record,
  // so its name is stored here. Its ticks reuse `pageAccess` above.
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  // Who created the account (the Super Admin), for the audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Auth" },
  // The Employee-role accounts whose pay this Admin may see, chosen person by person
  // by the Super Admin. Empty or missing means no pay at all (enforced from PR C).
  payAccess: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Auth" }],
    default: undefined,
  },
  // The same person's Employee-role account, when the Admin is also an employee.
  // The Admin can't act on that record (utils/linkedEmployee.js).
  linkedEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Auth" },
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
