const ZKTeco = require("zkteco-js");

class ZKTecoService {
  constructor(ip, port) {
    this.device = new ZKTeco({
      ip,
      port,
      timeout: 10000,
    });
  }

  async connect() {
    try {
      await this.device.connect();
      console.log("Connected to ZKTeco device");
      return true;
    } catch (error) {
      console.error("Failed to connect to ZKTeco device:", error);
      return false;
    }
  }

  async disconnect() {
    try {
      await this.device.disconnect();
      console.log("Disconnected from ZKTeco device");
    } catch (error) {
      console.error("Failed to disconnect from ZKTeco device:", error);
    }
  }

  async getAttendanceRecords() {
    try {
      const logs = await this.device.getAttendances();
      return logs;
    } catch (error) {
      console.error("Error fetching attendance logs:", error);
      return [];
    }
  }

  async getUsers() {
    try {
      const users = await this.device.getUsers();
      return users;
    } catch (error) {
      console.error("Error fetching users:", error);
      return [];
    }
  }
}

module.exports = ZKTecoService;
