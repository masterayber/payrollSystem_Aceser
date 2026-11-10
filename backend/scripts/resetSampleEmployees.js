// Local sample data. Not for production.
//
// Replaces the local test employees with a realistic sample company:
//   1. Deletes every Employee-role account (only the six known local test accounts:
//      ayber, wew, ako, iver, test, ivers) and everything tied to them: Auth,
//      Employee, Settings, attendance, leave and overtime applications, basic pay
//      history, and their seats on projects.
//   2. Sets the one admin account's stored role (Auth and Employee) to "Super Admin".
//   3. Adds department Admin (Vice President, President) and the head positions for
//      Marketing, Accounting and Logistics & Procurement to the dropdowns.
//   4. Creates one Employee-role person per position (12) plus one resigned person,
//      the way Add Employee does (same records, same AC-xxx numbering, bcrypt via the
//      Auth pre-save hook), then fills their profile like Edit Employee does, ticks
//      the suggested Logistics pages for the logistics positions like Manage Access
//      does, and marks the resigned one like the Resign button does.
//   5. Seats the new Project In-Charge and Document Controller on the demo project.
//
// Keeps the admin account, items, suppliers, projects, company settings, dropdowns.
// Never sends email.
//
// Dry run by default (prints what it would do, writes nothing):
//   node backend/scripts/resetSampleEmployees.js
// Write:
//   node backend/scripts/resetSampleEmployees.js --apply
//
// Run from the project root (it reads MONGO_URI from the root .env). Safe to run
// twice: once the sample people exist, it only checks the dropdowns, the admin role
// and the project seats.

const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const Auth = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const Attendance = require("../models/attendance");
const LeaveApplication = require("../models/leaveApplication");
const OvertimeApplication = require("../models/overtimeApplication");
const BasicPayChange = require("../models/basicPayChange");
const Project = require("../models/project");
const Item = require("../models/item");
const Supplier = require("../models/supplier");
const CompanySettings = require("../models/companySettings");
const Dropdown = require("../models/dropdownOption");
const { ADMIN_ROLES, SUPER_ADMIN } = require("../config/roles");
const { pagesForRole } = require("../config/pages");
const { checkJobDetails, checkResignation } = require("../utils/jobDetails");
const {
  nextEmployeeId,
  createEmployeeAccount,
} = require("../utils/employeeAccount");
const { normalizePageAccess } = require("../utils/pageAccess");
const { headOfficeRoles, siteRole } = require("../utils/logisticsAccess");
const { findDuplicate, positionsIn } = require("../utils/dropdownValues");
const { manilaToday } = require("../utils/leaveCredits");
const { generateTemporaryPassword } = require("../utils/password");

const apply = process.argv.slice(2).includes("--apply");

// The local test accounts this script may delete. Anything else stops it.
const OLD_USERNAMES = ["ayber", "wew", "ako", "iver", "test", "ivers"];

const DEMO_PROJECT_CODE = "ACE01";
const EMAIL_DOMAIN = "aceserph.com";

// Departments and positions to add (department -> positions)
const DROPDOWN_ADDITIONS = [
  ["Admin", ["Vice President", "President"]],
  ["Marketing", ["Marketing Head"]],
  ["Accounting", ["Accounting Head"]],
  ["Logistics & Procurement", ["Logistics Head"]],
];

// The suggested Manage Access ticks per Logistics role (Logistics proposal 5.2)
const SUGGESTED_LOGISTICS_PAGES = {
  DocumentController: [
    "logistics-dashboard",
    "logistics-material-requests",
    "logistics-deliveries",
    "logistics-inventory",
    "logistics-movements",
  ],
  ProjectInCharge: [
    "logistics-dashboard",
    "logistics-mr-approvals",
    "logistics-deliveries",
    "logistics-inventory",
    "logistics-movements",
  ],
  ProcurementStaff: [
    "logistics-dashboard",
    "logistics-procurement",
    "logistics-purchase-orders",
    "logistics-deliveries",
    "logistics-inventory",
  ],
  ProcurementHead: [
    "logistics-dashboard",
    "logistics-procurement",
    "logistics-purchase-orders",
    "logistics-po-approvals",
    "logistics-deliveries",
    "logistics-inventory",
  ],
  Accounting: [
    "logistics-dashboard",
    "logistics-purchase-orders",
    "logistics-accounting",
  ],
};

const SCHEDULE = { timeIn: "08:00", timeOut: "17:00" };

// The sample people, in Employee ID order: President, VP, heads, staff, resigned last
const PEOPLE = [
  {
    firstName: "Gregorio",
    lastName: "Esguerra",
    gender: "Male",
    birthday: "1968-03-14",
    department: "Admin",
    position: "President",
    designation: "Head Office",
    employmentType: "Regular",
    startDate: "2025-01-06",
    regularizationDate: "2025-07-06",
    basicPay: 150000,
    contactNumber: "09171230001",
    address: {
      region: "NCR",
      province: "NCR",
      city: "Quezon City",
      barangay: "Barangay Loyola Heights",
      street: "14 Esteban Abada Street",
      postalCode: "1108",
    },
    emergency: ["Teresita", "Esguerra", "09171239001", "Quezon City"],
  },
  {
    firstName: "Celia",
    lastName: "Navarro",
    gender: "Female",
    birthday: "1972-08-22",
    department: "Admin",
    position: "Vice President",
    designation: "Head Office",
    employmentType: "Regular",
    startDate: "2025-01-06",
    regularizationDate: "2025-07-06",
    basicPay: 110000,
    contactNumber: "09171230002",
    address: {
      region: "NCR",
      province: "NCR",
      city: "Makati City",
      barangay: "Barangay San Lorenzo",
      street: "22 Arnaiz Avenue",
      postalCode: "1223",
    },
    emergency: ["Ernesto", "Navarro", "09171239002", "Makati City"],
  },
  {
    firstName: "Maricel",
    lastName: "Santos",
    gender: "Female",
    birthday: "1985-05-09",
    department: "HR",
    position: "HR Head",
    designation: "Head Office",
    employmentType: "Regular",
    startDate: "2025-02-03",
    regularizationDate: "2025-08-03",
    basicPay: 55000,
    contactNumber: "09171230003",
    address: {
      region: "NCR",
      province: "NCR",
      city: "Pasig City",
      barangay: "Barangay Kapitolyo",
      street: "7 West Capitol Drive",
      postalCode: "1603",
    },
    emergency: ["Ramil", "Santos", "09171239003", "Pasig City"],
  },
  {
    firstName: "Jerome",
    lastName: "Bautista",
    gender: "Male",
    birthday: "1983-11-27",
    department: "Logistics & Procurement",
    position: "Logistics Head",
    designation: "Head Office",
    employmentType: "Regular",
    startDate: "2025-03-03",
    regularizationDate: "2025-09-03",
    basicPay: 52000,
    contactNumber: "09171230004",
    address: {
      region: "NCR",
      province: "NCR",
      city: "Caloocan City",
      barangay: "Barangay 176",
      street: "45 Phase 1 Bagong Silang",
      postalCode: "1428",
    },
    emergency: ["Liza", "Bautista", "09171239004", "Caloocan City"],
  },
  {
    firstName: "Kristine",
    lastName: "Mendoza",
    gender: "Female",
    birthday: "1988-02-15",
    department: "Marketing",
    position: "Marketing Head",
    designation: "Head Office",
    employmentType: "Regular",
    startDate: "2025-04-07",
    regularizationDate: "2025-10-07",
    basicPay: 50000,
    contactNumber: "09171230005",
    address: {
      region: "NCR",
      province: "NCR",
      city: "Mandaluyong City",
      barangay: "Barangay Highway Hills",
      street: "10 Shaw Boulevard",
      postalCode: "1550",
    },
    emergency: ["Jose", "Mendoza", "09171239005", "Mandaluyong City"],
  },
  {
    firstName: "Lorna",
    lastName: "Castillo",
    gender: "Female",
    birthday: "1979-07-30",
    department: "Accounting",
    position: "Accounting Head",
    designation: "Head Office",
    employmentType: "Regular",
    startDate: "2025-02-17",
    regularizationDate: "2025-08-17",
    basicPay: 58000,
    contactNumber: "09171230006",
    address: {
      region: "NCR",
      province: "NCR",
      city: "Manila",
      barangay: "Barangay 659",
      street: "312 Taft Avenue, Ermita",
      postalCode: "1000",
    },
    emergency: ["Danilo", "Castillo", "09171239006", "Manila"],
  },
  {
    firstName: "Arnel",
    lastName: "Reyes",
    gender: "Male",
    birthday: "1982-09-18",
    department: "Procurement",
    position: "Procurement Head",
    designation: "Head Office",
    employmentType: "Regular",
    startDate: "2025-05-05",
    regularizationDate: "2025-11-05",
    basicPay: 54000,
    contactNumber: "09171230007",
    address: {
      region: "NCR",
      province: "NCR",
      city: "Marikina City",
      barangay: "Barangay Concepcion Uno",
      street: "18 Bayan-Bayanan Avenue",
      postalCode: "1807",
    },
    emergency: ["Gina", "Reyes", "09171239007", "Marikina City"],
  },
  {
    firstName: "Angelica",
    lastName: "Ramos",
    gender: "Female",
    birthday: "1996-04-03",
    department: "HR",
    position: "HR Staff",
    designation: "Head Office",
    employmentType: "Regular",
    startDate: "2025-09-01",
    regularizationDate: "2026-03-01",
    basicPay: 22000,
    contactNumber: "09171230008",
    address: {
      region: "NCR",
      province: "NCR",
      city: "Taguig City",
      barangay: "Barangay Western Bicutan",
      street: "5 Sampaguita Street",
      postalCode: "1630",
    },
    emergency: ["Rosario", "Ramos", "09171239008", "Taguig City"],
  },
  {
    firstName: "Paolo",
    lastName: "Garcia",
    gender: "Male",
    birthday: "1998-12-11",
    department: "HR",
    position: "Programmer/Web Developer",
    designation: "Head Office",
    employmentType: "Regular",
    startDate: "2025-10-06",
    regularizationDate: "2026-04-06",
    basicPay: 35000,
    contactNumber: "09171230009",
    address: {
      region: "NCR",
      province: "NCR",
      city: "Pasay City",
      barangay: "Barangay 76",
      street: "29 Libertad Street",
      postalCode: "1300",
    },
    emergency: ["Melinda", "Garcia", "09171239009", "Pasay City"],
  },
  {
    firstName: "Rowena",
    lastName: "Aquino",
    gender: "Female",
    birthday: "1995-06-21",
    department: "Operations",
    position: "Document Controller",
    designation: "Arden",
    employmentType: "Regular",
    startDate: "2026-01-12",
    regularizationDate: "2026-07-12",
    basicPay: 22000,
    contactNumber: "09171230010",
    address: {
      region: "Region IV-A",
      province: "Cavite",
      city: "Trece Martires City",
      barangay: "Barangay Cabuco",
      street: "12 Governor's Drive",
      postalCode: "4109",
    },
    emergency: ["Felipe", "Aquino", "09171239010", "Trece Martires City"],
  },
  {
    firstName: "Ramon",
    lastName: "Domingo",
    gender: "Male",
    birthday: "1987-01-25",
    department: "Operations",
    position: "Project In-Charge",
    designation: "Arden",
    employmentType: "Regular",
    startDate: "2026-02-02",
    regularizationDate: "2026-08-02",
    basicPay: 32000,
    contactNumber: "09171230011",
    address: {
      region: "Region IV-A",
      province: "Cavite",
      city: "General Trias",
      barangay: "Barangay Manggahan",
      street: "8 Arnaldo Highway",
      postalCode: "4107",
    },
    emergency: ["Cynthia", "Domingo", "09171239011", "General Trias"],
  },
  {
    firstName: "Carlo",
    lastName: "Mercado",
    gender: "Male",
    birthday: "1999-10-08",
    department: "Procurement",
    position: "Procurement Staff",
    designation: "Head Office",
    employmentType: "Probationary",
    startDate: "2026-08-03",
    regularizationDate: null,
    basicPay: 24000,
    contactNumber: "09171230012",
    address: {
      region: "NCR",
      province: "NCR",
      city: "Paranaque City",
      barangay: "Barangay San Dionisio",
      street: "33 Dona Soledad Avenue",
      postalCode: "1700",
    },
    emergency: ["Norma", "Mercado", "09171239012", "Paranaque City"],
  },
  {
    firstName: "Liza",
    lastName: "Fernandez",
    gender: "Female",
    birthday: "2000-03-17",
    department: "HR",
    position: "HR Staff",
    designation: "Head Office",
    employmentType: "Probationary",
    startDate: "2026-06-01",
    regularizationDate: null,
    basicPay: 18000,
    contactNumber: "09171230013",
    address: {
      region: "NCR",
      province: "NCR",
      city: "Las Pinas City",
      barangay: "Barangay Talon Dos",
      street: "16 Alabang-Zapote Road",
      postalCode: "1747",
    },
    emergency: ["Rogelio", "Fernandez", "09171239013", "Las Pinas City"],
    resignation: {
      resignationDate: "2026-10-16",
      resignationReason:
        "Resigned to take a job closer to her family in Batangas.",
    },
  },
].map((person) => {
  const username = `${person.firstName[0]}${person.lastName}`.toLowerCase();
  const email =
    `${person.firstName}.${person.lastName}@${EMAIL_DOMAIN}`.toLowerCase();
  return { ...person, username, email };
});

const PLANNED_USERNAMES = PEOPLE.map((person) => person.username);

// ---- helpers ----

const ids = (docs) => docs.map((doc) => doc._id);
const peso = (amount) =>
  amount == null ? "" : amount.toLocaleString("en-US", { minimumFractionDigits: 0 });
const statusOf = (person) => (person.resignation ? "Resigned" : "Active");
const fullName = (person) => `${person.firstName} ${person.lastName}`;

const formatTable = (headers, rows) => {
  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => String(row[i]).length)),
  );
  const line = (cells) =>
    cells.map((cell, i) => String(cell).padEnd(widths[i])).join("  ");
  return [
    line(headers),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...rows.map(line),
  ].join("\n");
};

const markdownTable = (headers, rows) =>
  [
    `| ${headers.join(" | ")} |`,
    `|${headers.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");

// The Logistics roles a job gives, and the pages Manage Access would tick for them
const logisticsRolesOf = (person) => {
  const job = { position: person.position, department: person.department };
  const site = siteRole(job);
  return [...headOfficeRoles(job), ...(site ? [site] : [])];
};

const pageAccessFor = (person) => {
  const roles = logisticsRolesOf(person);
  if (roles.length === 0) return undefined; // role default, as Add Employee leaves it
  const defaults = pagesForRole("Employee")
    .filter((page) => !page.defaultOff)
    .map((page) => page.key);
  const logistics = roles.flatMap((role) => SUGGESTED_LOGISTICS_PAGES[role]);
  return normalizePageAccess("Employee", [...defaults, ...logistics]);
};

const fail = async (message) => {
  console.error(`\nREFUSED: ${message}`);
  await mongoose.disconnect();
  process.exit(1);
};

// ---- dropdowns ----

// What would change, with the stored spelling of each existing value
const planDropdown = (dropdown) => {
  const departments = [...(dropdown.departments || [])];
  const addDepartments = [];
  const addPositions = [];
  const resolved = {}; // department -> its positions after the change

  for (const [department, positions] of DROPDOWN_ADDITIONS) {
    let stored = findDuplicate(departments, department);
    if (stored === null) {
      stored = department;
      departments.push(department);
      addDepartments.push(department);
    }
    const list = [...positionsIn(dropdown, stored)];
    for (const position of positions) {
      if (findDuplicate(list, position) === null) {
        list.push(position);
        addPositions.push([stored, position]);
      }
    }
    resolved[stored] = list;
  }

  const positionsAfter = (department) =>
    resolved[department] || positionsIn(dropdown, department);
  return { departments, addDepartments, addPositions, positionsAfter };
};

const applyDropdown = async (plan) => {
  for (const department of plan.addDepartments) {
    // As the dropdown route adds a department: the name and an empty position list
    await Dropdown.findOneAndUpdate(
      {},
      {
        $addToSet: { departments: department },
        $set: { [`positions.${department}`]: [] },
      },
    );
  }
  for (const [department, position] of plan.addPositions) {
    await Dropdown.findOneAndUpdate(
      {},
      { $addToSet: { [`positions.${department}`]: position } },
    );
  }
};

// ---- main ----

async function run() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. Check the root .env file.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(
    `${apply ? "APPLY" : "DRY RUN (nothing is written; add --apply to write)"}: database "${mongoose.connection.name}"\n`,
  );

  // -- Accounts --
  const accounts = await Auth.find({})
    .select("username email role status")
    .lean();
  const admins = accounts.filter((account) => ADMIN_ROLES.includes(account.role));
  const employees = accounts.filter((account) => account.role === "Employee");
  const others = accounts.filter(
    (account) =>
      !ADMIN_ROLES.includes(account.role) && account.role !== "Employee",
  );

  console.log("Accounts found:");
  for (const account of accounts) {
    console.log(
      `  ${account.username.padEnd(12)} ${String(account.role).padEnd(12)} ${account.status}`,
    );
  }

  if (admins.length !== 1) {
    return fail(
      `expected exactly one admin account, found ${admins.length}: ${admins.map((a) => a.username).join(", ") || "none"}.`,
    );
  }
  if (others.length > 0) {
    return fail(
      `accounts with an unexpected role: ${others.map((a) => `${a.username} (${a.role})`).join(", ")}.`,
    );
  }
  const admin = admins[0];

  const found = employees.map((account) => account.username);
  const alreadySeeded =
    found.length === PLANNED_USERNAMES.length &&
    PLANNED_USERNAMES.every((username) => found.includes(username));
  const allowed = new Set([...OLD_USERNAMES, ...PLANNED_USERNAMES]);
  const unknown = found.filter((username) => !allowed.has(username));
  if (unknown.length > 0) {
    return fail(
      `Employee-role accounts not on the list: ${unknown.join(", ")}. Nothing was changed.`,
    );
  }

  console.log(`\nAdmin account: ${admin.username} (role ${admin.role})`);
  console.log(
    `Employee-role accounts found (${found.length}): ${found.join(", ") || "none"}`,
  );

  // Orphans would upset the Employee ID numbering and the counts below
  const accountIds = new Set(accounts.map((account) => String(account._id)));
  const orphanEmployees = (await Employee.find({}).select("userId employeeId").lean())
    .filter((doc) => !accountIds.has(String(doc.userId)));
  const orphanSettings = (await Settings.find({}).select("userId").lean())
    .filter((doc) => !accountIds.has(String(doc.userId)));
  if (orphanEmployees.length || orphanSettings.length) {
    return fail(
      `found ${orphanEmployees.length} Employee and ${orphanSettings.length} Settings records with no account. Tidy them first.`,
    );
  }

  // -- Admin role --
  const adminEmployee = await Employee.findOne({ userId: admin._id })
    .select("role")
    .lean();
  console.log("\nAdmin role:");
  console.log(
    `  Auth ${admin.username}: ${admin.role} -> ${SUPER_ADMIN}${admin.role === SUPER_ADMIN ? " (already)" : ""}`,
  );
  console.log(
    adminEmployee
      ? `  Employee record: ${adminEmployee.role} -> ${SUPER_ADMIN}${adminEmployee.role === SUPER_ADMIN ? " (already)" : ""}`
      : "  Employee record: none",
  );

  // -- Dropdowns --
  const dropdownCount = await Dropdown.countDocuments();
  if (dropdownCount !== 1) {
    return fail(`expected one dropdown document, found ${dropdownCount}.`);
  }
  const dropdown = await Dropdown.findOne().lean();
  const dropdownPlan = planDropdown(dropdown);
  console.log("\nDropdowns:");
  for (const [department] of DROPDOWN_ADDITIONS) {
    const exists = findDuplicate(dropdown.departments, department) !== null;
    console.log(
      `  department ${department}: ${exists ? "exists" : "to be added"}`,
    );
  }
  if (dropdownPlan.addPositions.length === 0) {
    console.log("  positions: nothing to add");
  }
  for (const [department, position] of dropdownPlan.addPositions) {
    console.log(`  position to add: ${department} > ${position}`);
  }

  // Each person's department and position must be in the dropdowns (after the
  // additions); use the stored spelling
  for (const person of PEOPLE) {
    const department = findDuplicate(dropdownPlan.departments, person.department);
    const position =
      department === null
        ? null
        : findDuplicate(dropdownPlan.positionsAfter(department), person.position);
    if (department === null || position === null) {
      return fail(
        `${fullName(person)}: ${person.department} > ${person.position} is not in the dropdowns.`,
      );
    }
    person.department = department;
    person.position = position;
    if (findDuplicate(dropdown.designations, person.designation) === null) {
      return fail(`${fullName(person)}: work location ${person.designation} is not in the dropdowns.`);
    }
    if (findDuplicate(dropdown.employmentTypes, person.employmentType) === null) {
      return fail(`${fullName(person)}: employment type ${person.employmentType} is not in the dropdowns.`);
    }
  }

  // -- Project --
  const project = await Project.findOne({ code: DEMO_PROJECT_CODE }).lean();
  if (!project) {
    return fail(`demo project ${DEMO_PROJECT_CODE} not found.`);
  }
  const inChargePerson = PEOPLE.find(
    (person) => siteRole(person) === "ProjectInCharge" && !person.resignation,
  );
  const controllerPerson = PEOPLE.find(
    (person) => siteRole(person) === "DocumentController" && !person.resignation,
  );

  if (alreadySeeded) {
    console.log(
      "\nThe sample people already exist: nothing to delete or create. Checking the admin role, dropdowns and project seats only.",
    );
    const byUsername = new Map(employees.map((a) => [a.username, a._id]));
    const inChargeId = byUsername.get(inChargePerson.username);
    const controllerId = byUsername.get(controllerPerson.username);
    console.log(
      `Project ${project.code}: In-charge ${inChargePerson.username}, Document Controller ${controllerPerson.username}`,
    );
    if (apply) {
      await applyAdminRole(admin, adminEmployee);
      await applyDropdown(dropdownPlan);
      await Project.updateOne(
        { _id: project._id },
        { $set: { inChargeId, documentControllerIds: [controllerId] } },
      );
      console.log("\nDone.");
    }
    await mongoose.disconnect();
    return;
  }

  // -- What gets deleted --
  const doomed = employees;
  const doomedIds = ids(doomed);
  if (doomedIds.some((id) => String(id) === String(admin._id))) {
    return fail("the admin account would be deleted.");
  }

  const byUser = { userId: { $in: doomedIds } };
  const counts = {
    auths: doomedIds.length,
    employees: await Employee.countDocuments(byUser),
    settings: await Settings.countDocuments(byUser),
    attendance: await Attendance.countDocuments(byUser),
    leaveapplications: await LeaveApplication.countDocuments(byUser),
    overtimeapplications: await OvertimeApplication.countDocuments(byUser),
    basicpaychanges: await BasicPayChange.countDocuments(byUser),
  };

  // Kept collections that point at the people being deleted
  const keptRefs = {
    "projects.createdBy": await Project.countDocuments({ createdBy: { $in: doomedIds } }),
    "items.createdBy/requestedBy/reviewedBy": await Item.countDocuments({
      $or: [
        { createdBy: { $in: doomedIds } },
        { requestedBy: { $in: doomedIds } },
        { reviewedBy: { $in: doomedIds } },
      ],
    }),
    "suppliers.createdBy": await Supplier.countDocuments({ createdBy: { $in: doomedIds } }),
    "companySettings.updatedBy": await CompanySettings.countDocuments({
      updatedBy: { $in: doomedIds },
    }),
    "basicpaychanges.changedBy (of kept records)": await BasicPayChange.countDocuments({
      changedBy: { $in: doomedIds },
      userId: { $nin: doomedIds },
    }),
  };
  const seats = await Project.find({
    $or: [
      { inChargeId: { $in: doomedIds } },
      { documentControllerIds: { $in: doomedIds } },
    ],
  })
    .select("code inChargeId documentControllerIds")
    .lean();

  console.log("\nTo delete (per collection):");
  for (const [collection, count] of Object.entries(counts)) {
    console.log(`  ${collection.padEnd(22)} ${count}`);
  }
  const usernameOf = new Map(accounts.map((a) => [String(a._id), a.username]));
  console.log(`  project seats          ${seats.length} project(s)`);
  for (const seat of seats) {
    const ic = seat.inChargeId ? usernameOf.get(String(seat.inChargeId)) : "none";
    const dcs = (seat.documentControllerIds || [])
      .map((id) => usernameOf.get(String(id)) || String(id))
      .join(", ");
    console.log(`    ${seat.code}: In-charge ${ic}; Document Controllers ${dcs || "none"}`);
  }
  console.log("\nKept records that point at them (must be 0):");
  for (const [field, count] of Object.entries(keptRefs)) {
    console.log(`  ${field.padEnd(44)} ${count}`);
  }
  if (Object.values(keptRefs).some((count) => count > 0)) {
    return fail("kept records point at accounts that would be deleted.");
  }

  console.log("\nKept as they are:");
  for (const [label, model] of [
    ["items", Item],
    ["suppliers", Supplier],
    ["projects", Project],
    ["companySettings", CompanySettings],
    ["dropdowns", Dropdown],
  ]) {
    console.log(`  ${label.padEnd(22)} ${await model.countDocuments()}`);
  }
  console.log("  deductions             no per-person records (not touched)");

  // -- Employee IDs --
  // No counter document: the next ID is one after the highest AC-<n> on the
  // Employee records that remain (the admin's record has none)
  const keptIds = await Employee.find({
    userId: { $nin: doomedIds },
    employeeId: { $regex: /^AC-\d+$/ },
  })
    .select("employeeId")
    .lean();
  const highest = Math.max(
    0,
    ...keptIds.map((doc) => parseInt(doc.employeeId.split("-")[1], 10)),
  );
  PEOPLE.forEach((person, index) => {
    person.employeeId = `AC-${String(highest + index + 1).padStart(3, "0")}`;
  });
  console.log(
    `\nEmployee IDs: the highest kept AC-number is ${highest ? `AC-${String(highest).padStart(3, "0")}` : "none"}, so the new people start at ${PEOPLE[0].employeeId}.`,
  );

  // -- Clashes and checks, before anything is written --
  const keptAccounts = accounts.filter(
    (account) => !doomedIds.some((id) => String(id) === String(account._id)),
  );
  for (const person of PEOPLE) {
    if (keptAccounts.some((a) => a.username === person.username)) {
      return fail(`username ${person.username} is taken by a kept account.`);
    }
    if (keptAccounts.some((a) => a.email === person.email)) {
      return fail(`email ${person.email} is taken by a kept account.`);
    }
    const job = checkJobDetails(jobBody(person));
    if (job.error) return fail(`${fullName(person)}: ${job.error}`);
    if (person.resignation) {
      const resignation = checkResignation(person.resignation, {
        startDate: person.startDate,
      });
      if (resignation.error) return fail(`${fullName(person)}: ${resignation.error}`);
    }
  }
  if (new Set(PLANNED_USERNAMES).size !== PEOPLE.length) {
    return fail("two planned people share a username.");
  }

  // -- The plan --
  const headers = [
    "Employee ID",
    "Name",
    "Department",
    "Position",
    "Username",
    "Email",
    "Basic pay",
    "Status",
  ];
  const planRows = PEOPLE.map((person) => [
    person.employeeId,
    fullName(person),
    person.department,
    person.position,
    person.username,
    person.email,
    peso(person.basicPay),
    statusOf(person),
  ]);
  console.log("\nPeople to create:");
  console.log(formatTable(headers, planRows));

  console.log("\nEmployment details:");
  console.log(
    formatTable(
      ["Employee ID", "Gender", "Birthday", "Location", "Type", "Start", "Regularized", "Last day", "Logistics pages"],
      PEOPLE.map((person) => {
        const pages = pageAccessFor(person);
        return [
          person.employeeId,
          person.gender,
          person.birthday,
          person.designation,
          person.employmentType,
          person.startDate,
          person.regularizationDate || "",
          person.resignation?.resignationDate || "",
          pages
            ? pages.filter((key) => key.startsWith("logistics-")).map((key) => key.slice(10)).join(", ")
            : "",
        ];
      }),
    ),
  );
  console.log(
    `\nProject ${project.code} "${project.name}": In-charge -> ${fullName(inChargePerson)} (${inChargePerson.username}); Document Controllers -> ${fullName(controllerPerson)} (${controllerPerson.username})`,
  );
  console.log(
    "Basic pay history: none created (Add Employee creates none; the pay is on the job description).",
  );

  if (!apply) {
    console.log("\nDry run only. Run again with --apply to write.");
    await mongoose.disconnect();
    return;
  }

  // ---- Write ----
  console.log("\nWriting...");

  await Attendance.deleteMany(byUser);
  await LeaveApplication.deleteMany(byUser);
  await OvertimeApplication.deleteMany(byUser);
  await BasicPayChange.deleteMany(byUser);
  await Project.updateMany(
    { inChargeId: { $in: doomedIds } },
    { $set: { inChargeId: null } },
  );
  await Project.updateMany(
    { documentControllerIds: { $in: doomedIds } },
    { $pull: { documentControllerIds: { $in: doomedIds } } },
  );
  await Settings.deleteMany(byUser);
  await Employee.deleteMany(byUser);
  await Auth.deleteMany({ _id: { $in: doomedIds }, role: "Employee" });
  console.log(`  deleted ${doomedIds.length} accounts and their records`);

  await applyAdminRole(admin, adminEmployee);
  console.log(`  ${admin.username} is now ${SUPER_ADMIN}`);

  await applyDropdown(dropdownPlan);
  console.log("  dropdowns updated");

  const created = [];
  for (const person of PEOPLE) {
    const employeeId = await nextEmployeeId();
    if (employeeId !== person.employeeId) {
      return fail(
        `expected ${person.employeeId} for ${fullName(person)} but the next ID is ${employeeId}. Stopped; the people before this one were created.`,
      );
    }
    const password = generateTemporaryPassword();
    const body = { ...jobBody(person), employeeId, password };

    // As POST /api/employee/add-employee-via-admin
    const job = checkJobDetails(body);
    const { user } = await createEmployeeAccount(body, job.fields);

    // As Edit Employee (the profile fields Add Employee leaves empty)
    await Employee.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          birthday: person.birthday,
          contactNumber: person.contactNumber,
          address: { country: "Philippines", ...person.address },
          emergencyDetails: {
            contactFirstName: person.emergency[0],
            contactLastName: person.emergency[1],
            contactEmergency: person.emergency[2],
            contactAddress: person.emergency[3],
          },
        },
      },
    );

    // As Manage Access, for the logistics positions
    const pageAccess = pageAccessFor(person);
    if (pageAccess) {
      await Auth.updateOne(
        { _id: user._id },
        { $set: { pageAccess, updatedAt: new Date() } },
      );
    }

    // As the Resign button
    if (person.resignation) {
      const resignation = checkResignation(person.resignation, {
        startDate: person.startDate,
      });
      await Auth.findOneAndUpdate(
        { _id: user._id, status: "Active" },
        { status: "Resigned", updatedAt: new Date() },
      );
      await Settings.findOneAndUpdate(
        { userId: user._id },
        {
          $set: {
            "general.jobDescription.resignationDate":
              resignation.fields.resignationDate,
            "general.jobDescription.resignationReason":
              resignation.fields.resignationReason,
          },
        },
        { upsert: true },
      );
    }

    created.push({ person, password, userId: user._id });
    console.log(`  created ${employeeId} ${fullName(person)}`);
  }

  const idOf = (person) =>
    created.find((entry) => entry.person === person).userId;
  await Project.updateOne(
    { _id: project._id },
    {
      $set: {
        inChargeId: idOf(inChargePerson),
        documentControllerIds: [idOf(controllerPerson)],
      },
    },
  );
  console.log(`  project ${project.code} seats set`);

  const finalHeaders = [
    "Employee ID",
    "Name",
    "Department",
    "Position",
    "Username",
    "Email",
    "Password",
    "Basic pay",
    "Status",
  ];
  const finalRows = created.map(({ person, password }) => [
    person.employeeId,
    fullName(person),
    person.department,
    person.position,
    person.username,
    person.email,
    password,
    peso(person.basicPay),
    statusOf(person),
  ]);
  console.log("\nSample accounts (passwords are shown only now):");
  console.log(formatTable(finalHeaders, finalRows));

  const today = manilaToday();
  const dir = path.join(__dirname, "..", "reports", "Seed");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${today} sample accounts.md`);
  fs.writeFileSync(
    file,
    [
      `# Sample accounts (${today})`,
      "",
      "Created by `node backend/scripts/resetSampleEmployees.js --apply`. Local data only.",
      `The admin account (${admin.username}) is the Super Admin; its password is unchanged.`,
      "",
      markdownTable(finalHeaders, finalRows),
      "",
    ].join("\n"),
  );
  console.log(`\nWrote ${path.relative(path.join(__dirname, "..", ".."), file)}`);

  await mongoose.disconnect();
}

// The Add Employee request body for a person (without the ID and password)
function jobBody(person) {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    gender: person.gender,
    email: person.email,
    username: person.username,
    designation: person.designation,
    department: person.department,
    position: person.position,
    employmentType: person.employmentType,
    startDate: person.startDate,
    regularizationDate: person.regularizationDate ?? "",
    basicPay: person.basicPay,
    timeIn: SCHEDULE.timeIn,
    timeOut: SCHEDULE.timeOut,
  };
}

async function applyAdminRole(admin, adminEmployee) {
  await Auth.updateOne(
    { _id: admin._id },
    { $set: { role: SUPER_ADMIN, updatedAt: new Date() } },
  );
  if (adminEmployee) {
    await Employee.updateOne(
      { userId: admin._id },
      { $set: { role: SUPER_ADMIN } },
    );
  }
}

run().catch(async (err) => {
  console.error("Reset failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
