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

const dotenv = require("dotenv");

const authMiddleware = require("./middleware/authMiddleware");

dotenv.config();

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

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
      mongoose.connection.readyState
    )
  )
  .catch((err) => console.error("MongoDB connection error:", err));

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
