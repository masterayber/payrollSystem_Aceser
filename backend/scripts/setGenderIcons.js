// One-time migration: every account still on a default icon gets the icon its rule
// gives (utils/profileIcon.js). An Employee-role account gets the icon for the gender
// on its Employee record (found by userId, else by email); the Super Admin and Admins
// get the plain user icon. An uploaded photo is never changed.
//
// Run from the project root (it reads MONGO_URI from the root .env):
//   node backend/scripts/setGenderIcons.js           -> dry run, only counts
//   node backend/scripts/setGenderIcons.js --apply   -> performs the update
//
// Safe to run more than once: after the first --apply there is nothing left to change.

const path = require("path");
const mongoose = require("mongoose");

const User = require("../models/authUsers");
const Employee = require("../models/employees");
const {
  DEFAULT_ICON,
  MALE_ICON,
  FEMALE_ICON,
  isDefaultIcon,
  nextProfilePhoto,
} = require("../utils/profileIcon");

// Short names for the console lines
const ICON_NAMES = {
  [DEFAULT_ICON]: "user-circle",
  [MALE_ICON]: "male",
  [FEMALE_ICON]: "female",
};
const iconName = (photo) => ICON_NAMES[photo] || "no photo";

// The changes the rule asks for, without writing anything:
// { changes: [{ userId, from, to }], uploadsKept, unchanged }
async function planGenderIcons() {
  const users = await User.find({})
    .select("role email profilePhoto")
    .lean();
  const employees = await Employee.find({})
    .select("userId email gender")
    .lean();

  const byUserId = new Map();
  const byEmail = new Map();
  for (const employee of employees) {
    if (employee.userId) byUserId.set(String(employee.userId), employee);
    if (employee.email && !byEmail.has(employee.email)) {
      byEmail.set(employee.email, employee);
    }
  }

  const changes = [];
  let uploadsKept = 0;
  let unchanged = 0;
  for (const user of users) {
    if (!isDefaultIcon(user.profilePhoto)) {
      uploadsKept += 1;
      continue;
    }
    const employee =
      byUserId.get(String(user._id)) || byEmail.get(user.email);
    const to = nextProfilePhoto(user.profilePhoto, user.role, employee?.gender);
    if (to === user.profilePhoto) {
      unchanged += 1;
    } else {
      changes.push({ userId: user._id, from: user.profilePhoto || "", to });
    }
  }

  return { changes, uploadsKept, unchanged };
}

// Writes the planned changes. Only an account still holding the photo seen in the plan
// is updated, so an upload made in between is never overwritten.
async function applyGenderIcons(plan) {
  const { changes } = plan || (await planGenderIcons());
  let updated = 0;
  for (const { userId, from, to } of changes) {
    const photoFilter = from
      ? { profilePhoto: from }
      : { profilePhoto: { $in: ["", null] } };
    const result = await User.updateOne(
      { _id: userId, ...photoFilter },
      { $set: { profilePhoto: to } },
    );
    updated += result.modifiedCount;
  }
  return updated;
}

// The console lines for a plan: one per kind of change, e.g. "user-circle -> male: 3"
function describePlan({ changes, uploadsKept, unchanged }) {
  const counts = new Map();
  for (const { from, to } of changes) {
    const key = `${iconName(from)} -> ${iconName(to)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const lines = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${key}: ${count}`);
  lines.push(`Uploaded photos left alone: ${uploadsKept}`);
  lines.push(`Default icons already right: ${unchanged}`);
  return lines;
}

async function run(apply) {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. Check the root .env file.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const plan = await planGenderIcons();
  for (const line of describePlan(plan)) console.log(line);

  if (plan.changes.length === 0) {
    console.log("Nothing to change.");
  } else if (!apply) {
    console.log(
      `Dry run only: ${plan.changes.length} account(s) would change. Re-run with --apply to update them.`,
    );
  } else {
    const updated = await applyGenderIcons(plan);
    console.log(`Updated ${updated} account(s).`);
  }

  await mongoose.disconnect();
}

if (require.main === module) {
  require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
  run(process.argv.includes("--apply")).catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { planGenderIcons, applyGenderIcons, describePlan };
