// Realtime seam for the Logistics module.
//
// Phase 1 ships this as a no-op so the routes can already say "these people's
// access changed" without a Socket.IO server behind it. Phase 8 wires Socket.IO
// here: server.js calls init(io) once, and emitToUsers sends `event` with
// `payload` to every socket room named after a user id.
let io = null;

const init = (socketServer) => {
  io = socketServer;
};

// userIds: array of Auth ids (strings or ObjectIds). Returns true when something
// was sent, false otherwise. No-op until phase 8.
const emitToUsers = (userIds, event, payload) => {
  if (!io || !Array.isArray(userIds) || userIds.length === 0) return false;
  // Phase 8: for (const id of userIds) io.to(String(id)).emit(event, payload);
  void event;
  void payload;
  return false;
};

module.exports = { init, emitToUsers };
