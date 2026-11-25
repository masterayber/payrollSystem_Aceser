const mongoose = require("mongoose");
const { ACTIONS, GROUP_KEYS } = require("../utils/activityLog");

// The activity log: one entry per successful write by the Super Admin or an Admin
// (utils/activityLog.js lists the actions; middleware/activityLog.js writes the entry).
// Everything is stored as it was at the time, so a deleted employee or a renamed Admin
// still reads correctly. An entry never holds an amount of money, a password, old or
// new values, or a role. Entries are kept forever and no route edits or deletes one.
const activityLogSchema = new mongoose.Schema({
  // When
  at: { type: Date, required: true, default: Date.now },
  // Who, with the name they had
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "Auth", required: true },
  actorName: { type: String, default: "" },
  // What: a key of ACTIONS, and its filter group
  action: { type: String, required: true, enum: Object.keys(ACTIONS) },
  group: { type: String, required: true, enum: GROUP_KEYS },
  // Which record: the account or record acted on, when there is one, and its name
  // ("Angelica Ramos (AC-008)", "Departments list", "Christmas Day, 2026-12-25")
  targetId: { type: mongoose.Schema.Types.ObjectId },
  targetName: { type: String, default: "" },
  // The labels of the fields an edit changed ("position", "basic pay"); never a value
  changed: { type: [String], default: [] },
  // One short line that identifies the record or the result ("Last working day
  // 2026-10-16", "48 records imported")
  note: { type: String, default: "" },
});

activityLogSchema.index({ at: -1 });
activityLogSchema.index({ actorId: 1, at: -1 });
activityLogSchema.index({ group: 1, at: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema, "activitylogs");
