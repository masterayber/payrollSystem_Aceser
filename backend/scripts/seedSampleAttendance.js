// Writes sample attendance for testing behavior and time in/out. Run by hand, never on a schedule.
//
// Run from the project root (it reads MONGO_URI from the root .env):
//   node backend/scripts/seedSampleAttendance.js                       -> dry run, only counts
//   node backend/scripts/seedSampleAttendance.js --apply               -> writes the records
//   node backend/scripts/seedSampleAttendance.js --from 2026-10-01 --to 2026-10-21 --apply
//   node backend/scripts/seedSampleAttendance.js --clear               -> counts sample records
//   node backend/scripts/seedSampleAttendance.js --clear --apply       -> deletes sample records only
//
// Defaults: --from is the 1st of the current month, --to is yesterday (Manila time).

const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const Employee = require("../models/employees");
const User = require("../models/authUsers");
const Attendance = require("../models/attendance");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const clear = args.includes("--clear");
const argValue = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};

const ABSENT_CHANCE = 0.15;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Today's date in Manila as YYYY-MM-DD ("en-CA" formats dates that way)
const manilaToday = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

// Dates are handled as UTC midnights so the day never shifts with the machine's time zone
const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
};

// Random HH:MM:SS between two HH:MM times
const randomTime = (start, end) => {
  const toSeconds = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 3600 + m * 60;
  };
  const from = toSeconds(start);
  const seconds = from + Math.floor(Math.random() * (toSeconds(end) - from));
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
};

async function clearSamples() {
  const count = await Attendance.countDocuments({ sample: true });
  console.log(`Sample attendance records: ${count}`);
  if (count === 0) return console.log("Nothing to clear.");
  if (!apply)
    return console.log(
      "Dry run only. Re-run with --clear --apply to delete them.",
    );
  const result = await Attendance.deleteMany({ sample: true });
  console.log(`Deleted ${result.deletedCount} sample record(s).`);
}

async function seed() {
  const today = manilaToday();
  const from = argValue("--from") || `${today.slice(0, 8)}01`;
  const to = argValue("--to") || addDays(today, -1);

  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || from > to) {
    console.error(
      "--from and --to must be YYYY-MM-DD dates, with --from on or before --to.",
    );
    process.exitCode = 1;
    return;
  }
  if (to >= today) {
    console.error(
      "--to must be before today, so the app still records today for real.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Seeding ${from} to ${to}${apply ? "" : " (dry run)"}`);

  const employees = await Employee.find();
  let created = 0;
  let absent = 0;
  let skipped = 0;

  for (const emp of employees) {
    if (emp.role === "Admin") continue;

    const user = await User.findOne({ email: emp.email });
    if (!user || user.status === "Pending") continue;

    for (let date = from; date <= to; date = addDays(date, 1)) {
      const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const existing = await Attendance.exists({ userId: user._id, date });
      if (existing) {
        skipped++;
        continue;
      }

      // Absent days get a record with no times, so a re-run doesn't fill them in.
      // The pre("save") hook sets behavior to "Absent" for a past date with no times.
      if (Math.random() < ABSENT_CHANCE) {
        if (apply) {
          await Attendance.create({ userId: user._id, date, sample: true });
        }
        absent++;
        continue;
      }

      const timeIn = randomTime("07:30", "08:30");
      const timeOut = randomTime("16:30", "19:30");

      if (apply) {
        // Behavior and overtime are worked out by the model's pre("save") hook
        await Attendance.create({
          userId: user._id,
          date,
          timeIn: new Date(`${date}T${timeIn}Z`),
          timeOut: new Date(`${date}T${timeOut}Z`),
          sample: true,
        });
      }
      created++;
    }
  }

  console.log(
    `${apply ? "Created" : "Would create"} ${created} present and ${absent} absent record(s); ` +
      `${skipped} day(s) already had a record.`,
  );

  if (!apply) console.log("Dry run only. Re-run with --apply to write them.");
}

async function run() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to run with NODE_ENV=production.");
    process.exit(1);
  }
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. Check the root .env file.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  if (clear) await clearSamples();
  else await seed();
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Seeding failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
