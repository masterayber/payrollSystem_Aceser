const cron = require("node-cron");
const Employee = require("../models/employees");
const User = require("../models/authUsers");
const Attendance = require("../models/attendance");

cron.schedule("0 5 * * 1-5", async () => {
  console.log("Running daily blank attendance scheduler...");
  try {
    const employees = await Employee.find();
    const today = new Date().toISOString().split("T")[0];

    for (const emp of employees) {
      if (emp.role === "Admin") {
        continue;
      }

      const user = await User.findOne({ email: emp.email });

      if (!user || user.status === "Pending") {
        continue;
      }

      const existingAttendance = await Attendance.findOne({
        userId: user._id,
        date: today,
      });

      if (!existingAttendance) {
        try {
          await Attendance.create({
            userId: user._id,
            timeIn: "--:--",
            timeOut: "--:--",
            date: today,
          });

          console.log(
            `Blank attendance created for ${emp.firstName} ${emp.lastName} on ${today}`,
          );
        } catch (err) {
          console.error(
            `Error creating blank attendance for ${emp.firstName} ${emp.lastName}:`,
            err.message,
          );
        }
      }
    }
  } catch (err) {
    console.error("Error in daily blank attendance scheduler:", err);
  }
});

module.exports = cron;
