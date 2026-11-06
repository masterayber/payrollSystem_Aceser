// Super Admin and Admin accounts are hidden from the system: every per-employee route
// aimed at one answers exactly as for a missing account, and every list, picker and
// count leaves both roles out. The account itself still reads and edits its own settings.
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const Attendance = require("../models/attendance");
const LeaveApplication = require("../models/leaveApplication");
const OvertimeApplication = require("../models/overtimeApplication");
const Project = require("../models/project");
const {
  findVisibleUser,
  isHiddenAccount,
  hiddenUserIds,
  hiddenUserIdSet,
  withoutHiddenMembers,
} = require("../utils/hiddenAccounts");

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await Promise.all(
    [
      User,
      Employee,
      Settings,
      Attendance,
      LeaveApplication,
      OvertimeApplication,
      Project,
    ].map((Model) => Model.deleteMany({})),
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const PASSWORD = "Password123!";

const loginAs = async (username) => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password: PASSWORD });
  return res.body.token;
};

// Creates Auth + Employee + Settings for one person and signs them in when Active
const person = async (
  username,
  {
    role = "Employee",
    status = "Active",
    employeeId = `EMP-${username}`,
    job = {},
    pageAccess,
  } = {},
) => {
  const user = await User.create({
    username,
    password: PASSWORD,
    email: `${username}@example.com`,
    role,
    status,
    ...(pageAccess ? { pageAccess } : {}),
  });
  await Employee.create({
    userId: user._id,
    firstName: username.charAt(0).toUpperCase() + username.slice(1),
    lastName: "Test",
    employeeId,
    email: `${username}@example.com`,
    role,
  });
  await Settings.create({
    userId: user._id,
    general: {
      jobDescription: {
        employmentType: "Regular",
        basicPay: 30000,
        startDate: "2025-01-06",
        ...job,
      },
    },
  });
  const token = status === "Active" ? await loginAs(username) : null;
  return { user, token };
};

const as = (token) => ({ Authorization: `Bearer ${token}` });
const missingId = () => String(new mongoose.Types.ObjectId());

const superAdmin = (job) =>
  person("admin", { role: "Super Admin", employeeId: "ADM-001", job });
const plainAdmin = (job) =>
  person("hr", { role: "Admin", employeeId: "ADM-002", job });
const employee = (username = "ana", job) =>
  person(username, { employeeId: "AC-001", job });

// Each hidden role, with an admin of the other role to make the requests
const CASES = [
  ["Super Admin", { hidden: superAdmin, caller: plainAdmin }],
  ["Admin", { hidden: plainAdmin, caller: superAdmin }],
];

const send = (method, url, token, body) => {
  const req = request(app)[method](url).set(as(token));
  return body === undefined ? req : req.send(body);
};

// The hidden account's id and an unknown id get the very same answer
const expectSameAsMissing = async (method, urlFor, token, expected, body) => {
  const hiddenRes = await send(method, urlFor.hidden, token, body);
  const missingRes = await send(method, urlFor.missing, token, body);
  expect(hiddenRes.status).toBe(404);
  expect(hiddenRes.body).toEqual(expected);
  expect(missingRes.status).toBe(404);
  expect(missingRes.body).toEqual(expected);
};

describe("hiddenAccounts helpers", () => {
  it("finds an employee, and neither admin role nor a missing or bad id", async () => {
    const boss = await superAdmin();
    const hr = await plainAdmin();
    const ana = await employee();

    expect(String((await findVisibleUser(ana.user._id))._id)).toBe(
      String(ana.user._id),
    );
    expect(await findVisibleUser(boss.user._id)).toBeNull();
    expect(await findVisibleUser(hr.user._id)).toBeNull();
    expect(await findVisibleUser(missingId())).toBeNull();
    expect(await findVisibleUser("not-an-id")).toBeNull();
  });

  it("calls only an existing admin-role account hidden", async () => {
    const boss = await superAdmin();
    const hr = await plainAdmin();
    const ana = await employee();

    expect(await isHiddenAccount(boss.user._id)).toBe(true);
    expect(await isHiddenAccount(hr.user._id)).toBe(true);
    expect(await isHiddenAccount(ana.user._id)).toBe(false);
    expect(await isHiddenAccount(missingId())).toBe(false);
    expect(await isHiddenAccount("not-an-id")).toBe(false);
  });

  it("lists the ids of both admin roles only", async () => {
    const boss = await superAdmin();
    const hr = await plainAdmin();
    await employee();

    const ids = (await hiddenUserIds()).map(String).sort();
    expect(ids).toEqual([String(boss.user._id), String(hr.user._id)].sort());
    expect([...(await hiddenUserIdSet())].sort()).toEqual(ids);
  });

  it("takes hidden ids out of a project's raw member fields, keeping the rest", () => {
    const [boss, hr, ana, ben] = [1, 2, 3, 4].map(
      () => new mongoose.Types.ObjectId(),
    );
    const hidden = new Set([String(boss), String(hr)]);
    const project = {
      code: "ACE01",
      inChargeId: boss,
      documentControllerIds: [hr, ana],
    };

    expect(withoutHiddenMembers(project, hidden)).toEqual({
      code: "ACE01",
      inChargeId: null,
      documentControllerIds: [ana],
    });
    // The input is not changed
    expect(project.inChargeId).toBe(boss);
    expect(project.documentControllerIds).toEqual([hr, ana]);

    expect(
      withoutHiddenMembers(
        { inChargeId: ben, documentControllerIds: [ana] },
        hidden,
      ),
    ).toEqual({ inChargeId: ben, documentControllerIds: [ana] });
    expect(withoutHiddenMembers({ code: "ACE02" }, hidden)).toEqual({
      code: "ACE02",
      inChargeId: null,
      documentControllerIds: [],
    });
  });
});

describe("project replies leave admin-role members out", () => {
  // ACE01: In-charge the Super Admin, controllers the Admin and Dina (visible).
  // ACE02: In-charge Ana (visible), controller the Admin.
  const seed = async () => {
    const boss = await superAdmin({ position: "Project In-charge" });
    const hr = await plainAdmin({ position: "Document Controller" });
    const ana = await person("ana", {
      employeeId: "AC-001",
      job: { position: "Project In-charge" },
    });
    const dina = await person("dina", {
      employeeId: "AC-002",
      job: { position: "Document Controller" },
      pageAccess: ["logistics-material-requests"],
    });
    const seatedBefore = await Project.create({
      code: "ACE01",
      name: "Demo Tower",
      location: "Quezon City",
      createdBy: boss.user._id,
      inChargeId: boss.user._id,
      documentControllerIds: [hr.user._id, dina.user._id],
    });
    await Project.create({
      code: "ACE02",
      name: "Second",
      location: "Pasig",
      createdBy: boss.user._id,
      inChargeId: ana.user._id,
      documentControllerIds: [hr.user._id],
    });
    return { boss, hr, ana, dina, seatedBefore };
  };

  it.each([
    ["Super Admin", "boss"],
    ["Admin", "hr"],
  ])("in the list and the detail, as seen by the %s", async (_, who) => {
    const people = await seed();
    const { token } = people[who];
    const anaId = String(people.ana.user._id);
    const dinaId = String(people.dina.user._id);

    const list = await request(app)
      .get("/api/logistics/projects")
      .set(as(token));
    expect(list.status).toBe(200);
    expect(
      list.body.map(({ code, inChargeId, documentControllerIds }) => ({
        code,
        inChargeId,
        documentControllerIds,
      })),
    ).toEqual([
      { code: "ACE01", inChargeId: null, documentControllerIds: [dinaId] },
      { code: "ACE02", inChargeId: anaId, documentControllerIds: [] },
    ]);

    const detail = await request(app)
      .get(`/api/logistics/projects/${people.seatedBefore._id}`)
      .set(as(token));
    expect(detail.status).toBe(200);
    expect(detail.body.inChargeId).toBeNull();
    expect(detail.body.documentControllerIds).toEqual([dinaId]);
    expect(detail.body.inCharge).toBeNull();
    expect(detail.body.documentControllers.map((row) => String(row._id))).toEqual(
      [dinaId],
    );

    // What is stored is unchanged
    const stored = await Project.findById(people.seatedBefore._id).lean();
    expect(String(stored.inChargeId)).toBe(String(people.boss.user._id));
    expect(stored.documentControllerIds.map(String)).toEqual([
      String(people.hr.user._id),
      dinaId,
    ]);
  });

  it("for a seated Document Controller (site role), list and detail", async () => {
    const { dina, seatedBefore } = await seed();
    const dinaId = String(dina.user._id);

    const list = await request(app)
      .get("/api/logistics/projects")
      .set(as(dina.token));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      code: "ACE01",
      inChargeId: null,
      documentControllerIds: [dinaId],
    });

    const detail = await request(app)
      .get(`/api/logistics/projects/${seatedBefore._id}`)
      .set(as(dina.token));
    expect(detail.status).toBe(200);
    expect(detail.body.inChargeId).toBeNull();
    expect(detail.body.documentControllerIds).toEqual([dinaId]);
  });

  it("still refuses the list to an employee with no Logistics page", async () => {
    await seed();
    const { token } = await person("eve", { employeeId: "AC-003" });

    const res = await request(app)
      .get("/api/logistics/projects")
      .set(as(token));
    expect(res.status).toBe(403);
  });
});

describe.each(CASES)(
  "a %s account answers as missing",
  (roleName, { hidden, caller }) => {
    let target;
    let token;
    let urlOf;

    beforeEach(async () => {
      target = await hidden();
      ({ token } = await caller());
      const ids = { hidden: String(target.user._id), missing: missingId() };
      urlOf = (build) => ({
        hidden: build(ids.hidden),
        missing: build(ids.missing),
      });
    });

    it("on the employee profile", async () => {
      await expectSameAsMissing(
        "get",
        urlOf((id) => `/api/employee/employees/${id}`),
        token,
        { message: "User not found" },
      );
    });

    it("on resign and reinstate, and the account is untouched", async () => {
      await expectSameAsMissing(
        "patch",
        urlOf((id) => `/api/employee/employees/${id}/resign`),
        token,
        { message: "User not found" },
        { resignationDate: "2026-10-30", resignationReason: "Test" },
      );
      await expectSameAsMissing(
        "patch",
        urlOf((id) => `/api/employee/employees/${id}/reinstate`),
        token,
        { message: "User not found" },
      );

      const saved = await User.findById(target.user._id).lean();
      expect(saved.status).toBe("Active");
      const job = await Settings.findOne({ userId: target.user._id }).lean();
      expect(job.general.jobDescription.resignationReason).toBeFalsy();
    });

    it("on Edit Employee, and nothing is saved", async () => {
      await expectSameAsMissing(
        "put",
        urlOf((id) => `/api/employee/edit-employee-via-admin/${id}`),
        token,
        { message: "User not found" },
        { username: "renamed", firstName: "Changed", basicPay: 1 },
      );

      const saved = await User.findById(target.user._id).lean();
      expect(saved.username).not.toBe("renamed");
      const record = await Employee.findOne({ userId: target.user._id }).lean();
      expect(record.firstName).not.toBe("Changed");
    });

    it("on delete, and every record is kept", async () => {
      const { employeeId } = await Employee.findOne({
        userId: target.user._id,
      }).lean();
      await expectSameAsMissing(
        "delete",
        {
          hidden: `/api/employee/delete-employee/${employeeId}`,
          missing: "/api/employee/delete-employee/AC-999",
        },
        token,
        { message: "Employee not found" },
      );

      expect(await User.exists({ _id: target.user._id })).toBeTruthy();
      expect(await Employee.exists({ userId: target.user._id })).toBeTruthy();
      expect(await Settings.exists({ userId: target.user._id })).toBeTruthy();
    });

    it("on Manage Access, read and change", async () => {
      await expectSameAsMissing(
        "get",
        urlOf((id) => `/api/access/users/${id}`),
        token,
        { message: "User not found" },
      );
      await expectSameAsMissing(
        "put",
        urlOf((id) => `/api/access/users/${id}`),
        token,
        { message: "User not found" },
        { pages: ["dashboard"] },
      );

      const saved = await User.findById(target.user._id).lean();
      expect(saved.pageAccess).toBeUndefined();
    });

    it("on another account's settings and profile photo", async () => {
      await expectSameAsMissing(
        "put",
        urlOf((id) => `/api/settings/updateGeneralSettings/${id}`),
        token,
        { message: "User not found" },
        { employee: { contactNumber: "09170000000" } },
      );
      await expectSameAsMissing(
        "delete",
        urlOf((id) => `/api/settings/remove-profile-photo/${id}`),
        token,
        { message: "User not found" },
      );

      const record = await Employee.findOne({ userId: target.user._id }).lean();
      expect(record.contactNumber).not.toBe("09170000000");
    });

    it("on the per-employee attendance views", async () => {
      for (const build of [
        (id) => `/api/attendance/${id}/records`,
        (id) => `/api/attendance/${id}/today`,
        (id) => `/api/attendance/${id}`,
      ]) {
        await expectSameAsMissing("get", urlOf(build), token, {
          message: "User not found",
        });
      }
    });

    it("on Edit Attendance, and no record is created", async () => {
      await expectSameAsMissing(
        "put",
        urlOf((id) => `/api/attendance/edit-attendance/${id}`),
        token,
        { message: "User not found" },
        { date: "2026-11-02", timeIn: "08:00:00", timeOut: "17:00:00" },
      );
      expect(await Attendance.countDocuments({})).toBe(0);
    });

    it("on the leave credits of the profile page", async () => {
      await expectSameAsMissing(
        "get",
        urlOf((id) => `/api/filing/leave-credits/${id}`),
        token,
        { error: "User not found." },
      );
    });

    it("on a decision on its leave or overtime request, which stays Pending", async () => {
      const leave = await LeaveApplication.create({
        userId: target.user._id,
        leaveType: "Emergency Leave",
        leaveDetails: "Test",
        startDate: new Date("2026-11-10T00:00:00Z"),
        endDate: new Date("2026-11-10T00:00:00Z"),
      });
      const overtime = await OvertimeApplication.create({
        userId: target.user._id,
        selectedOvertime: new Date("2026-11-02T00:00:00Z"),
        end: "20:00",
      });

      await expectSameAsMissing(
        "patch",
        {
          hidden: `/api/filing/leave/${leave._id}/status`,
          missing: `/api/filing/leave/${missingId()}/status`,
        },
        token,
        { error: "Leave application not found." },
        { status: "Approved" },
      );
      await expectSameAsMissing(
        "patch",
        {
          hidden: `/api/filing/overtime/${overtime._id}/status`,
          missing: `/api/filing/overtime/${missingId()}/status`,
        },
        token,
        { error: "Overtime request not found." },
        { status: "Disapproved" },
      );

      expect((await LeaveApplication.findById(leave._id)).status).toBe(
        "Pending",
      );
      expect((await OvertimeApplication.findById(overtime._id)).status).toBe(
        "Pending",
      );
      expect(await Attendance.countDocuments({})).toBe(0);
    });

    it("on its 13th month", async () => {
      await expectSameAsMissing(
        "get",
        urlOf((id) => `/api/thirteenth-month/${id}?year=2026`),
        token,
        { message: "Employee not found." },
      );
    });

    it("on approving it while Pending", async () => {
      const pending = await User.create({
        username: "pend",
        password: PASSWORD,
        email: "pend@example.com",
        role: roleName,
        status: "Pending",
      });

      const hiddenRes = await request(app)
        .put(`/api/auth/users/${pending._id}/status`)
        .set(as(token));
      const missingRes = await request(app)
        .put(`/api/auth/users/${missingId()}/status`)
        .set(as(token));
      for (const res of [hiddenRes, missingRes]) {
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "No pending account with that id" });
      }
      expect((await User.findById(pending._id).lean()).status).toBe("Pending");
    });

    it("in Logistics: no projects, and not a member", async () => {
      // Even holding the position, the account can't be seated
      await Settings.updateOne(
        { userId: target.user._id },
        { "general.jobDescription.position": "Project In-charge" },
      );
      await Project.create({
        code: "ACE01",
        name: "Demo Tower",
        location: "Quezon City",
        createdBy: target.user._id,
        inChargeId: target.user._id,
      });

      const projects = await request(app)
        .get("/api/logistics/projects")
        .query({ memberId: String(target.user._id) })
        .set(as(token));
      expect(projects.status).toBe(200);
      expect(projects.body).toEqual([]);

      const add = await request(app)
        .post("/api/logistics/projects")
        .set(as(token))
        .send({
          code: "ACE02",
          name: "Second",
          location: "Pasig",
          inChargeId: String(target.user._id),
          documentControllerIds: [],
        });
      expect(add.status).toBe(400);
      expect(add.body.message).toBe("Person not found.");
      expect(await Project.exists({ code: "ACE02" })).toBeNull();

      // A project it was seated on before shows no In-charge
      const project = await Project.findOne({ code: "ACE01" }).lean();
      const detail = await request(app)
        .get(`/api/logistics/projects/${project._id}`)
        .set(as(token));
      expect(detail.status).toBe(200);
      expect(detail.body.inCharge).toBeNull();
    });
  },
);

describe("lists, pickers and counts leave both admin roles out", () => {
  const seed = async () => {
    const boss = await superAdmin({ position: "Project In-charge" });
    const hr = await plainAdmin({ position: "Project In-charge" });
    const ana = await employee("ana", { position: "Project In-charge" });

    for (const { user } of [boss, hr, ana]) {
      await Attendance.create({
        userId: user._id,
        date: new Date("2026-11-02T00:00:00Z"),
      });
      await LeaveApplication.create({
        userId: user._id,
        leaveType: "Emergency Leave",
        leaveDetails: "Test",
        startDate: new Date("2026-11-10T00:00:00Z"),
        endDate: new Date("2026-11-10T00:00:00Z"),
      });
      await OvertimeApplication.create({
        userId: user._id,
        selectedOvertime: new Date("2026-11-02T00:00:00Z"),
        end: "20:00",
      });
    }
    return { boss, hr, ana };
  };

  it.each([
    ["Super Admin", "boss"],
    ["Admin", "hr"],
  ])("as seen by the %s", async (roleName, who) => {
    const people = await seed();
    const { token } = people[who];
    const anaId = String(people.ana.user._id);

    const employees = await request(app)
      .get("/api/employee/employees?includeResigned=true")
      .set(as(token));
    expect(employees.body.map((row) => String(row._id))).toEqual([anaId]);

    const attendance = await request(app)
      .get("/api/attendance/attendance")
      .set(as(token));
    expect(attendance.status).toBe(200);
    expect(attendance.body.map((row) => String(row.userId))).toEqual([anaId]);

    const byDate = await request(app)
      .get("/api/attendance/attendance?date=2026-11-02")
      .set(as(token));
    expect(byDate.body.map((row) => String(row.userId))).toEqual([anaId]);

    const leaves = await request(app).get("/api/filing").set(as(token));
    expect(leaves.body.map((row) => row.employeeEmail)).toEqual([
      "ana@example.com",
    ]);

    const overtime = await request(app)
      .get("/api/filing/overtime")
      .set(as(token));
    expect(overtime.body.map((row) => row.employeeEmail)).toEqual([
      "ana@example.com",
    ]);

    const thirteenth = await request(app)
      .get("/api/thirteenth-month?year=2026")
      .set(as(token));
    expect(thirteenth.body.rows.map((row) => String(row.userId))).toEqual([
      anaId,
    ]);

    const eligible = await request(app)
      .get("/api/logistics/projects/eligible")
      .query({ position: "Project In-charge" })
      .set(as(token));
    expect(eligible.status).toBe(200);
    expect(eligible.body.map((row) => String(row._id))).toEqual([anaId]);
  });

  it("leaves a Pending admin-role account out of Pending Approvals", async () => {
    const { token } = await superAdmin();
    await person("newbie", { status: "Pending", employeeId: "AC-002" });
    await person("pendhr", {
      role: "Admin",
      status: "Pending",
      employeeId: "ADM-003",
    });

    const res = await request(app)
      .get("/api/auth/pending-users")
      .set(as(token));
    expect(res.status).toBe(200);
    expect(res.body.map((row) => row.email)).toEqual(["newbie@example.com"]);
  });

  it("creates blank attendance only for employees, naming no admin", async () => {
    const { token } = await superAdmin();
    await plainAdmin();
    const ana = await employee();

    const res = await request(app)
      .post("/api/attendance/create-blank.today")
      .set(as(token));
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(1);
    expect(res.body.skippedRecords).toEqual([]);
    const records = await Attendance.find({}).lean();
    expect(records.map((record) => String(record.userId))).toEqual([
      String(ana.user._id),
    ]);
  });
});

describe("an admin-role account still uses its own records", () => {
  it.each([
    ["Super Admin", superAdmin],
    ["Admin", plainAdmin],
  ])("the %s reads its attendance and edits its settings", async (_, make) => {
    const { user, token } = await make();

    const records = await request(app)
      .get(`/api/attendance/${user._id}/records`)
      .set(as(token));
    expect(records.status).toBe(200);

    const own = await request(app)
      .put(`/api/settings/updateGeneralSettings/${user._id}`)
      .set(as(token))
      .send({ employee: { contactNumber: "09171111111" } });
    expect(own.status).toBe(200);
    expect(own.body.employee.contactNumber).toBe("09171111111");
  });

  it("still lets an admin open an employee's profile and attendance", async () => {
    const { token } = await superAdmin();
    const ana = await employee();

    const profile = await request(app)
      .get(`/api/employee/employees/${ana.user._id}`)
      .set(as(token));
    expect(profile.status).toBe(200);
    expect(profile.body.username).toBe("ana");

    const credits = await request(app)
      .get(`/api/filing/leave-credits/${ana.user._id}`)
      .set(as(token));
    expect(credits.status).toBe(200);
  });

  it("keeps refusing an employee on another account (role check first)", async () => {
    const boss = await superAdmin();
    const { token } = await employee();

    const profile = await request(app)
      .get(`/api/employee/employees/${boss.user._id}`)
      .set(as(token));
    expect(profile.status).toBe(403);
    expect(profile.body.message).toBe("Admin access required");

    const attendance = await request(app)
      .get(`/api/attendance/${boss.user._id}/records`)
      .set(as(token));
    expect(attendance.status).toBe(403);
    expect(attendance.body.message).toBe("Access denied");

    const settings = await request(app)
      .put(`/api/settings/updateGeneralSettings/${boss.user._id}`)
      .set(as(token))
      .send({ employee: { contactNumber: "09170000000" } });
    expect(settings.status).toBe(403);
    expect(settings.body.message).toBe("Access denied");
  });
});
