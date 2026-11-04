const { normalize } = require("./logisticsAccess");

// The stored value in `list` that matches `value` once capitals and outer
// spaces are ignored, or null when there is none. `skipIndex` leaves out the
// entry being renamed, so a value may be renamed to a case variant of itself.
const findDuplicate = (list, value, skipIndex = -1) => {
  const key = normalize(value);
  const match = (list || []).find(
    (entry, index) => index !== skipIndex && normalize(entry) === key,
  );
  return match === undefined ? null : match;
};

// A department's positions, whether the document is a Mongoose doc (Map) or
// a lean plain object
const positionsIn = (dropdown, department) => {
  const positions = dropdown?.positions;
  if (!positions) return [];
  const list =
    positions instanceof Map ? positions.get(department) : positions[department];
  return list || [];
};

module.exports = { findDuplicate, positionsIn };
