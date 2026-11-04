// One-time tidy-up: removes the old "logistics" page key from every account's
// pageAccess. The key no longer grants anything (the module uses "logistics-*"
// keys now), so this only keeps the stored lists clean.
//
// Run from the project root (it reads MONGO_URI from the root .env):
//   node backend/scripts/dropLogisticsPageKey.js
//
// Safe to run more than once.

const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const Auth = require("../models/authUsers");

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. Check the root .env file.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const result = await Auth.updateMany(
    { pageAccess: "logistics" },
    { $pull: { pageAccess: "logistics" } },
  );
  console.log(
    `Removed the "logistics" page key from ${result.modifiedCount} account(s).`,
  );

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Script failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
