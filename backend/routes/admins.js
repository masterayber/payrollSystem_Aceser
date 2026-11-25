// /api/admins: the Super Admin's Settings > Admins. Admin accounts are separate
// accounts (role "Admin"), not employees: no Employee or Settings record, never paid,
// hidden like the Super Admin. Super Admin only; anyone else gets 403 "You do not have
// access to this page". No route here deletes an Admin (disable only), changes a
// username or writes a role: a `role` key in a body is refused, so no admin changes its
// own role or anyone else's. A target that is not an Admin account (the Super Admin
// itself included) answers 404 "Admin not found".
const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/authUsers");
const Employee = require("../models/employees");
const ActivityLog = require("../models/activityLog");
const { requireSuperAdmin } = require("../middleware/accessMiddleware");
const { logActivity } = require("../middleware/activityLog");
const { ADMIN } = require("../config/roles");
const { generateTemporaryPassword } = require("../utils/password");
const { ignoreCase } = require("../utils/ignoreCase");
const {
  MESSAGES,
  notEmployee,
  checkAdminDetails,
  firstMissingEmployee,
  fullName,
  describeAdmin,
} = require("../utils/adminAccounts");
const {
  PAGE_SIZE,
  MESSAGES: ACTIVITY_MESSAGES,
  checkActivityQuery,
  activityFilter,
  toReplyEntry,
} = require("../utils/activityLog");

const router = express.Router();

// Every route on this router is Super Admin only
router.use(requireSuperAdmin);

// A 500 with the plain message only; the error itself is logged on the server
const serverError = (res, err) => {
  console.error("Admin accounts error:", err);
  res.status(500).json({ message: "Server error" });
};

// Statuses an Employee account may have to be on a pay list or linked (Pending
// sign-ups are not offered; resigned people stay, for their 13th month and final pay)
const LISTABLE_STATUSES = ["Active", "Resigned"];

// Name, Employee ID and status of each Employee-role account in `ids`, as a Map from
// the id string; ids that are not Employee-role accounts are left out
const peopleById = async (ids) => {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  const [accounts, employees] = await Promise.all([
    User.find({ _id: { $in: unique }, role: "Employee" })
      .select("status")
      .lean(),
    Employee.find({ userId: { $in: unique } })
      .select("userId firstName lastName employeeId")
      .lean(),
  ]);
  const byUser = new Map(employees.map((emp) => [String(emp.userId), emp]));
  return new Map(
    accounts.map((account) => {
      const emp = byUser.get(String(account._id));
      return [
        String(account._id),
        {
          name: fullName(emp),
          employeeId: emp?.employeeId || "",
          status: account.status,
        },
      ];
    }),
  );
};

const describe = async (admin) =>
  describeAdmin(
    admin,
    await peopleById([...(admin.payAccess || []), admin.linkedEmployeeId]),
  );

// The refusal for the first id in `ids` that is not an Employee-role account (Active
// or Resigned), a malformed id included, or null
const employeeRefusal = async (ids) => {
  if (ids.length === 0) return null;
  const valid = ids.filter((id) => mongoose.isValidObjectId(id));
  const found = await User.find({
    _id: { $in: valid },
    role: "Employee",
    status: { $in: LISTABLE_STATUSES },
  }).distinct("_id");
  const missing = firstMissingEmployee(ids, found);
  return missing ? notEmployee(missing) : null;
};

// The refusal for a username or email another account already uses, in any case, or
// null
const takenRefusal = async ({ username, email }, exceptId) => {
  const others = exceptId ? { _id: { $ne: exceptId } } : {};
  if (
    username !== undefined &&
    (await User.exists({ username: ignoreCase(username), ...others }))
  ) {
    return MESSAGES.usernameTaken;
  }
  if (
    email !== undefined &&
    (await User.exists({ email: ignoreCase(email), ...others }))
  ) {
    return MESSAGES.emailTaken;
  }
  return null;
};

// A duplicate-key error from a create or update that raced another one
const duplicateRefusal = (err) => {
  if (err?.code !== 11000) return null;
  return err.keyPattern?.username ? MESSAGES.usernameTaken : MESSAGES.emailTaken;
};

// The Admin account `id`, or null when the id is not valid or not an Admin account
const findAdmin = (id) =>
  mongoose.isValidObjectId(id)
    ? User.findOne({ _id: id, role: ADMIN })
    : Promise.resolve(null);

// Validates the body, then the username and email, then every pay-list and linked id
// (malformed or not an employee) against the database. Returns { error } or { fields }.
const checkRequest = async (body, { creating, exceptId }) => {
  const checked = checkAdminDetails(body, { creating });
  if (checked.error) return checked;
  const taken = await takenRefusal(checked.fields, exceptId);
  if (taken) return { error: taken };
  const notAnEmployee = await employeeRefusal(checked.employeeIds);
  if (notAnEmployee) return { error: notAnEmployee };
  return { fields: checked.fields };
};

// GET /api/admins: every Admin account (the Super Admin is not listed)
router.get("/", async (req, res) => {
  try {
    const admins = await User.find({ role: ADMIN })
      .select("-password -resetToken")
      .sort({ lastName: 1, firstName: 1, username: 1 })
      .lean();
    const people = await peopleById(
      admins.flatMap((admin) => [
        ...(admin.payAccess || []),
        admin.linkedEmployeeId,
      ]),
    );
    res.json(admins.map((admin) => describeAdmin(admin, people)));
  } catch (err) {
    serverError(res, err);
  }
});

// GET /api/admins/activity?by=&group=&from=&to=&q=&page=: the activity log, newest
// first, 50 entries a page. `by` is "me" or an Admin account's id; `group` a kind of
// action; `from` and `to` Manila days (YYYY-MM-DD, both included); `q` part of the
// record's name, in any case. The filters combine. A missing or bad `page` reads as 1; a
// page past the end is an empty list with the total. The log is read-only: no route
// edits or deletes an entry.
router.get("/activity", async (req, res) => {
  try {
    const checked = checkActivityQuery(req.query);
    if (checked.error) return res.status(400).json({ message: checked.error });
    if (
      checked.by !== undefined &&
      checked.by !== "me" &&
      !(await findAdmin(checked.by))
    ) {
      return res.status(400).json({ message: ACTIVITY_MESSAGES.notAdmin });
    }

    const filter = activityFilter(checked, req.user.userId);
    const [total, entries] = await Promise.all([
      ActivityLog.countDocuments(filter),
      ActivityLog.find(filter)
        .sort({ at: -1, _id: -1 })
        .skip((checked.page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
    ]);

    res.json({
      entries: entries.map((entry) => toReplyEntry(entry, req.user.userId)),
      total,
      page: checked.page,
      pageSize: PAGE_SIZE,
    });
  } catch (err) {
    serverError(res, err);
  }
});

// Every write below leaves an entry in the activity log (middleware/activityLog.js);
// no entry ever holds a temporary password.

// POST /api/admins { firstName, lastName, username, email, pages?, payAccess?,
// linkedEmployeeId? }: a new Active Admin account with a generated temporary password
// that must be changed at first sign-in. Only the hash is stored; the reply carries the
// password once.
router.post("/", logActivity("admin.create"), async (req, res) => {
  try {
    const checked = await checkRequest(req.body, { creating: true });
    if (checked.error) return res.status(400).json({ message: checked.error });

    const { linkedEmployeeId, ...fields } = checked.fields;
    const temporaryPassword = generateTemporaryPassword();
    const admin = new User({
      ...fields,
      ...(linkedEmployeeId ? { linkedEmployeeId } : {}),
      password: temporaryPassword,
      role: ADMIN,
      status: "Active",
      mustChangePassword: true,
      createdBy: req.user.userId,
      createdAt: new Date(),
    });
    await admin.save();

    res.locals.activity = { targetId: admin._id };
    res.status(201).json({
      message: MESSAGES.created,
      admin: await describe(admin.toObject()),
      temporaryPassword,
    });
  } catch (err) {
    const duplicate = duplicateRefusal(err);
    if (duplicate) return res.status(400).json({ message: duplicate });
    serverError(res, err);
  }
});

// PATCH /api/admins/:id { firstName?, lastName?, email?, pages?, payAccess?,
// linkedEmployeeId? }: the Admin as GET lists it. The role is not touched, so the
// Admin's session goes on; the change applies on its next request.
router.patch("/:id", logActivity("admin.edit"), async (req, res) => {
  try {
    const admin = await findAdmin(req.params.id);
    if (!admin) return res.status(404).json({ message: MESSAGES.notFound });

    const checked = await checkRequest(req.body, {
      creating: false,
      exceptId: admin._id,
    });
    if (checked.error) return res.status(400).json({ message: checked.error });

    const { linkedEmployeeId, ...fields } = checked.fields;
    admin.set(fields);
    if (linkedEmployeeId !== undefined) {
      admin.linkedEmployeeId = linkedEmployeeId || undefined;
    }
    admin.updatedAt = new Date();
    await admin.save();

    res.json(await describe(admin.toObject()));
  } catch (err) {
    const duplicate = duplicateRefusal(err);
    if (duplicate) return res.status(400).json({ message: duplicate });
    serverError(res, err);
  }
});

// POST /api/admins/:id/disable and /enable: status Inactive or Active. A disabled
// Admin is refused at login ("This account is disabled.") and, if signed in, on its
// next request (401 ACCOUNT_INACTIVE).
const setStatus = (status, message) => async (req, res) => {
  try {
    const admin = await findAdmin(req.params.id);
    if (!admin) return res.status(404).json({ message: MESSAGES.notFound });

    admin.status = status;
    admin.updatedAt = new Date();
    await admin.save();
    res.json({ message });
  } catch (err) {
    serverError(res, err);
  }
};

router.post(
  "/:id/disable",
  logActivity("admin.disable"),
  setStatus("Inactive", MESSAGES.disabled),
);
router.post(
  "/:id/enable",
  logActivity("admin.enable"),
  setStatus("Active", MESSAGES.enabled),
);

const logReset = logActivity("admin.resetPassword");

// POST /api/admins/:id/reset-password: a new temporary password, shown once, that
// must be changed at the next sign-in. The old password stops working at once.
router.post("/:id/reset-password", logReset, async (req, res) => {
  try {
    const admin = await findAdmin(req.params.id);
    if (!admin) return res.status(404).json({ message: MESSAGES.notFound });

    const temporaryPassword = generateTemporaryPassword();
    admin.password = temporaryPassword;
    admin.mustChangePassword = true;
    admin.resetToken = null;
    admin.updatedAt = new Date();
    await admin.save();

    res.json({ message: MESSAGES.passwordReset, temporaryPassword });
  } catch (err) {
    serverError(res, err);
  }
});

module.exports = router;
