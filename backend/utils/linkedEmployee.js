// An Admin account may be linked to one employee: the same person's Employee-role
// account (Q18). That Admin can't act on its own employee record: edit it, resign or
// reinstate it, change its page access or its Logistics project seat, approve it, or
// decide anything for it. The Super Admin has no linked employee and is never
// stopped by this rule.
// Pure functions, no database: `currentUser` is req.currentUser from loadCurrentUser.
const { isPlainAdmin } = require("../config/roles");

const OWN_RECORD_MESSAGE = "You can't act on your own employee record.";

// True when `currentUser` is an Admin whose linked employee is `userId`
const isOwnLinkedEmployee = (currentUser, userId) =>
  Boolean(
    currentUser &&
      isPlainAdmin(currentUser.role) &&
      currentUser.linkedEmployeeId != null &&
      userId != null &&
      String(currentUser.linkedEmployeeId) === String(userId),
  );

// The seat `userId` holds in a project's membership ({ inChargeId,
// documentControllerIds }): "ProjectInCharge", "DocumentController" or null
const projectSeat = (userId, { inChargeId, documentControllerIds } = {}) => {
  if (userId == null) return null;
  const id = String(userId);
  if (inChargeId != null && String(inChargeId) === id) return "ProjectInCharge";
  const controllers = Array.isArray(documentControllerIds)
    ? documentControllerIds
    : [];
  return controllers.some((entry) => entry != null && String(entry) === id)
    ? "DocumentController"
    : null;
};

// Rule 16 in Logistics: project membership is where the two site roles (and so an
// employee's Logistics access on a project) are given. True when an Admin's change
// from `before` to `after` would seat, unseat or move its linked employee. Edits
// that leave that seat as it was pass.
const changesOwnProjectSeat = (currentUser, before, after) => {
  const linked = currentUser?.linkedEmployeeId;
  return (
    isOwnLinkedEmployee(currentUser, linked) &&
    projectSeat(linked, before) !== projectSeat(linked, after)
  );
};

module.exports = {
  OWN_RECORD_MESSAGE,
  isOwnLinkedEmployee,
  projectSeat,
  changesOwnProjectSeat,
};
