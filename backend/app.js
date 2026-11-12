const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const attendanceRoutes = require("./routes/attendance");
const dropdownRoutes = require("./routes/dropdownOption");
const employeeRoutes = require("./routes/employee");
const filingRoutes = require("./routes/filing");
const accessRoutes = require("./routes/access");
const settingsRoutes = require("./routes/settings");
const logisticsRoutes = require("./routes/logistics");
const thirteenthMonthRoutes = require("./routes/thirteenthMonth");
const adminRoutes = require("./routes/admins");
const holidayRoutes = require("./routes/holidays");

const { requireAuthenticated } = require("./middleware/accessMiddleware");

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/dropdownOption", dropdownRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/filing", filingRoutes);
app.use("/api/access", accessRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/logistics", logisticsRoutes);
app.use("/api/thirteenth-month", thirteenthMonthRoutes);
app.use("/api/admins", adminRoutes);
app.use("/api/holidays", holidayRoutes);

app.get("/", (req, res) => {
  res.send("API is running...");
});

// Example protected route (through loadCurrentUser like every signed-in route, so an
// inactive account, a changed role or a pending password change is refused here too)
app.get("/api/protected", requireAuthenticated, (req, res) => {
  res.json({ message: "You have access to this protected route" });
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

module.exports = app;
