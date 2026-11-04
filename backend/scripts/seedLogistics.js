// Demo data for the Logistics module. Not for production.
//
// Adds the reserved dropdown values (same as POST /api/logistics/setup/seed-reserved),
// one demo project, ten items and two suppliers. Anything that already exists is
// skipped, so it is safe to run more than once.
//
// Run from the project root (it reads MONGO_URI from the root .env):
//   node backend/scripts/seedLogistics.js

const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const Auth = require("../models/authUsers");
const Project = require("../models/project");
const Item = require("../models/item");
const Supplier = require("../models/supplier");
const { seedReserved } = require("../routes/logistics/setup");

const DEMO_PROJECT = {
  code: "ACE01",
  name: "Demo Tower",
  location: "Quezon City",
  status: "Active",
};

const DEMO_ITEMS = [
  ["CEM-001", "Portland cement", "Cement and Aggregates", "bag"],
  ["REB-010", "10mm rebar", "Steel and Rebar", "length"],
  ["REB-012", "12mm rebar", "Steel and Rebar", "length"],
  ["PLY-012", "Marine plywood 12mm", "Lumber and Plywood", "sheet"],
  ["LUM-2X4", "Lumber 2x4", "Lumber and Plywood", "length"],
  ["SND-001", "Sand", "Cement and Aggregates", "cu.m"],
  ["GRV-001", "Gravel", "Cement and Aggregates", "cu.m"],
  ["NAL-001", "Common nails", "Hardware and Fasteners", "kg"],
  ["TIE-001", "Tie wire", "Hardware and Fasteners", "kg"],
  ["HBL-004", "Hollow block 4 inch", "Cement and Aggregates", "pc"],
];

const DEMO_SUPPLIERS = [
  { name: "Metro Builders Supply", vatType: "VAT", terms: "30 days" },
  { name: "Juan's Hardware", vatType: "Non-VAT", terms: "COD" },
];

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. Check the root .env file.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const reserved = await seedReserved();
  console.log(`Reserved values: ${reserved.message}`);
  if (reserved.added.departments.length) {
    console.log(`  departments added: ${reserved.added.departments.join(", ")}`);
  }
  if (reserved.added.positions.length) {
    console.log(`  positions added: ${reserved.added.positions.join(", ")}`);
  }
  if (reserved.added.itemCategories) {
    console.log(`  item categories added: ${reserved.added.itemCategories}`);
  }
  if (reserved.added.unitsOfMeasure) {
    console.log(`  units of measure added: ${reserved.added.unitsOfMeasure}`);
  }

  const admin = await Auth.findOne({ role: "Admin" }).sort({ createdAt: 1 });
  if (!admin) {
    console.error("No Admin account found; create one before seeding.");
    await mongoose.disconnect();
    process.exit(1);
  }
  const createdBy = admin._id;

  if (await Project.exists({ code: DEMO_PROJECT.code })) {
    console.log(`Project ${DEMO_PROJECT.code} already exists, skipped.`);
  } else {
    await Project.create({ ...DEMO_PROJECT, createdBy });
    console.log(`Project ${DEMO_PROJECT.code} "${DEMO_PROJECT.name}" added.`);
  }

  let itemsAdded = 0;
  for (const [code, description, category, unit] of DEMO_ITEMS) {
    if (await Item.exists({ code })) continue;
    await Item.create({ code, description, category, unit, createdBy });
    itemsAdded += 1;
    console.log(`Item ${code} ${description} added.`);
  }
  console.log(`Items added: ${itemsAdded} of ${DEMO_ITEMS.length}.`);

  let suppliersAdded = 0;
  for (const supplier of DEMO_SUPPLIERS) {
    const nameKey = supplier.name.trim().toLowerCase();
    if (await Supplier.exists({ nameKey })) continue;
    await Supplier.create({ ...supplier, createdBy });
    suppliersAdded += 1;
    console.log(`Supplier ${supplier.name} (${supplier.vatType}) added.`);
  }
  console.log(`Suppliers added: ${suppliersAdded} of ${DEMO_SUPPLIERS.length}.`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
