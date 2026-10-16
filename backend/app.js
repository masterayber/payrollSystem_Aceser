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

const authMiddleware = require("./middleware/authMiddleware");

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

app.get("/", (req, res) => {
  res.send("API is running...");
});

// Example protected route
app.get("/api/protected", authMiddleware, (req, res) => {
  res.json({ message: "You have access to this protected route" });
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

module.exports = app;
