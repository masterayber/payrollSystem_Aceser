const path = require("path");
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const socketIo = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    method: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5000;

const authRoutes = require("./routes/auth");
const attendanceRoutes = require("./routes/attendance");
const dropdownRoutes = require("./routes/dropdownOption");
const employeeRoutes = require("./routes/employee");
const filingRoutes = require("./routes/filing");
const accessRoutes = require("./routes/access");

const dotenv = require("dotenv");

const authMiddleware = require("./middleware/authMiddleware");

dotenv.config();

// Tokens are signed with this secret, so a missing or well-known value would let anyone
// forge an Admin login. Refuse to start rather than run insecurely.
const PLACEHOLDER_SECRETS = ["your_jwt_secret_key", "your_jwt_secret_key_here"];
if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 32 ||
  PLACEHOLDER_SECRETS.includes(process.env.JWT_SECRET)
) {
  console.error(
    "JWT_SECRET is missing, too short (min 32 chars) or still a placeholder. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
  );
  process.exit(1);
}

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/dropdownOption", dropdownRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/filing", filingRoutes);
app.use("/api/access", accessRoutes);

io.on("connection", (socket) => {
  socket.on("approveUser", (data) => {
    io.emit("userApproved", data);
  });
});

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/payroll_system", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() =>
    console.log(
      "MongoDB connected successfully",
      mongoose.connection.readyState,
    ),
  )
  .catch((err) => console.error("MongoDB connection error:", err));

require("./schedulers/attendanceScheduler");

// Routes
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Example protected route
app.get("/api/protected", authMiddleware, (req, res) => {
  res.json({ message: "You have access to this protected route" });
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
