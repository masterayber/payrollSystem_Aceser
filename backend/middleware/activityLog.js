const mongoose = require("mongoose");

const ActivityLog = require("../models/activityLog");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const CompanySettings = require("../models/companySettings");
const { isAdminRole } = require("../config/roles");
const {
  ACTIONS,
  CHANGE_LABELS,
  changedFields,
  personName,
  clip,
} = require("../utils/activityLog");

// The longest a reply waits for its log entry. A log write that is slower than this is
// given up on (and reported in the server console); the reply goes out without it.
const LOG_WAIT_MS = 2000;

// A log fault never reaches the person: it is printed here and the request goes on
const logFault = (err) => console.error("Activity log error:", err);

// An account with its employee record, and its job details when `withJob`; null when
// the id is not valid or there is no such account. Used for names and, read before and
// after a save, to tell which fields an edit changed.
const loadAccount = async (id, { withJob = false } = {}) => {
  if (!mongoose.isValidObjectId(id)) return null;
  const [account, employee, settings] = await Promise.all([
    User.findById(id)
      .select(
        "username email firstName lastName pageAccess payAccess linkedEmployeeId",
      )
      .lean(),
    Employee.findOne({ userId: id })
      .select(
        "firstName lastName employeeId email gender birthday contactNumber address emergencyDetails",
      )
      .lean(),
    withJob
      ? Settings.findOne({ userId: id }).select("general.jobDescription").lean()
      : null,
  ]);
  if (!account) return null;
  return { account, employee, job: settings?.general?.jobDescription || {} };
};

// The record an edit changes, by its kind in CHANGE_LABELS
const SNAPSHOTS = {
  person: (id) => loadAccount(id, { withJob: true }),
  admin: (id) => loadAccount(id),
  // Before the first save there is no record yet: the defaults are what it starts from
  company: async () =>
    (await CompanySettings.findOne({ key: "company" }).lean()) ||
    new CompanySettings().toObject(),
};

// Resolves when `work` settles or after LOG_WAIT_MS, whichever comes first; a failure
// is printed, never thrown
const settled = (work) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      logFault(new Error(`No answer from the log after ${LOG_WAIT_MS} ms`));
      resolve();
    }, LOG_WAIT_MS);
    work.catch(logFault).then(() => {
      clearTimeout(timer);
      resolve();
    });
  });

// Writes the entry for a successful request
const writeEntry = async ({ req, res, key, spec, before }) => {
  const details = {
    ...(spec.describe
      ? spec.describe({ params: req.params, body: req.body || {} })
      : {}),
    ...(res.locals.activity || {}),
  };

  const targetId =
    details.targetId ?? (spec.param ? req.params[spec.param] : undefined);
  const after = spec.changes ? await SNAPSHOTS[spec.changes](targetId) : null;

  let targetName = details.targetName ?? spec.targetName;
  if (targetName === undefined) {
    const target = after?.account ? after : await loadAccount(targetId);
    targetName = target ? personName(target.employee, target.account) : "";
  }

  const actor = await loadAccount(req.user.userId);

  await ActivityLog.create({
    actorId: req.user.userId,
    actorName: personName(actor?.employee, actor?.account, { withId: false }),
    action: key,
    group: spec.group,
    targetId: mongoose.isValidObjectId(targetId) ? targetId : undefined,
    targetName: clip(targetName),
    changed: [
      ...(spec.changes
        ? changedFields(before, after, CHANGE_LABELS[spec.changes])
        : []),
      ...(Array.isArray(details.changed) ? details.changed : []),
    ],
    note: clip(details.note),
  });
};

// Logs a successful write by the Super Admin or an Admin: one entry in the activity
// log, written before the reply goes out. Goes on a route right after its guard (it
// needs req.currentUser). `action` is a key of ACTIONS (utils/activityLog.js), or a
// function of the request that gives one.
// - A refused request (status 400 and up) writes nothing; neither does an Employee.
// - The record and details come from the ACTIONS table; a handler adds what only it
//   knows in `res.locals.activity = { targetId, targetName, changed, note }`.
// - A log fault is silent for the person: it is printed in the server console and the
//   reply goes out unchanged.
const logActivity = (action) => {
  if (typeof action !== "function" && !ACTIONS[action]) {
    throw new Error(`Not a logged action: ${action}`);
  }

  return async (req, res, next) => {
    if (!isAdminRole(req.currentUser?.role)) return next();

    let key;
    let spec;
    let before = null;
    try {
      key = typeof action === "function" ? action(req) : action;
      spec = ACTIONS[key];
      if (!spec) throw new Error(`Not a logged action: ${key}`);
      if (spec.changes) {
        before = await SNAPSHOTS[spec.changes](req.params[spec.param]);
      }
    } catch (err) {
      logFault(err);
      if (!spec) return next();
    }

    const sendJson = res.json.bind(res);
    let logged = false;
    res.json = (body) => {
      if (logged || res.statusCode >= 400) return sendJson(body);
      logged = true;
      settled(writeEntry({ req, res, key, spec, before })).then(() => {
        if (res.headersSent) return;
        try {
          sendJson(body);
        } catch (err) {
          next(err);
        }
      });
      return res;
    };

    next();
  };
};

module.exports = { logActivity, LOG_WAIT_MS };
