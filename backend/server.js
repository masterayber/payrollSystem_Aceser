const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 5000;

const authRoutes = require("./routes/auth");

const dotenv = require("dotenv");
const cors = require("cors");

const authMiddleware = require("./middleware/authMiddleware");

dotenv.config();

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/payroll_system", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Example protected route
app.get("/api/protected", authMiddleware, (req, res) => {
  res.json({ message: "You have access to this protected route" });
});
