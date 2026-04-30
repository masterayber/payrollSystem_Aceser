const cron = require("node-cron");
const Employee = require("../models/employees");
const User = require("../models/authUsers");
const Attendance = require("../models/attendance");

const getRandomTime = (start, end) => {
  const startDate = new Date(`1970-01-01T${start}:00`);
  const endDate = new Date(`1970-01-01T${end}:00`);
  const diff = endDate - startDate;
  const newTime = new Date(startDate.getTime() + Math.random() * diff);
  return newTime.toTimeString().substring(0, 5);
};

// TEMPORARY: This scheduler is modified to populate sample attendance data for the entire year 2026
// After setting sample data, revert the crom schedule back to "30 7 * * 1-5" and remove the historical data population logic.
// Remove the following lines after sample data is set:
// - const currentYear = ...
// - const startOfYear = ...
// - const today = ...
// - for (let dayOffset = ... ) { ... }
// And restore the original loop for daily attendance.
cron.schedule("30 7 * * 1-5", async () => {
  // TEMPORARY: Runs once on April 29, 2026 at 8:00 AM
  console.log("Running temporary attendance scheduler for sample data...");
  try {
    const employees = await Employee.find();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const absentChance = 0.25; // 25% chance of being absent on a workday

    for (const emp of employees) {
      if (emp.role === "Admin") {
        continue;
      }

      const user = await User.findOne({ email: emp.email });
      if (!user || user.status === "Pending") continue;

      const employmentDate = new Date(emp.createdAt);
      const startDate =
        employmentDate > startOfMonth ? employmentDate : startOfMonth;

      for (
        let d = new Date(startDate);
        d <= endOfMonth;
        d.setDate(d.getDate() + 1)
      ) {
        const dateStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .split("T")[0];
        const dayOfWeek = d.getDay();

        if (dayOfWeek === 0 || dayOfWeek === 6) {
          continue;
        }

        const existing = await Attendance.findOne({
          userId: user._id,
          date: dateStr,
        });

        if (existing) {
          continue;
        }

        const shouldCreateAttendance = Math.random() > absentChance;

        if (!shouldCreateAttendance) {
          console.log(
            `No attendance recorded for ${emp.firstName} ${emp.lastName} on ${dateStr} (absent)`,
          );
          continue;
        }

        const timeIn = getRandomTime("07:30", "08:30");
        const timeOut = getRandomTime("17:00", "20:00");

        await Attendance.create({
          userId: user._id,
          date: dateStr,
          timeIn,
          timeOut,
        });

        console.log(
          `Attendance saved for ${emp.firstName} ${emp.lastName} on ${dateStr}`,
        );
      }
    }
  } catch (err) {
    console.error("Error in temporary attendance scheduler:", err);
  }
});
