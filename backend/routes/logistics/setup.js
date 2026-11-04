// Logistics setup: the caller's context (/me), projects and their membership,
// the eligible-people pickers, and the reserved dropdown values (health, seed,
// lists). Project membership is the only place the two site roles are given.
const express = require("express");
const mongoose = require("mongoose");

const {
  requireAdmin,
  requireAuthenticated,
} = require("../../middleware/accessMiddleware");
const {
  loadLogistics,
  requireAnyLogisticsPage,
  myProjects,
} = require("../../middleware/logisticsAccess");
const Auth = require("../../models/authUsers");
const Employee = require("../../models/employees");
const Settings = require("../../models/settings");
const Project = require("../../models/project");
const Dropdown = require("../../models/dropdownOption");
const DocumentCounter = require("../../models/documentCounter");
const {
  RESERVED_POSITIONS,
  RESERVED_DEPARTMENTS,
  SEED_POSITIONS,
  SEED_DEPARTMENTS,
  DEFAULT_ITEM_CATEGORIES,
  DEFAULT_UNITS_OF_MEASURE,
  PROJECT_STATUSES,
  LOGISTICS_ROLES,
} = require("../../config/logistics");
const {
  normalize,
  rolesOnProject,
  positionMatches,
  memberMessage,
} = require("../../utils/logisticsAccess");
const { counterKeysForProject } = require("../../utils/documentNumbers");
const { emitToUsers } = require("../../utils/realtime");

const router = express.Router();

const serverError = (res, err) =>
  res.status(500).json({ message: "Server error", error: err.message });

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const idString = (value) => (value == null ? null : String(value));

// "First Last" from the Employee record, else the username
const personName = (employee, auth) => {
  const full = [employee?.firstName, employee?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || auth?.username || "";
};

// Auth, Employee and Settings for a set of user ids, keyed by user id
const loadPeople = async (ids) => {
  const unique = [...new Set(ids.map(idString).filter(Boolean))];
  if (unique.length === 0) return new Map();

  const [auths, employees, settings] = await Promise.all([
    Auth.find({ _id: { $in: unique } })
      .select("username status")
      .lean(),
    Employee.find({ userId: { $in: unique } })
      .select("userId firstName lastName employeeId")
      .lean(),
    Settings.find({ userId: { $in: unique } })
      .select(
        "userId general.jobDescription.position general.jobDescription.department",
      )
      .lean(),
  ]);

  const people = new Map();
  for (const auth of auths) {
    people.set(String(auth._id), { auth, employee: null, jobDescription: {} });
  }
  for (const employee of employees) {
    const person = people.get(String(employee.userId));
    if (person) person.employee = employee;
  }
  for (const setting of settings) {
    const person = people.get(String(setting.userId));
    if (person) {
      person.jobDescription = {
        position: setting.general?.jobDescription?.position ?? "",
        department: setting.general?.jobDescription?.department ?? "",
      };
    }
  }
  return people;
};

const memberShape = (person, roleName) =>
  person
    ? {
        _id: person.auth._id,
        name: personName(person.employee, person.auth),
        position: person.jobDescription.position ?? "",
        positionMatches: positionMatches(person.jobDescription, roleName),
        accountActive: person.auth.status === "Active",
      }
    : null;

// The project detail shape the Setup page shows: the project fields plus the
// In-charge and Document Controllers with their position flags, and counts
// (zero until the document phases land).
const projectDetail = async (project) => {
  const plain =
    typeof project.toObject === "function" ? project.toObject() : { ...project };
  const controllerIds = (plain.documentControllerIds || []).map(idString);
  const people = await loadPeople([plain.inChargeId, ...controllerIds]);

  const inCharge = plain.inChargeId
    ? memberShape(people.get(idString(plain.inChargeId)), "ProjectInCharge")
    : null;
  const documentControllers = controllerIds
    .map((id) => memberShape(people.get(id), "DocumentController"))
    .filter(Boolean);

  return {
    ...plain,
    inCharge,
    documentControllers,
    counts: { openMaterialRequests: 0, awaitingDelivery: 0, lowStock: 0 },
  };
};

// Field validation, in the order the messages are listed. Returns
// { error } or { fields }.
const validateProjectFields = (body) => {
  const code = String(body.code ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(code)) {
    return { error: "Project code must be 2 to 8 letters or numbers." };
  }

  const name = String(body.name ?? "").trim();
  if (!name) return { error: "Project name is required." };

  const location = String(body.location ?? "").trim();
  if (!location) return { error: "Location is required." };

  const status = body.status === undefined || body.status === null || body.status === ""
    ? "Active"
    : body.status;
  if (!PROJECT_STATUSES.includes(status)) {
    return {
      error: `Status must be one of: ${PROJECT_STATUSES.join(", ")}.`,
    };
  }

  const startDate = String(body.startDate ?? "").trim();
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { error: "Start date must be YYYY-MM-DD." };
  }

  const remarks = String(body.remarks ?? "").trim();

  return { fields: { code, name, location, status, startDate, remarks } };
};

// Membership validation: ids valid, people active, positions held, no overlap.
// Returns { error } or { inChargeId, documentControllerIds }.
const checkMembers = async (inChargeId, documentControllerIds) => {
  const inCharge = inChargeId ? String(inChargeId) : null;
  const controllers = Array.isArray(documentControllerIds)
    ? documentControllerIds.map(String)
    : [];

  for (const id of [inCharge, ...controllers].filter(Boolean)) {
    if (!mongoose.isValidObjectId(id)) {
      return { error: "Invalid person ID." };
    }
  }

  // Checked before the position rule, or it could never fire: nobody holds
  // both positions at once.
  const uniqueControllers = [...new Set(controllers)];
  if (inCharge && uniqueControllers.includes(inCharge)) {
    return { error: "The In-charge can't also be a Document Controller." };
  }

  const people = await loadPeople([inCharge, ...controllers]);

  const checkPerson = (id, roleName) => {
    const person = people.get(id);
    if (!person) return "Person not found.";
    const name = personName(person.employee, person.auth);
    if (person.auth.status !== "Active") {
      return `${name} is not an active account.`;
    }
    if (!positionMatches(person.jobDescription, roleName)) {
      return `${name} does not hold the position ${LOGISTICS_ROLES[roleName].position}.`;
    }
    return null;
  };

  if (inCharge) {
    const error = checkPerson(inCharge, "ProjectInCharge");
    if (error) return { error };
  }
  for (const id of uniqueControllers) {
    const error = checkPerson(id, "DocumentController");
    if (error) return { error };
  }

  return { inChargeId: inCharge, documentControllerIds: uniqueControllers };
};

const memberIds = (project) =>
  [idString(project.inChargeId), ...(project.documentControllerIds || []).map(idString)]
    .filter(Boolean);

// ---------------------------------------------------------------------------
// Reserved dropdown values (health and seed), shared with scripts/seedLogistics.js
// ---------------------------------------------------------------------------

const positionsOf = (dropdown) => {
  const positions = dropdown?.positions;
  if (!positions) return [];
  const lists =
    positions instanceof Map ? [...positions.values()] : Object.values(positions);
  return lists.flat().filter(Boolean);
};

const findIgnoringCase = (list, value) =>
  (list || []).find((entry) => normalize(entry) === normalize(value));

const healthOf = (dropdown) => {
  const positions = positionsOf(dropdown);
  const departments = dropdown?.departments || [];
  const missingPositions = RESERVED_POSITIONS.filter(
    (value) => !findIgnoringCase(positions, value),
  );
  const missingDepartments = RESERVED_DEPARTMENTS.filter(
    (value) => !findIgnoringCase(departments, value),
  );
  return {
    ok: missingPositions.length === 0 && missingDepartments.length === 0,
    missingPositions,
    missingDepartments,
  };
};

// Adds the missing reserved departments and positions, and the default item
// categories and units when those lists are empty. Idempotent.
const seedReserved = async () => {
  let dropdown = await Dropdown.findOne();
  if (!dropdown) {
    dropdown = new Dropdown({
      designations: [],
      departments: [],
      employmentTypes: [],
      itemCategories: [],
      unitsOfMeasure: [],
      positions: {},
    });
  }
  if (!dropdown.positions) dropdown.positions = new Map();

  const added = {
    departments: [],
    positions: [],
    itemCategories: 0,
    unitsOfMeasure: 0,
  };

  // The stored spelling of each seed department (case may differ)
  const departmentKey = {};
  for (const department of SEED_DEPARTMENTS) {
    const existing = findIgnoringCase(dropdown.departments, department);
    if (!existing) {
      dropdown.departments.push(department);
      added.departments.push(department);
    }
    const key = existing || department;
    departmentKey[department] = key;
    if (!dropdown.positions.get(key)) {
      dropdown.positions.set(key, []);
    }
  }

  const allPositions = positionsOf(dropdown);
  for (const [department, positions] of Object.entries(SEED_POSITIONS)) {
    const key = departmentKey[department];
    for (const position of positions) {
      if (findIgnoringCase(allPositions, position)) continue;
      const list = dropdown.positions.get(key) || [];
      dropdown.positions.set(key, [...list, position]);
      allPositions.push(position);
      added.positions.push(position);
    }
  }

  if (!dropdown.itemCategories || dropdown.itemCategories.length === 0) {
    dropdown.itemCategories = [...DEFAULT_ITEM_CATEGORIES];
    added.itemCategories = DEFAULT_ITEM_CATEGORIES.length;
  }
  if (!dropdown.unitsOfMeasure || dropdown.unitsOfMeasure.length === 0) {
    dropdown.unitsOfMeasure = [...DEFAULT_UNITS_OF_MEASURE];
    added.unitsOfMeasure = DEFAULT_UNITS_OF_MEASURE.length;
  }

  dropdown.markModified("positions");
  await dropdown.save();

  const nothing =
    added.departments.length === 0 &&
    added.positions.length === 0 &&
    added.itemCategories === 0 &&
    added.unitsOfMeasure === 0;

  return {
    message: nothing ? "Nothing was missing." : "Reserved values added.",
    added,
    health: healthOf(dropdown),
  };
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// The caller's logistics context for LogisticsContext
router.get("/me", [...requireAuthenticated, loadLogistics], async (req, res) => {
  try {
    const { userId, isAdmin, position, department, roles, siteRole } =
      req.logistics;
    res.json({
      userId,
      isAdmin,
      position,
      department,
      roles,
      siteRole,
      projects: await myProjects(req.logistics),
    });
  } catch (err) {
    serverError(res, err);
  }
});

// Projects the caller may see. ?memberId= (Admin only) lists where a person is
// assigned, by id alone, for the employee profile.
router.get("/projects", requireAnyLogisticsPage, async (req, res) => {
  try {
    const logistics = req.logistics;
    const { status, memberId } = req.query;

    if (logistics.isAdmin && memberId) {
      if (!mongoose.isValidObjectId(memberId)) {
        return res.status(400).json({ message: "Invalid person ID." });
      }
      const projects = await Project.find({
        $or: [{ inChargeId: memberId }, { documentControllerIds: memberId }],
      })
        .sort({ code: 1 })
        .lean();
      return res.json(
        projects.map((project) => ({
          _id: project._id,
          code: project.code,
          name: project.name,
          status: project.status,
          memberRole:
            idString(project.inChargeId) === String(memberId)
              ? "ProjectInCharge"
              : "DocumentController",
        })),
      );
    }

    const filter = {};
    if (status) filter.status = status;

    if (logistics.isAdmin || logistics.headOfficeRoles.length > 0) {
      const projects = await Project.find(filter).sort({ code: 1 }).lean();
      return res.json(projects);
    }

    if (logistics.siteRole) {
      const projects = await Project.find({
        ...filter,
        $or: [
          { inChargeId: logistics.userId },
          { documentControllerIds: logistics.userId },
        ],
      })
        .sort({ code: 1 })
        .lean();
      return res.json(
        projects.filter((project) =>
          rolesOnProject(
            logistics.userId,
            logistics.jobDescription,
            project,
          ).has(logistics.siteRole),
        ),
      );
    }

    return res.json([]);
  } catch (err) {
    serverError(res, err);
  }
});

// Active users holding a reserved position, for the Setup pickers
router.get("/projects/eligible", requireAdmin, async (req, res) => {
  try {
    const wanted = findIgnoringCase(RESERVED_POSITIONS, req.query.position);
    if (!wanted) {
      return res.status(400).json({
        message: `Position must be one of: ${RESERVED_POSITIONS.join(", ")}.`,
      });
    }

    const settings = await Settings.find({
      "general.jobDescription.position": new RegExp(
        `^\\s*${escapeRegExp(wanted)}\\s*$`,
        "i",
      ),
    })
      .select(
        "userId general.jobDescription.position general.jobDescription.department",
      )
      .lean();
    const byUser = new Map(
      settings
        .filter((setting) => setting.userId)
        .map((setting) => [String(setting.userId), setting]),
    );

    const auths = await Auth.find({
      _id: { $in: [...byUser.keys()] },
      status: "Active",
    })
      .select("username")
      .lean();
    const employees = await Employee.find({
      userId: { $in: auths.map((auth) => auth._id) },
    })
      .select("userId firstName lastName employeeId")
      .lean();
    const employeeByUser = new Map(
      employees.map((employee) => [String(employee.userId), employee]),
    );

    const people = auths
      .map((auth) => {
        const employee = employeeByUser.get(String(auth._id));
        const job = byUser.get(String(auth._id))?.general?.jobDescription;
        return {
          _id: auth._id,
          name: personName(employee, auth),
          employeeId: employee?.employeeId ?? "",
          position: job?.position ?? "",
          department: job?.department ?? "",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json(people);
  } catch (err) {
    serverError(res, err);
  }
});

// One project with its members. Admin and head-office roles pass; a site role
// needs a seat on it.
router.get("/projects/:id", requireAnyLogisticsPage, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid project ID." });
    }
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    const logistics = req.logistics;
    const seated =
      logistics.siteRole &&
      rolesOnProject(logistics.userId, logistics.jobDescription, project).has(
        logistics.siteRole,
      );
    if (!logistics.isAdmin && logistics.headOfficeRoles.length === 0 && !seated) {
      return res.status(403).json({ message: memberMessage(project) });
    }

    res.json(await projectDetail(project));
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/projects", requireAdmin, async (req, res) => {
  try {
    const checked = validateProjectFields(req.body || {});
    if (checked.error) return res.status(400).json({ message: checked.error });
    const { fields } = checked;

    if (await Project.exists({ code: fields.code })) {
      return res
        .status(409)
        .json({ message: `Project code ${fields.code} is already used.` });
    }

    const members = await checkMembers(
      req.body.inChargeId,
      req.body.documentControllerIds,
    );
    if (members.error) return res.status(400).json({ message: members.error });

    const project = await Project.create({
      ...fields,
      inChargeId: members.inChargeId,
      documentControllerIds: members.documentControllerIds,
      createdBy: req.user.userId,
    });

    res.status(201).json(await projectDetail(project));
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        message: `Project code ${String(req.body?.code ?? "").trim().toUpperCase()} is already used.`,
      });
    }
    serverError(res, err);
  }
});

router.put("/projects/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid project ID." });
    }
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    // Fields left out of the body keep their stored value
    const body = req.body || {};
    const merged = {
      code: project.code,
      name: project.name,
      location: project.location,
      status: project.status,
      startDate: project.startDate,
      remarks: project.remarks,
    };
    for (const key of Object.keys(merged)) {
      if (body[key] !== undefined) merged[key] = body[key];
    }

    const checked = validateProjectFields(merged);
    if (checked.error) return res.status(400).json({ message: checked.error });
    const { fields } = checked;

    if (fields.code !== project.code) {
      if (await Project.exists({ code: fields.code, _id: { $ne: project._id } })) {
        return res
          .status(409)
          .json({ message: `Project code ${fields.code} is already used.` });
      }
      if (
        await DocumentCounter.exists({ key: counterKeysForProject(project.code) })
      ) {
        return res.status(409).json({
          message:
            "Project code can't change: documents are already numbered with it.",
        });
      }
    }

    const members = await checkMembers(
      body.inChargeId === undefined ? project.inChargeId : body.inChargeId,
      body.documentControllerIds === undefined
        ? project.documentControllerIds
        : body.documentControllerIds,
    );
    if (members.error) return res.status(400).json({ message: members.error });

    const before = memberIds(project);

    Object.assign(project, fields, {
      inChargeId: members.inChargeId,
      documentControllerIds: members.documentControllerIds,
    });
    await project.save();

    const after = memberIds(project);
    const changed = [
      ...after.filter((id) => !before.includes(id)),
      ...before.filter((id) => !after.includes(id)),
    ];
    if (changed.length > 0) {
      emitToUsers(changed, "access.changed", {
        projectId: project._id,
        code: project.code,
      });
    }

    res.json(await projectDetail(project));
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        message: `Project code ${String(req.body?.code ?? "").trim().toUpperCase()} is already used.`,
      });
    }
    serverError(res, err);
  }
});

// Which reserved values are missing from the dropdown lists (warning banner)
router.get("/setup/health", requireAdmin, async (req, res) => {
  try {
    const dropdown = await Dropdown.findOne().lean();
    res.json(healthOf(dropdown));
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/setup/seed-reserved", requireAdmin, async (req, res) => {
  try {
    res.json(await seedReserved());
  } catch (err) {
    serverError(res, err);
  }
});

// Item categories and units of measure for the item form
router.get("/setup/lists", requireAnyLogisticsPage, async (req, res) => {
  try {
    const dropdown = await Dropdown.findOne()
      .select("itemCategories unitsOfMeasure")
      .lean();
    res.json({
      itemCategories: dropdown?.itemCategories || [],
      unitsOfMeasure: dropdown?.unitsOfMeasure || [],
    });
  } catch (err) {
    serverError(res, err);
  }
});

module.exports = router;
module.exports.seedReserved = seedReserved;
module.exports.healthOf = healthOf;
