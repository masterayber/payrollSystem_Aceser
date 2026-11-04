jest.mock("../utils/nodemailer", () => jest.fn().mockResolvedValue());

const request = require("supertest");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const Project = require("../models/project");
const Item = require("../models/item");
const Supplier = require("../models/supplier");
const DocumentCounter = require("../models/documentCounter");
const Dropdown = require("../models/dropdownOption");
const filesRouter = require("../routes/logistics/files");
const { nextDocumentNumber } = require("../utils/documentNumbers");
const {
  DEFAULT_ITEM_CATEGORIES,
  DEFAULT_UNITS_OF_MEASURE,
} = require("../config/logistics");

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await User.deleteMany({});
  await Employee.deleteMany({});
  await Settings.deleteMany({});
  await Project.deleteMany({});
  await Item.deleteMany({});
  await Supplier.deleteMany({});
  await DocumentCounter.deleteMany({});
  await Dropdown.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const LOGISTICS_PAGE = ["logistics-material-requests"];

const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

const loginAs = async (username, password = "Password123!") => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password });
  return res.body.token;
};

// Creates Auth + Employee + Settings for one person and signs them in
const person = async (
  username,
  {
    role = "Employee",
    status = "Active",
    position = "",
    department = "",
    pageAccess = LOGISTICS_PAGE,
    firstName,
    lastName,
  } = {},
) => {
  const user = await User.create({
    username,
    password: "Password123!",
    email: `${username}@example.com`,
    role,
    status,
    ...(role === "Employee" ? { pageAccess } : {}),
  });
  await Employee.create({
    userId: user._id,
    firstName: firstName ?? capitalize(username),
    lastName: lastName ?? "Test",
    employeeId: `EMP-${username}`,
    email: `${username}@example.com`,
    role,
  });
  await Settings.create({
    userId: user._id,
    general: { jobDescription: { position, department } },
  });
  const token = status === "Active" ? await loginAs(username) : null;
  return { user, token };
};

const as = (token) => ({ Authorization: `Bearer ${token}` });

const admin = () => person("admin", { role: "Admin" });
const inCharge = (username = "ic") =>
  person(username, { position: "Project In-charge" });
const controller = (username = "dc") =>
  person(username, { position: "Document Controller" });
const staff = (username = "staff") =>
  person(username, { position: "Procurement Staff" });
const head = (username = "head") =>
  person(username, { position: "Procurement Head" });
const accounting = (username = "acct") =>
  person(username, { position: "Bookkeeper", department: "Accounting" });

const makeProject = (createdBy, overrides = {}) =>
  Project.create({
    code: "ACE01",
    name: "Demo Tower",
    location: "Quezon City",
    createdBy,
    ...overrides,
  });

const projectBody = (overrides = {}) => ({
  code: "ACE01",
  name: "Demo Tower",
  location: "Quezon City",
  status: "Active",
  startDate: "",
  remarks: "",
  inChargeId: null,
  documentControllerIds: [],
  ...overrides,
});

const setPosition = (userId, position) =>
  Settings.findOneAndUpdate(
    { userId },
    { $set: { "general.jobDescription.position": position } },
  );

describe("GET /api/logistics/me", () => {
  it("gives an In-charge their site role and the project they are seated on", async () => {
    const boss = await admin();
    const ic = await inCharge();
    await makeProject(boss.user._id, { inChargeId: ic.user._id });
    await makeProject(boss.user._id, { code: "ACE02", name: "Other" });

    const res = await request(app)
      .get("/api/logistics/me")
      .set(as(ic.token));

    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(false);
    expect(res.body.position).toBe("Project In-charge");
    expect(res.body.siteRole).toBe("ProjectInCharge");
    expect(res.body.roles).toEqual(["ProjectInCharge"]);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0]).toMatchObject({
      code: "ACE01",
      name: "Demo Tower",
      status: "Active",
      role: "ProjectInCharge",
    });
  });

  it("gives Procurement Staff every project that is not Closed, with role null", async () => {
    const boss = await admin();
    const s = await staff();
    await makeProject(boss.user._id);
    await makeProject(boss.user._id, { code: "ACE02", name: "Closed one", status: "Closed" });
    await makeProject(boss.user._id, { code: "ACE03", name: "On hold", status: "OnHold" });

    const res = await request(app).get("/api/logistics/me").set(as(s.token));

    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual(["ProcurementStaff"]);
    expect(res.body.siteRole).toBeNull();
    expect(res.body.projects.map((p) => p.code)).toEqual(["ACE01", "ACE03"]);
    expect(res.body.projects.every((p) => p.role === null)).toBe(true);
  });

  it("marks an Admin as isAdmin", async () => {
    const boss = await admin();
    const res = await request(app)
      .get("/api/logistics/me")
      .set(as(boss.token));

    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(true);
    expect(res.body.userId).toBe(String(boss.user._id));
  });

  it("refuses without a token", async () => {
    const res = await request(app).get("/api/logistics/me");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/logistics/projects", () => {
  it("shows a site role only the projects they are seated on", async () => {
    const boss = await admin();
    const dc = await controller();
    await makeProject(boss.user._id, { documentControllerIds: [dc.user._id] });
    await makeProject(boss.user._id, { code: "ACE02", name: "Other" });

    const res = await request(app)
      .get("/api/logistics/projects")
      .set(as(dc.token));

    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.code)).toEqual(["ACE01"]);
  });

  it("drops a seat once the position no longer matches, and shows all for a head-office position", async () => {
    const boss = await admin();
    const dc = await controller();
    await makeProject(boss.user._id, { documentControllerIds: [dc.user._id] });
    await makeProject(boss.user._id, { code: "ACE02", name: "Other" });

    await setPosition(dc.user._id, "Project Manager");
    const noRole = await request(app)
      .get("/api/logistics/projects")
      .set(as(dc.token));
    expect(noRole.status).toBe(200);
    expect(noRole.body).toEqual([]);

    await setPosition(dc.user._id, "Procurement Staff");
    const headOffice = await request(app)
      .get("/api/logistics/projects")
      .set(as(dc.token));
    expect(headOffice.status).toBe(200);
    expect(headOffice.body.map((p) => p.code)).toEqual(["ACE01", "ACE02"]);
  });

  it("gives [] to an employee with a logistics page but no role", async () => {
    const boss = await admin();
    const clerk = await person("clerk", { position: "Clerk" });
    await makeProject(boss.user._id);

    const res = await request(app)
      .get("/api/logistics/projects")
      .set(as(clerk.token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("refuses an employee with no logistics page ticked", async () => {
    const s = await person("staff", {
      position: "Procurement Staff",
      pageAccess: ["payroll"],
    });

    const res = await request(app)
      .get("/api/logistics/projects")
      .set(as(s.token));

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      message: "You do not have access to this page",
      code: "PAGE_ACCESS_DENIED",
    });
  });

  it("filters by status for Admin and lists a member's projects with memberRole", async () => {
    const boss = await admin();
    const ic = await inCharge();
    const dc = await controller();
    await makeProject(boss.user._id, {
      inChargeId: ic.user._id,
      documentControllerIds: [dc.user._id],
    });
    await makeProject(boss.user._id, {
      code: "ACE02",
      name: "Other",
      status: "Completed",
      inChargeId: ic.user._id,
    });

    const completed = await request(app)
      .get("/api/logistics/projects")
      .query({ status: "Completed" })
      .set(as(boss.token));
    expect(completed.status).toBe(200);
    expect(completed.body.map((p) => p.code)).toEqual(["ACE02"]);

    const asMember = await request(app)
      .get("/api/logistics/projects")
      .query({ memberId: String(dc.user._id) })
      .set(as(boss.token));
    expect(asMember.status).toBe(200);
    expect(asMember.body).toEqual([
      expect.objectContaining({ code: "ACE01", memberRole: "DocumentController" }),
    ]);

    const icProjects = await request(app)
      .get("/api/logistics/projects")
      .query({ memberId: String(ic.user._id) })
      .set(as(boss.token));
    expect(icProjects.body.map((p) => p.memberRole)).toEqual([
      "ProjectInCharge",
      "ProjectInCharge",
    ]);
  });
});

describe("GET /api/logistics/projects/eligible", () => {
  it("lists only active users holding the position, trimmed and case-insensitive", async () => {
    const boss = await admin();
    await person("zed", {
      position: "  project in-charge ",
      firstName: "Zed",
      lastName: "Zulu",
    });
    await person("ana", {
      position: "Project In-charge",
      firstName: "Ana",
      lastName: "Alpha",
    });
    await person("gone", { position: "Project In-charge", status: "Inactive" });
    await person("pm", { position: "Project Manager" });

    const res = await request(app)
      .get("/api/logistics/projects/eligible")
      .query({ position: "Project In-charge" })
      .set(as(boss.token));

    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.name)).toEqual(["Ana Alpha", "Zed Zulu"]);
    expect(res.body[0]).toMatchObject({
      employeeId: "EMP-ana",
      position: "Project In-charge",
      department: "",
    });
    expect(res.body[0]._id).toBeDefined();
  });

  it("refuses a position that is not reserved", async () => {
    const boss = await admin();
    const res = await request(app)
      .get("/api/logistics/projects/eligible")
      .query({ position: "Project Manager" })
      .set(as(boss.token));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Position must be one of: Document Controller, Project In-charge, Procurement Staff, Procurement Head.",
    );
  });

  it("is Admin only", async () => {
    const s = await staff();
    const res = await request(app)
      .get("/api/logistics/projects/eligible")
      .query({ position: "Project In-charge" })
      .set(as(s.token));

    expect(res.status).toBe(403);
  });
});

describe("POST /api/logistics/projects", () => {
  it("creates a project with its members and the detail shape", async () => {
    const boss = await admin();
    const ic = await inCharge("ic");
    const dc = await controller("dc");

    const res = await request(app)
      .post("/api/logistics/projects")
      .set(as(boss.token))
      .send(
        projectBody({
          code: "ace01",
          inChargeId: String(ic.user._id),
          documentControllerIds: [String(dc.user._id)],
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.code).toBe("ACE01");
    expect(res.body.inCharge).toEqual({
      _id: String(ic.user._id),
      name: "Ic Test",
      position: "Project In-charge",
      positionMatches: true,
      accountActive: true,
    });
    expect(res.body.documentControllers).toHaveLength(1);
    expect(res.body.documentControllers[0].name).toBe("Dc Test");
    expect(res.body.counts).toEqual({
      openMaterialRequests: 0,
      awaitingDelivery: 0,
      lowStock: 0,
    });
    expect(res.body.createdBy).toBe(String(boss.user._id));
  });

  it("refuses a bad code", async () => {
    const boss = await admin();
    const res = await request(app)
      .post("/api/logistics/projects")
      .set(as(boss.token))
      .send(projectBody({ code: "A" }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Project code must be 2 to 8 letters or numbers.");
    expect(await Project.countDocuments()).toBe(0);
  });

  it("refuses a missing name, location, bad status and bad start date", async () => {
    const boss = await admin();
    const send = (body) =>
      request(app)
        .post("/api/logistics/projects")
        .set(as(boss.token))
        .send(projectBody(body));

    expect((await send({ name: " " })).body.message).toBe("Project name is required.");
    expect((await send({ location: "" })).body.message).toBe("Location is required.");
    expect((await send({ status: "Open" })).body.message).toBe(
      "Status must be one of: Active, OnHold, Completed, Closed.",
    );
    expect((await send({ startDate: "11/03/2026" })).body.message).toBe(
      "Start date must be YYYY-MM-DD.",
    );
  });

  it("refuses a duplicate code", async () => {
    const boss = await admin();
    await makeProject(boss.user._id);

    const res = await request(app)
      .post("/api/logistics/projects")
      .set(as(boss.token))
      .send(projectBody({ name: "Again" }));

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Project code ACE01 is already used.");
  });

  it("refuses an In-charge who does not hold the position", async () => {
    const boss = await admin();
    const pm = await person("pm", {
      position: "Project Manager",
      firstName: "Pedro",
      lastName: "Manalo",
    });

    const res = await request(app)
      .post("/api/logistics/projects")
      .set(as(boss.token))
      .send(projectBody({ inChargeId: String(pm.user._id) }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Pedro Manalo does not hold the position Project In-charge.",
    );
    expect(await Project.countDocuments()).toBe(0);
  });

  it("refuses a Document Controller who does not hold the position", async () => {
    const boss = await admin();
    const s = await staff("staff");

    const res = await request(app)
      .post("/api/logistics/projects")
      .set(as(boss.token))
      .send(projectBody({ documentControllerIds: [String(s.user._id)] }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Staff Test does not hold the position Document Controller.",
    );
  });

  it("refuses an inactive person and an unknown id", async () => {
    const boss = await admin();
    const gone = await person("gone", {
      position: "Project In-charge",
      status: "Inactive",
    });

    const inactive = await request(app)
      .post("/api/logistics/projects")
      .set(as(boss.token))
      .send(projectBody({ inChargeId: String(gone.user._id) }));
    expect(inactive.status).toBe(400);
    expect(inactive.body.message).toBe("Gone Test is not an active account.");

    const unknown = await request(app)
      .post("/api/logistics/projects")
      .set(as(boss.token))
      .send(projectBody({ inChargeId: String(new mongoose.Types.ObjectId()) }));
    expect(unknown.status).toBe(400);
    expect(unknown.body.message).toBe("Person not found.");

    const bad = await request(app)
      .post("/api/logistics/projects")
      .set(as(boss.token))
      .send(projectBody({ documentControllerIds: ["nope"] }));
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe("Invalid person ID.");
  });

  it("refuses the In-charge inside documentControllerIds", async () => {
    const boss = await admin();
    const ic = await inCharge("ic");

    const res = await request(app)
      .post("/api/logistics/projects")
      .set(as(boss.token))
      .send(
        projectBody({
          inChargeId: String(ic.user._id),
          documentControllerIds: [String(ic.user._id)],
        }),
      );

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "The In-charge can't also be a Document Controller.",
    );
    expect(await Project.countDocuments()).toBe(0);
  });

  it("collapses duplicate controller ids", async () => {
    const boss = await admin();
    const dc = await controller("dc");
    const ic = await inCharge("ic");

    const res = await request(app)
      .post("/api/logistics/projects")
      .set(as(boss.token))
      .send(
        projectBody({
          inChargeId: String(ic.user._id),
          documentControllerIds: [String(dc.user._id), String(dc.user._id)],
        }),
      );

    // Duplicate controller ids collapse to one
    expect(res.status).toBe(201);
    expect(res.body.documentControllerIds).toEqual([String(dc.user._id)]);
  });

  it("is Admin only", async () => {
    const s = await staff();
    const res = await request(app)
      .post("/api/logistics/projects")
      .set(as(s.token))
      .send(projectBody());

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Admin access required");
  });
});

describe("PUT /api/logistics/projects/:id", () => {
  it("edits the members and emits nothing visible", async () => {
    const boss = await admin();
    const ic = await inCharge("ic");
    const dc1 = await controller("dc1");
    const dc2 = await controller("dc2");
    const project = await makeProject(boss.user._id, {
      inChargeId: ic.user._id,
      documentControllerIds: [dc1.user._id],
    });

    const res = await request(app)
      .put(`/api/logistics/projects/${project._id}`)
      .set(as(boss.token))
      .send(
        projectBody({
          name: "Demo Tower 2",
          inChargeId: String(ic.user._id),
          documentControllerIds: [String(dc2.user._id)],
        }),
      );

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Demo Tower 2");
    expect(res.body.documentControllers.map((m) => m._id)).toEqual([
      String(dc2.user._id),
    ]);
    expect(res.body.inCharge._id).toBe(String(ic.user._id));
  });

  it("keeps the fields left out of the body", async () => {
    const boss = await admin();
    const ic = await inCharge("ic");
    const project = await makeProject(boss.user._id, { inChargeId: ic.user._id });

    const res = await request(app)
      .put(`/api/logistics/projects/${project._id}`)
      .set(as(boss.token))
      .send({ remarks: "Rainy season" });

    expect(res.status).toBe(200);
    expect(res.body.remarks).toBe("Rainy season");
    expect(res.body.inCharge._id).toBe(String(ic.user._id));
    expect(res.body.code).toBe("ACE01");
  });

  it("allows a code change before any document is numbered, and refuses after", async () => {
    const boss = await admin();
    const project = await makeProject(boss.user._id);

    const before = await request(app)
      .put(`/api/logistics/projects/${project._id}`)
      .set(as(boss.token))
      .send(projectBody({ code: "ACE09" }));
    expect(before.status).toBe(200);
    expect(before.body.code).toBe("ACE09");

    await nextDocumentNumber("MR", "ACE09");

    const after = await request(app)
      .put(`/api/logistics/projects/${project._id}`)
      .set(as(boss.token))
      .send(projectBody({ code: "ACE01" }));
    expect(after.status).toBe(409);
    expect(after.body.message).toBe(
      "Project code can't change: documents are already numbered with it.",
    );
    expect((await Project.findById(project._id)).code).toBe("ACE09");
  });

  it("refuses a code already used by another project", async () => {
    const boss = await admin();
    const project = await makeProject(boss.user._id);
    await makeProject(boss.user._id, { code: "ACE02", name: "Other" });

    const res = await request(app)
      .put(`/api/logistics/projects/${project._id}`)
      .set(as(boss.token))
      .send(projectBody({ code: "ACE02" }));

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Project code ACE02 is already used.");
  });

  it("flags a controller whose position changed", async () => {
    const boss = await admin();
    const dc = await controller("dc");
    const project = await makeProject(boss.user._id, {
      documentControllerIds: [dc.user._id],
    });
    await setPosition(dc.user._id, "Procurement Staff");

    const res = await request(app)
      .get(`/api/logistics/projects/${project._id}`)
      .set(as(boss.token));

    expect(res.status).toBe(200);
    expect(res.body.documentControllers[0]).toMatchObject({
      name: "Dc Test",
      position: "Procurement Staff",
      positionMatches: false,
      accountActive: true,
    });

    // Saving the project again with that person is refused until fixed
    const put = await request(app)
      .put(`/api/logistics/projects/${project._id}`)
      .set(as(boss.token))
      .send(projectBody({ documentControllerIds: [String(dc.user._id)] }));
    expect(put.status).toBe(400);
    expect(put.body.message).toBe(
      "Dc Test does not hold the position Document Controller.",
    );
  });

  it("answers 400 and 404 for a bad or unknown id", async () => {
    const boss = await admin();
    const bad = await request(app)
      .put("/api/logistics/projects/nope")
      .set(as(boss.token))
      .send(projectBody());
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe("Invalid project ID.");

    const missing = await request(app)
      .put(`/api/logistics/projects/${new mongoose.Types.ObjectId()}`)
      .set(as(boss.token))
      .send(projectBody());
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe("Project not found.");
  });
});

describe("GET /api/logistics/projects/:id", () => {
  it("refuses a Document Controller of another project", async () => {
    const boss = await admin();
    const dc = await controller("dc");
    const project = await makeProject(boss.user._id);
    await makeProject(boss.user._id, {
      code: "ACE02",
      name: "Theirs",
      documentControllerIds: [dc.user._id],
    });

    const res = await request(app)
      .get(`/api/logistics/projects/${project._id}`)
      .set(as(dc.token));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("You are not assigned to project ACE01.");
  });

  it("lets the In-charge and the Procurement Head read it", async () => {
    const boss = await admin();
    const ic = await inCharge("ic");
    const h = await head("head");
    const project = await makeProject(boss.user._id, { inChargeId: ic.user._id });

    const asIc = await request(app)
      .get(`/api/logistics/projects/${project._id}`)
      .set(as(ic.token));
    expect(asIc.status).toBe(200);
    expect(asIc.body.inCharge.name).toBe("Ic Test");

    const asHead = await request(app)
      .get(`/api/logistics/projects/${project._id}`)
      .set(as(h.token));
    expect(asHead.status).toBe(200);
    expect(asHead.body.code).toBe("ACE01");
  });

  it("refuses an employee with no role at all", async () => {
    const boss = await admin();
    const clerk = await person("clerk", { position: "Clerk" });
    const project = await makeProject(boss.user._id);

    const res = await request(app)
      .get(`/api/logistics/projects/${project._id}`)
      .set(as(clerk.token));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("You are not assigned to project ACE01.");
  });
});

describe("items", () => {
  const itemBody = (overrides = {}) => ({
    code: "cem-001",
    description: "Portland cement",
    category: "Cement and Aggregates",
    unit: "bag",
    specs: "40kg",
    ...overrides,
  });

  it("refuses POST /items for an In-charge, a Document Controller and the Procurement Head", async () => {
    const ic = await inCharge("ic");
    const dc = await controller("dc");
    const h = await head("head");

    for (const who of [ic, dc, h]) {
      const res = await request(app)
        .post("/api/logistics/items")
        .set(as(who.token))
        .send(itemBody());
      expect(res.status).toBe(403);
      expect(res.body.message).toBe("This needs the position Procurement Staff.");
    }
    expect(await Item.countDocuments()).toBe(0);
  });

  it("lets Procurement Staff and Admin create items, uppercasing the code", async () => {
    const boss = await admin();
    const s = await staff();

    const asStaff = await request(app)
      .post("/api/logistics/items")
      .set(as(s.token))
      .send(itemBody());
    expect(asStaff.status).toBe(201);
    expect(asStaff.body).toMatchObject({
      code: "CEM-001",
      description: "Portland cement",
      category: "Cement and Aggregates",
      unit: "bag",
      specs: "40kg",
      status: "Active",
      createdBy: String(s.user._id),
    });

    const asAdmin = await request(app)
      .post("/api/logistics/items")
      .set(as(boss.token))
      .send(itemBody({ code: "REB-010", description: "10mm rebar", unit: "length" }));
    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body.code).toBe("REB-010");
  });

  it("refuses a duplicate code and missing fields", async () => {
    const s = await staff();
    await request(app).post("/api/logistics/items").set(as(s.token)).send(itemBody());

    const dup = await request(app)
      .post("/api/logistics/items")
      .set(as(s.token))
      .send(itemBody({ code: " CEM-001 " }));
    expect(dup.status).toBe(409);
    expect(dup.body.message).toBe("Item code CEM-001 is already used.");

    const send = (body) =>
      request(app).post("/api/logistics/items").set(as(s.token)).send(body);
    expect((await send(itemBody({ code: "" }))).body.message).toBe("Item code is required.");
    expect((await send(itemBody({ code: "X-1", description: "" }))).body.message).toBe(
      "Description is required.",
    );
    expect((await send(itemBody({ code: "X-1", category: "" }))).body.message).toBe(
      "Category is required.",
    );
    expect((await send(itemBody({ code: "X-1", unit: "" }))).body.message).toBe(
      "Unit is required.",
    );
    expect((await send(itemBody({ code: "X-1", status: "Pending" }))).body.message).toBe(
      "Status must be Active or Inactive.",
    );
    expect(await Item.countDocuments()).toBe(1);
  });

  it("lists and filters with ?q=, ?status= and ?category=", async () => {
    const s = await staff();
    const dc = await controller("dc");
    const make = (body) =>
      request(app).post("/api/logistics/items").set(as(s.token)).send(itemBody(body));
    await make({});
    await make({ code: "REB-010", description: "10mm rebar", category: "Steel and Rebar", unit: "length", specs: "Grade 40" });
    await make({ code: "REB-012", description: "12mm rebar", category: "Steel and Rebar", unit: "length", status: "Inactive" });

    const byText = await request(app)
      .get("/api/logistics/items")
      .query({ q: "rebar" })
      .set(as(dc.token));
    expect(byText.status).toBe(200);
    expect(byText.body.map((i) => i.code)).toEqual(["REB-010", "REB-012"]);
    expect(Object.keys(byText.body[0]).sort()).toEqual(
      ["_id", "category", "code", "createdAt", "description", "specs", "status", "unit", "updatedAt"],
    );

    const bySpecs = await request(app)
      .get("/api/logistics/items")
      .query({ q: "grade 40" })
      .set(as(dc.token));
    expect(bySpecs.body.map((i) => i.code)).toEqual(["REB-010"]);

    const active = await request(app)
      .get("/api/logistics/items")
      .query({ status: "Active", category: "Steel and Rebar" })
      .set(as(dc.token));
    expect(active.body.map((i) => i.code)).toEqual(["REB-010"]);

    const escaped = await request(app)
      .get("/api/logistics/items")
      .query({ q: "(" })
      .set(as(dc.token));
    expect(escaped.status).toBe(200);
    expect(escaped.body).toEqual([]);
  });

  it("edits an item and leaves a Pending item's status alone", async () => {
    const s = await staff();
    const created = await request(app)
      .post("/api/logistics/items")
      .set(as(s.token))
      .send(itemBody());

    const res = await request(app)
      .put(`/api/logistics/items/${created.body._id}`)
      .set(as(s.token))
      .send({ description: "Portland cement Type 1", status: "Inactive" });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe("Portland cement Type 1");
    expect(res.body.status).toBe("Inactive");
    expect(res.body.code).toBe("CEM-001");

    const pending = await Item.create({
      description: "Requested thing",
      category: "Others",
      unit: "pc",
      status: "Pending",
      createdBy: s.user._id,
    });
    const put = await request(app)
      .put(`/api/logistics/items/${pending._id}`)
      .set(as(s.token))
      .send({ description: "Requested thing, renamed", status: "Active" });
    expect(put.status).toBe(200);
    expect(put.body.status).toBe("Pending");
    expect(put.body.description).toBe("Requested thing, renamed");

    const bad = await request(app)
      .put("/api/logistics/items/nope")
      .set(as(s.token))
      .send({});
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe("Invalid item ID.");

    const missing = await request(app)
      .put(`/api/logistics/items/${new mongoose.Types.ObjectId()}`)
      .set(as(s.token))
      .send({});
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe("Item not found.");
  });
});

describe("suppliers", () => {
  const supplierBody = (overrides = {}) => ({
    name: "ABC Hardware",
    vatType: "VAT",
    contactPerson: "Ana",
    phone: "0917",
    email: "abc@example.com",
    address: "Pasig",
    tin: "123",
    terms: "COD",
    ...overrides,
  });

  it("requires a VAT type of VAT or Non-VAT", async () => {
    const s = await staff();

    const missing = await request(app)
      .post("/api/logistics/suppliers")
      .set(as(s.token))
      .send(supplierBody({ vatType: undefined }));
    expect(missing.status).toBe(400);
    expect(missing.body.message).toBe("VAT type must be VAT or Non-VAT.");

    const zero = await request(app)
      .post("/api/logistics/suppliers")
      .set(as(s.token))
      .send(supplierBody({ vatType: "Zero" }));
    expect(zero.status).toBe(400);
    expect(zero.body.message).toBe("VAT type must be VAT or Non-VAT.");

    const noName = await request(app)
      .post("/api/logistics/suppliers")
      .set(as(s.token))
      .send(supplierBody({ name: "  " }));
    expect(noName.body.message).toBe("Supplier name is required.");

    const badStatus = await request(app)
      .post("/api/logistics/suppliers")
      .set(as(s.token))
      .send(supplierBody({ status: "Closed" }));
    expect(badStatus.body.message).toBe("Status must be Active or Inactive.");

    expect(await Supplier.countDocuments()).toBe(0);
  });

  it("lets Procurement Staff and the Head create suppliers", async () => {
    const s = await staff();
    const h = await head();

    const asStaff = await request(app)
      .post("/api/logistics/suppliers")
      .set(as(s.token))
      .send(supplierBody());
    expect(asStaff.status).toBe(201);
    expect(asStaff.body).toMatchObject({
      name: "ABC Hardware",
      nameKey: "abc hardware",
      vatType: "VAT",
      terms: "COD",
      status: "Active",
    });

    const asHead = await request(app)
      .post("/api/logistics/suppliers")
      .set(as(h.token))
      .send(supplierBody({ name: "Juan's Hardware", vatType: "Non-VAT" }));
    expect(asHead.status).toBe(201);
    expect(asHead.body.vatType).toBe("Non-VAT");
  });

  it("refuses the same name in another spelling", async () => {
    const s = await staff();
    await request(app)
      .post("/api/logistics/suppliers")
      .set(as(s.token))
      .send(supplierBody());

    const res = await request(app)
      .post("/api/logistics/suppliers")
      .set(as(s.token))
      .send(supplierBody({ name: "abc hardware" }));

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Supplier ABC Hardware already exists.");
    expect(await Supplier.countDocuments()).toBe(1);
  });

  it("edits a supplier, keeping the fields left out", async () => {
    const h = await head();
    const created = await request(app)
      .post("/api/logistics/suppliers")
      .set(as(h.token))
      .send(supplierBody());

    const res = await request(app)
      .put(`/api/logistics/suppliers/${created.body._id}`)
      .set(as(h.token))
      .send({ terms: "30 days", status: "Inactive" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: "ABC Hardware",
      vatType: "VAT",
      terms: "30 days",
      status: "Inactive",
    });

    const bad = await request(app)
      .put("/api/logistics/suppliers/nope")
      .set(as(h.token))
      .send({});
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe("Invalid supplier ID.");

    const missing = await request(app)
      .put(`/api/logistics/suppliers/${new mongoose.Types.ObjectId()}`)
      .set(as(h.token))
      .send({});
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe("Supplier not found.");
  });

  it("lists for procurement and Accounting, not for a site role", async () => {
    const s = await staff();
    const dc = await controller("dc");
    const acct = await accounting();
    await request(app)
      .post("/api/logistics/suppliers")
      .set(as(s.token))
      .send(supplierBody({ name: "Zeta Supply" }));
    await request(app)
      .post("/api/logistics/suppliers")
      .set(as(s.token))
      .send(supplierBody({ status: "Inactive" }));

    const refused = await request(app)
      .get("/api/logistics/suppliers")
      .set(as(dc.token));
    expect(refused.status).toBe(403);
    expect(refused.body.message).toBe(
      "This needs the position Procurement Staff or Procurement Head, or the department Accounting.",
    );

    const asAccounting = await request(app)
      .get("/api/logistics/suppliers")
      .set(as(acct.token));
    expect(asAccounting.status).toBe(200);
    expect(asAccounting.body.map((x) => x.name)).toEqual(["ABC Hardware", "Zeta Supply"]);

    const active = await request(app)
      .get("/api/logistics/suppliers")
      .query({ status: "Active" })
      .set(as(s.token));
    expect(active.body.map((x) => x.name)).toEqual(["Zeta Supply"]);

    const writeRefused = await request(app)
      .post("/api/logistics/suppliers")
      .set(as(acct.token))
      .send(supplierBody({ name: "New" }));
    expect(writeRefused.status).toBe(403);
    expect(writeRefused.body.message).toBe(
      "This needs the position Procurement Staff or Procurement Head.",
    );
  });
});

describe("reserved dropdown values", () => {
  const seedDropdown = () =>
    Dropdown.create({
      designations: [],
      departments: ["Operations", "Accounting", "Site"],
      employmentTypes: [],
      positions: {
        Operations: ["Project In-charge", "Foreman"],
        Accounting: ["Bookkeeper"],
        Site: ["Document Controller"],
      },
    });

  const reserved = (value) =>
    `"${value}" is used by the Logistics module and can't be removed or renamed.`;

  it("refuses deleting or renaming a reserved position", async () => {
    const boss = await admin();
    await seedDropdown();

    const del = await request(app)
      .delete("/api/dropdownOption/positions/Operations/delete")
      .set(as(boss.token))
      .send({ option: "Project In-charge" });
    expect(del.status).toBe(409);
    expect(del.body.message).toBe(reserved("Project In-charge"));

    const rename = await request(app)
      .put("/api/dropdownOption/positions/Operations/edit")
      .set(as(boss.token))
      .send({ oldOption: "Project In-charge", newOption: "Project Manager" });
    expect(rename.status).toBe(409);
    expect(rename.body.message).toBe(reserved("Project In-charge"));

    const doc = await Dropdown.findOne().lean();
    expect(doc.positions.Operations).toEqual(["Project In-charge", "Foreman"]);
  });

  it("lets a case-only rename through", async () => {
    const boss = await admin();
    await seedDropdown();

    const res = await request(app)
      .put("/api/dropdownOption/positions/Operations/edit")
      .set(as(boss.token))
      .send({ oldOption: "Project In-charge", newOption: "Project In-Charge" });
    expect(res.status).toBe(200);
  });

  it("refuses deleting a reserved department or one that holds a reserved position", async () => {
    const boss = await admin();
    await seedDropdown();

    const acct = await request(app)
      .delete("/api/dropdownOption/departments/delete")
      .set(as(boss.token))
      .send({ option: "Accounting" });
    expect(acct.status).toBe(409);
    expect(acct.body.message).toBe(reserved("Accounting"));

    const site = await request(app)
      .delete("/api/dropdownOption/departments/delete")
      .set(as(boss.token))
      .send({ option: "Site" });
    expect(site.status).toBe(409);
    expect(site.body.message).toBe(reserved("Document Controller"));

    const rename = await request(app)
      .put("/api/dropdownOption/departments/edit")
      .set(as(boss.token))
      .send({ oldOption: "Accounting", newOption: "Finance" });
    expect(rename.status).toBe(409);
    expect(rename.body.message).toBe(reserved("Accounting"));

    const doc = await Dropdown.findOne().lean();
    expect(doc.departments).toEqual(["Operations", "Accounting", "Site"]);
  });

  it("still deletes a position that is not reserved", async () => {
    const boss = await admin();
    await seedDropdown();

    const res = await request(app)
      .delete("/api/dropdownOption/positions/Operations/delete")
      .set(as(boss.token))
      .send({ option: "Foreman" });
    expect(res.status).toBe(200);
    const doc = await Dropdown.findOne().lean();
    expect(doc.positions.Operations).toEqual(["Project In-charge"]);
  });

  it("accepts the two new list fields", async () => {
    const boss = await admin();
    await seedDropdown();

    const add = await request(app)
      .post("/api/dropdownOption/itemCategories/add")
      .set(as(boss.token))
      .send({ option: "Electrical" });
    expect(add.status).toBe(200);
    expect(add.body.itemCategories).toEqual(["Electrical"]);

    const unit = await request(app)
      .post("/api/dropdownOption/unitsOfMeasure/add")
      .set(as(boss.token))
      .send({ option: "pc" });
    expect(unit.body.unitsOfMeasure).toEqual(["pc"]);
  });

  it("names the list in plain words when a value already exists", async () => {
    const boss = await admin();
    await Dropdown.create({
      itemCategories: ["Electrical"],
      unitsOfMeasure: ["pc"],
    });

    const category = await request(app)
      .post("/api/dropdownOption/itemCategories/add")
      .set(as(boss.token))
      .send({ option: "Electrical" });
    expect(category.status).toBe(409);
    expect(category.body.message).toBe(
      "Electrical already exists in item categories",
    );

    const unit = await request(app)
      .post("/api/dropdownOption/unitsOfMeasure/add")
      .set(as(boss.token))
      .send({ option: "pc" });
    expect(unit.status).toBe(409);
    expect(unit.body.message).toBe("pc already exists in units of measure");

    const doc = await Dropdown.findOne().lean();
    expect(doc.itemCategories).toEqual(["Electrical"]);
    expect(doc.unitsOfMeasure).toEqual(["pc"]);
  });

  it("names the list in plain words when there is nothing to edit", async () => {
    const boss = await admin();
    const res = await request(app)
      .put("/api/dropdownOption/employmentTypes/edit")
      .set(as(boss.token))
      .send({ oldOption: "Regular", newOption: "Permanent" });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Field 'employment types' not found");
  });

  it("keeps the duplicate check behind the admin role", async () => {
    const worker = await person("worker1");
    await Dropdown.create({ itemCategories: ["Electrical"] });
    const res = await request(app)
      .post("/api/dropdownOption/itemCategories/add")
      .set(as(worker.token))
      .send({ option: "Electrical" });
    expect(res.status).toBe(403);
  });
});

describe("dropdown duplicates ignore capitals and spaces", () => {
  const seedDropdown = () =>
    Dropdown.create({
      designations: [],
      departments: ["Operations", "Accounting", "Site"],
      employmentTypes: [],
      itemCategories: ["Others", "Electrical", "Plumbing"],
      unitsOfMeasure: ["pc"],
      positions: {
        Operations: ["Project In-charge", "Foreman"],
        Accounting: ["Bookkeeper"],
        Site: ["Document Controller"],
      },
    });

  it("refuses adding a value that differs only in capitals, naming the stored spelling", async () => {
    const boss = await admin();
    await seedDropdown();

    const res = await request(app)
      .post("/api/dropdownOption/itemCategories/add")
      .set(as(boss.token))
      .send({ option: " others " });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Others already exists in item categories");

    const doc = await Dropdown.findOne().lean();
    expect(doc.itemCategories).toEqual(["Others", "Electrical", "Plumbing"]);
  });

  it("stores a new value trimmed and refuses a blank one", async () => {
    const boss = await admin();
    await seedDropdown();

    const add = await request(app)
      .post("/api/dropdownOption/unitsOfMeasure/add")
      .set(as(boss.token))
      .send({ option: "  box  " });
    expect(add.status).toBe(200);
    expect(add.body.unitsOfMeasure).toEqual(["pc", "box"]);

    const blank = await request(app)
      .post("/api/dropdownOption/unitsOfMeasure/add")
      .set(as(boss.token))
      .send({ option: "   " });
    expect(blank.status).toBe(400);
    expect(blank.body.message).toBe("Option is required");
  });

  it("allows the same position in another department", async () => {
    const boss = await admin();
    await seedDropdown();

    const res = await request(app)
      .post("/api/dropdownOption/positions/Accounting/add")
      .set(as(boss.token))
      .send({ option: "Foreman" });
    expect(res.status).toBe(200);
    const doc = await Dropdown.findOne().lean();
    expect(doc.positions.Accounting).toEqual(["Bookkeeper", "Foreman"]);
    expect(doc.positions.Operations).toEqual(["Project In-charge", "Foreman"]);
  });

  it("refuses a position that differs only in capitals within the same department", async () => {
    const boss = await admin();
    await seedDropdown();

    const res = await request(app)
      .post("/api/dropdownOption/positions/Operations/add")
      .set(as(boss.token))
      .send({ option: " FOREMAN " });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Foreman already exists in positions");

    const doc = await Dropdown.findOne().lean();
    expect(doc.positions.Operations).toEqual(["Project In-charge", "Foreman"]);
  });

  it("refuses renaming a value onto another existing value in different capitals", async () => {
    const boss = await admin();
    await seedDropdown();

    const res = await request(app)
      .put("/api/dropdownOption/itemCategories/edit")
      .set(as(boss.token))
      .send({ oldOption: "Plumbing", newOption: "electrical" });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      "Electrical already exists in item categories",
    );

    const dept = await request(app)
      .put("/api/dropdownOption/departments/edit")
      .set(as(boss.token))
      .send({ oldOption: "Operations", newOption: " site " });
    expect(dept.status).toBe(409);
    expect(dept.body.message).toBe("Site already exists in departments");

    const doc = await Dropdown.findOne().lean();
    expect(doc.itemCategories).toEqual(["Others", "Electrical", "Plumbing"]);
    expect(doc.departments).toEqual(["Operations", "Accounting", "Site"]);
    expect(Object.keys(doc.positions)).toEqual([
      "Operations",
      "Accounting",
      "Site",
    ]);
  });

  it("allows renaming a value to a capitals variant of itself", async () => {
    const boss = await admin();
    await seedDropdown();

    const res = await request(app)
      .put("/api/dropdownOption/itemCategories/edit")
      .set(as(boss.token))
      .send({ oldOption: "Plumbing", newOption: " PLUMBING " });
    expect(res.status).toBe(200);
    expect(res.body.itemCategories).toEqual(["Others", "Electrical", "PLUMBING"]);
  });

  it("refuses renaming a position onto another position in the same department", async () => {
    const boss = await admin();
    await seedDropdown();

    const res = await request(app)
      .put("/api/dropdownOption/positions/Operations/edit")
      .set(as(boss.token))
      .send({ oldOption: "Foreman", newOption: "project in-charge" });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      "Project In-charge already exists in positions",
    );

    const doc = await Dropdown.findOne().lean();
    expect(doc.positions.Operations).toEqual(["Project In-charge", "Foreman"]);
  });

  it("still lets a reserved position or department be renamed in capitals only", async () => {
    const boss = await admin();
    await seedDropdown();

    const position = await request(app)
      .put("/api/dropdownOption/positions/Operations/edit")
      .set(as(boss.token))
      .send({ oldOption: "Project In-charge", newOption: " PROJECT IN-CHARGE " });
    expect(position.status).toBe(200);
    const doc = await Dropdown.findOne().lean();
    expect(doc.positions.Operations).toEqual(["PROJECT IN-CHARGE", "Foreman"]);

    const department = await request(app)
      .put("/api/dropdownOption/departments/edit")
      .set(as(boss.token))
      .send({ oldOption: "Accounting", newOption: "ACCOUNTING" });
    expect(department.status).toBe(200);
    expect(department.body.departments).toEqual([
      "Operations",
      "ACCOUNTING",
      "Site",
    ]);
  });

  it("keeps the position duplicate check behind the admin role", async () => {
    const worker = await person("worker1");
    await seedDropdown();

    const res = await request(app)
      .post("/api/dropdownOption/positions/Operations/add")
      .set(as(worker.token))
      .send({ option: "Rigger" });
    expect(res.status).toBe(403);

    const doc = await Dropdown.findOne().lean();
    expect(doc.positions.Operations).toEqual(["Project In-charge", "Foreman"]);
  });
});

describe("dropdown positions follow their department", () => {
  const seedDropdown = () =>
    Dropdown.create({
      designations: [],
      departments: ["Operations", "Accounting", "Site", "Warehouse"],
      employmentTypes: [],
      positions: {
        Operations: ["Project In-charge", "Foreman"],
        Accounting: ["Bookkeeper"],
        Site: ["Document Controller"],
      },
    });

  it("answers a department's positions, an empty list when it has none, and 404 when unknown", async () => {
    const boss = await admin();
    await seedDropdown();

    const ops = await request(app)
      .get("/api/dropdownOption/positions/Operations")
      .set(as(boss.token))
      .timeout(5000);
    expect(ops.status).toBe(200);
    expect(ops.body).toEqual(["Project In-charge", "Foreman"]);

    const none = await request(app)
      .get("/api/dropdownOption/positions/Warehouse")
      .set(as(boss.token))
      .timeout(5000);
    expect(none.status).toBe(200);
    expect(none.body).toEqual([]);

    const unknown = await request(app)
      .get("/api/dropdownOption/positions/Marketing")
      .set(as(boss.token))
      .timeout(5000);
    expect(unknown.status).toBe(404);
    expect(unknown.body.message).toBe("Department 'Marketing' not found");
  });

  it("replies with the department's positions after add, edit and delete", async () => {
    const boss = await admin();
    await seedDropdown();

    const add = await request(app)
      .post("/api/dropdownOption/positions/Operations/add")
      .set(as(boss.token))
      .send({ option: "Rigger" });
    expect(add.status).toBe(200);
    expect(add.body.positions).toEqual(["Project In-charge", "Foreman", "Rigger"]);

    const edit = await request(app)
      .put("/api/dropdownOption/positions/Operations/edit")
      .set(as(boss.token))
      .send({ oldOption: "Rigger", newOption: "Welder" });
    expect(edit.status).toBe(200);
    expect(edit.body.positions).toEqual(["Project In-charge", "Foreman", "Welder"]);

    const del = await request(app)
      .delete("/api/dropdownOption/positions/Operations/delete")
      .set(as(boss.token))
      .send({ option: "Welder" });
    expect(del.status).toBe(200);
    expect(del.body.positions).toEqual(["Project In-charge", "Foreman"]);
  });

  it("moves a department's positions to its new name on rename", async () => {
    const boss = await admin();
    await seedDropdown();

    const res = await request(app)
      .put("/api/dropdownOption/departments/edit")
      .set(as(boss.token))
      .send({ oldOption: "Operations", newOption: "Field Operations" });
    expect(res.status).toBe(200);

    const doc = await Dropdown.findOne().lean();
    expect(doc.departments).toEqual([
      "Field Operations",
      "Accounting",
      "Site",
      "Warehouse",
    ]);
    expect(doc.positions["Field Operations"]).toEqual([
      "Project In-charge",
      "Foreman",
    ]);
    expect(doc.positions).not.toHaveProperty("Operations");
    expect(doc.positions.Accounting).toEqual(["Bookkeeper"]);
  });

  it("keeps the positions on a capitals-only department rename", async () => {
    const boss = await admin();
    await seedDropdown();

    const res = await request(app)
      .put("/api/dropdownOption/departments/edit")
      .set(as(boss.token))
      .send({ oldOption: "Operations", newOption: "OPERATIONS" });
    expect(res.status).toBe(200);

    const doc = await Dropdown.findOne().lean();
    expect(doc.departments[0]).toBe("OPERATIONS");
    expect(doc.positions.OPERATIONS).toEqual(["Project In-charge", "Foreman"]);
    expect(doc.positions).not.toHaveProperty("Operations");
  });

  it("leaves the positions alone when a department rename is refused", async () => {
    const boss = await admin();
    await seedDropdown();

    const res = await request(app)
      .put("/api/dropdownOption/departments/edit")
      .set(as(boss.token))
      .send({ oldOption: "Operations", newOption: " site " });
    expect(res.status).toBe(409);

    const doc = await Dropdown.findOne().lean();
    expect(doc.positions.Operations).toEqual(["Project In-charge", "Foreman"]);
    expect(doc.positions.Site).toEqual(["Document Controller"]);
  });
});

describe("setup health, seed and lists", () => {
  it("lists every missing value when there is no dropdown document", async () => {
    const boss = await admin();
    const res = await request(app)
      .get("/api/logistics/setup/health")
      .set(as(boss.token));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: false,
      missingPositions: [
        "Document Controller",
        "Project In-charge",
        "Procurement Staff",
        "Procurement Head",
      ],
      missingDepartments: ["Accounting"],
    });
  });

  it("seeds what is missing, once", async () => {
    const boss = await admin();
    await Dropdown.create({
      departments: ["accounting", "Engineering"],
      positions: { accounting: ["Bookkeeper"], Engineering: ["project in-charge"] },
      itemCategories: ["Custom"],
    });

    const first = await request(app)
      .post("/api/logistics/setup/seed-reserved")
      .set(as(boss.token));
    expect(first.status).toBe(200);
    expect(first.body.message).toBe("Reserved values added.");
    expect(first.body.added).toEqual({
      departments: ["Procurement", "Operations"],
      positions: ["Procurement Staff", "Procurement Head", "Document Controller"],
      itemCategories: 0,
      unitsOfMeasure: DEFAULT_UNITS_OF_MEASURE.length,
    });
    expect(first.body.health).toEqual({
      ok: true,
      missingPositions: [],
      missingDepartments: [],
    });

    const doc = await Dropdown.findOne().lean();
    expect(doc.departments).toEqual(["accounting", "Engineering", "Procurement", "Operations"]);
    expect(doc.positions.Procurement).toEqual(["Procurement Staff", "Procurement Head"]);
    expect(doc.positions.Operations).toEqual(["Document Controller"]);
    expect(doc.positions.Engineering).toEqual(["project in-charge"]);
    expect(doc.itemCategories).toEqual(["Custom"]);
    expect(doc.unitsOfMeasure).toEqual(DEFAULT_UNITS_OF_MEASURE);

    const second = await request(app)
      .post("/api/logistics/setup/seed-reserved")
      .set(as(boss.token));
    expect(second.body.message).toBe("Nothing was missing.");
    expect(second.body.added).toEqual({
      departments: [],
      positions: [],
      itemCategories: 0,
      unitsOfMeasure: 0,
    });

    const health = await request(app)
      .get("/api/logistics/setup/health")
      .set(as(boss.token));
    expect(health.body.ok).toBe(true);
  });

  it("creates the dropdown document and fills the default lists", async () => {
    const boss = await admin();
    const res = await request(app)
      .post("/api/logistics/setup/seed-reserved")
      .set(as(boss.token));

    expect(res.status).toBe(200);
    expect(res.body.added.itemCategories).toBe(DEFAULT_ITEM_CATEGORIES.length);
    expect(res.body.added.departments).toEqual(["Accounting", "Procurement", "Operations"]);
    expect(await Dropdown.countDocuments()).toBe(1);

    const dc = await controller("dc");
    const lists = await request(app)
      .get("/api/logistics/setup/lists")
      .set(as(dc.token));
    expect(lists.status).toBe(200);
    expect(lists.body).toEqual({
      itemCategories: DEFAULT_ITEM_CATEGORIES,
      unitsOfMeasure: DEFAULT_UNITS_OF_MEASURE,
    });
  });

  it("keeps health and seed Admin only, and lists behind a logistics page", async () => {
    const s = await staff();
    const noPage = await person("nopage", { position: "Procurement Staff", pageAccess: ["payroll"] });

    expect((await request(app).get("/api/logistics/setup/health").set(as(s.token))).status).toBe(403);
    expect((await request(app).post("/api/logistics/setup/seed-reserved").set(as(s.token))).status).toBe(403);

    const lists = await request(app)
      .get("/api/logistics/setup/lists")
      .set(as(noPage.token));
    expect(lists.status).toBe(403);
    expect(lists.body.code).toBe("PAGE_ACCESS_DENIED");

    const empty = await request(app)
      .get("/api/logistics/setup/lists")
      .set(as(s.token));
    expect(empty.body).toEqual({ itemCategories: [], unitsOfMeasure: [] });
  });
});

describe("GET /api/logistics/files/:docType/:docId/:attachmentId", () => {
  const uploadDir = path.join(
    __dirname,
    "../private-uploads/logistics/MaterialRequest",
  );
  const fileName = "test-attachment-logistics.txt";
  const filePath = path.join(uploadDir, fileName);
  const docId = new mongoose.Types.ObjectId();
  const attachmentId = new mongoose.Types.ObjectId();

  beforeAll(() => {
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(filePath, "hello from the site");
  });

  afterAll(() => {
    fs.rmSync(filePath, { force: true });
    // Remove the folders this test made, when nothing else is in them
    for (const dir of [
      uploadDir,
      path.dirname(uploadDir),
      path.dirname(path.dirname(uploadDir)),
    ]) {
      try {
        fs.rmdirSync(dir);
      } catch (err) {
        break;
      }
    }
  });

  afterEach(() => {
    delete filesRouter.documentReaders.MaterialRequest;
  });

  const url = (type = "MaterialRequest", doc = docId, att = attachmentId) =>
    `/api/logistics/files/${type}/${doc}/${att}`;

  it("refuses a bad document type or id", async () => {
    const boss = await admin();

    const type = await request(app).get(url("Invoice")).set(as(boss.token));
    expect(type.status).toBe(400);
    expect(type.body.message).toBe("Invalid document type.");

    const id = await request(app)
      .get(url("MaterialRequest", "nope"))
      .set(as(boss.token));
    expect(id.status).toBe(400);
    expect(id.body.message).toBe("Invalid document ID.");
  });

  it("answers 404 while no reader is registered", async () => {
    const boss = await admin();
    const res = await request(app).get(url()).set(as(boss.token));
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Document not found.");
  });

  it("streams the file to the project's controller and Admin, not to another project's", async () => {
    const boss = await admin();
    const dc = await controller("dc");
    const other = await controller("other");
    const project = await makeProject(boss.user._id, {
      documentControllerIds: [dc.user._id],
    });
    await makeProject(boss.user._id, {
      code: "ACE02",
      name: "Theirs",
      documentControllerIds: [other.user._id],
    });

    filesRouter.documentReaders.MaterialRequest = async (id) =>
      String(id) === String(docId)
        ? {
            _id: docId,
            projectId: project._id,
            attachments: [
              {
                _id: attachmentId,
                name: "site photo.txt",
                mimeType: "text/plain",
                fileName,
              },
            ],
          }
        : null;

    const refused = await request(app).get(url()).set(as(other.token));
    expect(refused.status).toBe(403);
    expect(refused.body.message).toBe("You are not assigned to project ACE01.");

    const asDc = await request(app).get(url()).set(as(dc.token));
    expect(asDc.status).toBe(200);
    expect(asDc.headers["content-type"]).toMatch(/^text\/plain/);
    expect(asDc.headers["content-disposition"]).toBe(
      'inline; filename="site photo.txt"',
    );
    expect(asDc.text).toBe("hello from the site");

    const asAdmin = await request(app).get(url()).set(as(boss.token));
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.text).toBe("hello from the site");

    const noAttachment = await request(app)
      .get(url("MaterialRequest", docId, new mongoose.Types.ObjectId()))
      .set(as(boss.token));
    expect(noAttachment.status).toBe(404);
    expect(noAttachment.body.message).toBe("Attachment not found.");

    const clerk = await person("clerk", { position: "Clerk" });
    const noRole = await request(app).get(url()).set(as(clerk.token));
    expect(noRole.status).toBe(403);
  });

  it("answers 404 when the file is missing on disk", async () => {
    const boss = await admin();
    const project = await makeProject(boss.user._id);
    filesRouter.documentReaders.MaterialRequest = async () => ({
      projectId: project._id,
      attachments: [
        {
          _id: attachmentId,
          name: "gone.txt",
          mimeType: "text/plain",
          fileName: "../../does-not-exist.txt",
        },
      ],
    });

    const res = await request(app).get(url()).set(as(boss.token));
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("File not found.");
  });
});
