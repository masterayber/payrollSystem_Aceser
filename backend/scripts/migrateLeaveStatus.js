// One-time migration: leave applications saved with the old "Rejected" status become
// "Disapproved", to match the updated enum in models/leaveApplication.js.
//
// Run from the project root (it reads MONGO_URI from the root .env):
//   node backend/scripts/migrateLeaveStatus.js           -> dry run, only counts
//   node backend/scripts/migrateLeaveStatus.js --apply   -> performs the update
//
// Safe to run more than once: after the first --apply there is nothing left to change.

const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const apply = process.argv.includes("--apply");

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. Check the root .env file.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  // Use the raw collection so the check works even though "Rejected" is no longer a
  // valid enum value on the model.
  const leaves = mongoose.connection.collection("leaveapplications");
  const filter = { status: "Rejected" };
  const count = await leaves.countDocuments(filter);

  console.log(`Leave applications with status "Rejected": ${count}`);

  if (count === 0) {
    console.log("Nothing to migrate.");
  } else if (!apply) {
    console.log("Dry run only. Re-run with --apply to update them.");
  } else {
    const result = await leaves.updateMany(filter, {
      $set: { status: "Disapproved" },
    });
    console.log(`Updated ${result.modifiedCount} document(s) to "Disapproved".`);
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Migration failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
