const cron = require("node-cron");
const ZKTecoService = require("../utils/zktecoService");
const Attendance = require("../models/attendance");
const Employee = require("../models/employees");
const User = require("../models/authUsers");

// Run every day at 6:00 AM to sync biometric data from ZKTeco device
cron.schedule("0 6 * * *", async () => {
  console.log("Starting biometric data sync...");

  try {
    const deviceIp = process.env.ZKTECO_DEVICE_IP || "192.168.1.100";
    const zkService = new ZKTecoService(deviceIp);

    const connected = await zkService.connect();
    if (!connected) {
      console.error("Failed to connect to ZKTeco device");
      return;
    }

    const zkRecords = await zkService.getAttendanceRecords();
    const employees = await Employee.find();
    let syncedCount = 0;

    for (const zkRecord of zkRecords) {
      const emp = employees.find(
        (e) => e.employeeId === zkRecord.userId.toString(),
      );

      if (!emp) continue;

      const user = await User.findOne({ email: emp.email });
      if (!user) continue;

      const recordDate = new Date(zkRecord.timestamp);
      const dateStr = recordDate.toISOString().split("T")[0];

      let attendance = await Attendance.findOne({
        userId: user._id,
        date: dateStr,
      });

      if (!attendance) {
        attendance = new Attendance({
          userId: user._id,
          date: dateStr,
        });
      }

      if (!attendance.timeIn) {
        attendance.timeIn = new Date(
          `${dateStr}T${zkRecord.time.substring(0, 8)}`,
        );
      } else {
        attendance.timeOut = new Date(
          `${dateStr}T${zkRecord.time.substring(0, 8)}`,
        );
      }

      await attendance.save();
      syncedCount++;
    }

    await zkService.disconnect();
    console.log(`Biometric sync completed. Synced ${syncedCount} records.`);
  } catch (error) {
    console.error("Error in biometeric sync scheduler:", error);
  }
});
