// Pure helpers for the logistics roles. No database: the route (or the
// middleware) loads the person's job description and the project, and these
// functions say which logistics roles the person holds.
//
// Roles come from the job description in Settings (position and department),
// matched after trim and case-insensitively. The two site roles also need the
// person on the Project document (inChargeId or documentControllerIds), and
// they count only while the position still matches: a Document Controller who
// became Procurement Staff stays listed on the project (so the admin can see and
// fix it) but no longer gets the DocumentController role.
const {
  LOGISTICS_ROLES,
  RESERVED_POSITIONS,
  RESERVED_DEPARTMENTS,
  HEAD_OFFICE_ROLES,
  SITE_ROLES,
} = require("../config/logistics");

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const positionOf = (jobDescription) => normalize(jobDescription?.position);
const departmentOf = (jobDescription) => normalize(jobDescription?.department);

// True when the person's position (or department, for Accounting) matches the
// role's label. Used for the "no longer holds the position" flag on Setup.
const positionMatches = (jobDescription, roleName) => {
  const role = LOGISTICS_ROLES[roleName];
  if (!role) return false;
  if (role.department) {
    return departmentOf(jobDescription) === normalize(role.department);
  }
  return positionOf(jobDescription) === normalize(role.position);
};

// Set of "ProcurementStaff" | "ProcurementHead" | "Accounting"
const headOfficeRoles = (jobDescription) =>
  new Set(
    HEAD_OFFICE_ROLES.filter((roleName) =>
      positionMatches(jobDescription, roleName),
    ),
  );

// "DocumentController" | "ProjectInCharge" | null
const siteRole = (jobDescription) =>
  SITE_ROLES.find((roleName) => positionMatches(jobDescription, roleName)) ??
  null;

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

// Every logistics role the person holds on this project. `project` may be null,
// in which case only the head-office roles are returned.
const rolesOnProject = (userId, jobDescription, project) => {
  const roles = headOfficeRoles(jobDescription);
  if (!project) return roles;

  const site = siteRole(jobDescription);
  if (site === "ProjectInCharge" && sameId(project.inChargeId, userId)) {
    roles.add("ProjectInCharge");
  }
  if (
    site === "DocumentController" &&
    Array.isArray(project.documentControllerIds) &&
    project.documentControllerIds.some((id) => sameId(id, userId))
  ) {
    roles.add("DocumentController");
  }
  return roles;
};

// ctx = { userId, jobDescription, isAdmin }. Admin passes everything. Otherwise
// true when the person holds any of `roles`: a head-office role needs no project;
// a site role needs `project` and membership on it.
const hasLogisticsRole = (ctx, roles, project) => {
  if (ctx?.isAdmin) return true;
  const wanted = Array.isArray(roles) ? roles : [roles];
  const held = rolesOnProject(ctx?.userId, ctx?.jobDescription, project);
  return wanted.some((roleName) => held.has(roleName));
};

// True when a dropdown value is one the module depends on (and so cannot be
// removed or renamed). kind: "positions" | "departments" (singular accepted).
const isReservedDropdownValue = (kind, value) => {
  const list =
    kind === "positions" || kind === "position"
      ? RESERVED_POSITIONS
      : kind === "departments" || kind === "department"
        ? RESERVED_DEPARTMENTS
        : [];
  const key = normalize(value);
  return list.some((reserved) => normalize(reserved) === key);
};

// The 403 text for a route that needs one of `roles`.
const positionMessage = (roles) => {
  const wanted = Array.isArray(roles) ? roles : [roles];
  const positions = wanted
    .map((roleName) => LOGISTICS_ROLES[roleName]?.position)
    .filter(Boolean);
  const departments = wanted
    .map((roleName) => LOGISTICS_ROLES[roleName]?.department)
    .filter(Boolean);

  const parts = [];
  if (positions.length) parts.push(`the position ${positions.join(" or ")}`);
  if (departments.length) {
    parts.push(`the department ${departments.join(" or ")}`);
  }
  return `This needs ${parts.join(", or ")}.`;
};

const memberMessage = (project) =>
  `You are not assigned to project ${project?.code ?? ""}.`;

module.exports = {
  normalize,
  headOfficeRoles,
  siteRole,
  rolesOnProject,
  hasLogisticsRole,
  isReservedDropdownValue,
  positionMessage,
  memberMessage,
  positionMatches,
};
