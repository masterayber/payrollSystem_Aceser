// Load .env before anything else read process.env
require("dotenv").config();

const http = require("http");
const mongoose = require("mongoose");
const socketIo = require("socket.io");

// Tokens are signed with this secret, so a missing or well-known value would let anyone
// forge and Admin login. Refuse to start rather than run insecurely.
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

const app = require("./app");

const PORT = process.env.PORT | 5000;

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() =>
    console.log(
      "MongoDB connected successfully",
      mongoose.connection.readyState,
    ),
  )
  .catch((err) => console.error("MongoDB connection error:", err));

require("./schedulers/attendanceScheduler");

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
