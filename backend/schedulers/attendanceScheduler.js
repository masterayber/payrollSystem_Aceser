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

    for (const emp of employees) {
      if (emp.role === "Admin") {
        console.log(
          `Skipping attendance generation for admin: ${emp.firstName} ${emp.lastName}`,
        );
        continue;
      }

      const user = await User.findOne({ email: emp.email });

      if (!user || user.status === "Pending") {
        console.log(
          `Skipping attenance generation for pending employees: ${emp.firstName} ${emp.lastName}`,
        );
        continue;
      }

      const dateToday = new Date().toISOString().split("T")[0];

      const existing = await Attendance.findOne({
        employeeId: emp._id,
        date: dateToday,
      });

      if (!existing) {
        const timeIn = getRandomTime("07:30", "08:15");
        const timeOut = getRandomTime("17:00", "18:00");

        await Attendance.create({
          userId: user._id,
          date: dateToday,
          timeIn,
          timeOut,
        });

        console.log(`Attendance saved from ${emp.firstName} ${emp.lastName}`);
      }
    }
  } catch (err) {
    console.error("Error in attendance scheduler:", err);
  }
});
