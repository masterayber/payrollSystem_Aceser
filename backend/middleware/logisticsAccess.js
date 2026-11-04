// Logistics guards. They run after authMiddleware and loadCurrentUser, add one
// Settings query (the caller's position and department) and decide with the pure
// helpers in utils/logisticsAccess.js. A changed position, page tick or project
// membership takes effect on the next request, like page access does.
const mongoose = require("mongoose");
const authMiddleware = require("./authMiddleware");
const { requireAuthenticated } = require("./accessMiddleware");
const Settings = require("../models/settings");
const Project = require("../models/project");
const { getAllowedPages } = require("../utils/pageAccess");
const { isLogisticsPage } = require("../config/pages");
const { SITE_ROLES } = require("../config/logistics");
const {
  headOfficeRoles,
  siteRole,
  rolesOnProject,
  hasLogisticsRole,
  positionMessage,
  memberMessage,
} = require("../utils/logisticsAccess");

// accessMiddleware does not export loadCurrentUser on its own; it is the second
// step of requireAuthenticated ([authMiddleware, loadCurrentUser]).
const loadCurrentUser = requireAuthenticated[1];

const serverError = (res, err) =>
  res.status(500).json({ message: "Server error", error: err.message });

// req.logistics = { userId, isAdmin, jobDescription, position, department,
//                   headOfficeRoles: [], siteRole, roles: [] }
const loadLogistics = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const settings = await Settings.findOne({ userId })
      .select(
        "general.jobDescription.position general.jobDescription.department",
      )
      .lean();

    const position = settings?.general?.jobDescription?.position ?? "";
    const department = settings?.general?.jobDescription?.department ?? "";
    const jobDescription = { position, department };
    const headOffice = [...headOfficeRoles(jobDescription)];
    const site = siteRole(jobDescription);

    req.logistics = {
      userId,
      isAdmin: req.currentUser?.role === "Admin",
      jobDescription,
      position,
      department,
      headOfficeRoles: headOffice,
      siteRole: site,
      roles: site ? [...headOffice, site] : headOffice,
    };
    next();
  } catch (err) {
    serverError(res, err);
  }
};

const readPath = (req, dotted) =>
  String(dotted)
    .split(".")
    .reduce((value, key) => (value == null ? undefined : value[key]), req);

// Loads the project named by the `project` option ("params.projectId",
// "body.projectId", "query.projectId"). Replies itself when the id is bad or
// the project is missing and returns null; otherwise returns the project.
const loadProjectFromRequest = async (req, res, projectPath) => {
  const id = readPath(req, projectPath);
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: "Invalid project ID." });
    return null;
  }
  const project = await Project.findById(id);
  if (!project) {
    res.status(404).json({ message: "Project not found." });
    return null;
  }
  return project;
};

// Middleware factory. Admin passes. A head-office role in `roles` passes. A site
// role in `roles` that matches the caller's position passes when no `project`
// option is given (the handler checks the seat later); with `project`, the
// Project is loaded onto req.project and the caller must hold a seat on it.
const requireLogisticsRole = (roles, { project } = {}) => {
  const wanted = Array.isArray(roles) ? roles : [roles];
  const wantedSite = wanted.filter((roleName) => SITE_ROLES.includes(roleName));

  const check = async (req, res, next) => {
    try {
      const logistics = req.logistics;
      if (logistics.isAdmin) return next();

      if (wanted.some((roleName) => logistics.headOfficeRoles.includes(roleName))) {
        return next();
      }

      if (logistics.siteRole && wantedSite.includes(logistics.siteRole)) {
        if (!project) return next();

        const loaded = await loadProjectFromRequest(req, res, project);
        if (!loaded) return undefined;
        req.project = loaded;

        const held = rolesOnProject(
          logistics.userId,
          logistics.jobDescription,
          loaded,
        );
        if (!wantedSite.some((roleName) => held.has(roleName))) {
          return res.status(403).json({ message: memberMessage(loaded) });
        }
        return next();
      }

      return res.status(403).json({ message: positionMessage(wanted) });
    } catch (err) {
      return serverError(res, err);
    }
  };

  return [authMiddleware, loadCurrentUser, loadLogistics, check];
};

// Any signed-in user with at least one logistics page ticked (Admin always).
const requireAnyLogisticsPage = [
  authMiddleware,
  loadCurrentUser,
  loadLogistics,
  (req, res, next) => {
    if (req.currentUser.role === "Admin") return next();

    const allowed = getAllowedPages(req.currentUser);
    if (!allowed.some((key) => isLogisticsPage(key))) {
      return res.status(403).json({
        message: "You do not have access to this page",
        code: "PAGE_ACCESS_DENIED",
      });
    }
    next();
  },
];

// Concatenates guard arrays without running the same middleware twice, so
// [...requireAnyLogisticsPage, ...requireLogisticsRole(...)] verifies the token
// and loads the user once.
const guard = (...stacks) => {
  const seen = new Set();
  const result = [];
  for (const stack of stacks) {
    for (const fn of stack) {
      if (seen.has(fn)) continue;
      seen.add(fn);
      result.push(fn);
    }
  }
  return result;
};

// For handlers after they loaded the document and its Project. Null when
// allowed, else { status: 403, message }.
const assertProjectRole = (logistics, roles, project) => {
  const wanted = Array.isArray(roles) ? roles : [roles];
  const ctx = {
    userId: logistics.userId,
    jobDescription: logistics.jobDescription,
    isAdmin: logistics.isAdmin,
  };
  if (hasLogisticsRole(ctx, wanted, project)) return null;

  const holdsPosition = wanted.some(
    (roleName) =>
      logistics.headOfficeRoles.includes(roleName) ||
      logistics.siteRole === roleName,
  );
  return {
    status: 403,
    message: holdsPosition ? memberMessage(project) : positionMessage(wanted),
  };
};

const summary = (project, role) => ({
  _id: project._id,
  code: project.code,
  name: project.name,
  status: project.status,
  role,
});

// Projects the caller can work on, with their site role on each (null for Admin
// and head-office roles without a seat). Admin and head-office roles: every
// project not Closed. A site role: the projects they are seated on while their
// position still matches. No role at all: [].
const myProjects = async (logistics) => {
  const { userId, jobDescription, siteRole: site } = logistics;
  const seatOn = (project) =>
    site && rolesOnProject(userId, jobDescription, project).has(site)
      ? site
      : null;

  if (logistics.isAdmin || logistics.headOfficeRoles.length > 0) {
    const projects = await Project.find({ status: { $ne: "Closed" } })
      .sort({ code: 1 })
      .lean();
    return projects.map((project) => summary(project, seatOn(project)));
  }

  if (site) {
    const projects = await Project.find({
      $or: [{ inChargeId: userId }, { documentControllerIds: userId }],
    })
      .sort({ code: 1 })
      .lean();
    return projects
      .filter((project) => seatOn(project))
      .map((project) => summary(project, site));
  }

  return [];
};

module.exports = {
  loadLogistics,
  requireLogisticsRole,
  requireAnyLogisticsPage,
  assertProjectRole,
  myProjects,
  guard,
};
