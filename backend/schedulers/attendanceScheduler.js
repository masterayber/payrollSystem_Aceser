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

cron.schedule("30 7 * * 1-5", async () => {
  console.log("Running attendance scheduler...");
  try {
    const employees = await Employee.find();

    // Temporary: Generate for last 30 days continuously
    // TODO: After backfilling, remove the date loop and change back to single date (yesterday)
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - dayOffset);
      const dateStr = targetDate.toISOString().split("T")[0];

      for (const emp of employees) {
        if (emp.role === "Admin") {
          continue;
        }

        const user = await User.findOne({ email: emp.email });

        if (!user || user.status === "Pending") {
          continue;
        }

        const existing = await Attendance.findOne({
          userId: user._id,
          date: dateStr,
        });

        if (!existing) {
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
    }
  } catch (err) {
    console.error("Error in attendance scheduler:", err);
  }
});
