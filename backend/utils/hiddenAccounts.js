// Super Admin and Admin accounts are not employees: they are hidden from the system.
// They never appear in an employee list, picker, report, count, payroll or 13th month,
// and a per-employee route aimed at one answers exactly as it does for a missing record.
//
// Routes use these helpers so the check is one line:
// - isHiddenAccount(userId): the account exists and has an admin role
// - findVisibleUser(userId): the account, or null when it is missing or hidden
// - hiddenUserIds(): every admin-role account id, to leave their records out of a list
const mongoose = require("mongoose");

const User = require("../models/authUsers");
const { ADMIN_ROLES } = require("../config/roles");

// Query filter on an Auth record's role: anyone but the two admin roles
const VISIBLE_ROLE = { $nin: ADMIN_ROLES };

// The visible (non-admin) account for `userId` with `fields`, or null when the id is
// not valid, there is no such account, or it has an admin role
const findVisibleUser = async (userId, fields = "_id") => {
  if (!mongoose.isValidObjectId(userId)) return null;
  return User.findOne({ _id: userId, role: VISIBLE_ROLE }).select(fields).lean();
};

// True only when the account exists and has an admin role. A missing account is
// false, so a route keeps its own handling for a missing record.
const isHiddenAccount = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) return false;
  return Boolean(
    await User.exists({ _id: userId, role: { $in: ADMIN_ROLES } }),
  );
};

// Ids of every admin-role account, for `userId: { $nin: ... }` on a list
const hiddenUserIds = () =>
  User.distinct("_id", { role: { $in: ADMIN_ROLES } });

// The ids of hiddenUserIds() as a Set of strings, for many lookups in one request
const hiddenUserIdSet = async () =>
  new Set((await hiddenUserIds()).map(String));

// A project reply without hidden accounts in its raw member fields: inChargeId
// becomes null and documentControllerIds drops them. `hidden` is a Set of id
// strings (hiddenUserIdSet()). Returns a new object; the stored project is untouched.
const withoutHiddenMembers = (project, hidden) => {
  const isHidden = (id) => id != null && hidden.has(String(id));
  return {
    ...project,
    inChargeId: isHidden(project.inChargeId) ? null : project.inChargeId ?? null,
    documentControllerIds: (project.documentControllerIds || []).filter(
      (id) => !isHidden(id),
    ),
  };
};

module.exports = {
  VISIBLE_ROLE,
  findVisibleUser,
  isHiddenAccount,
  hiddenUserIds,
  hiddenUserIdSet,
  withoutHiddenMembers,
};
