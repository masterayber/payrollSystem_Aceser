// Admin accounts follow their ticks on the server (PR B). Rule 5: every admin API checks
// its screen's page key, not only the role, and the Super Admin passes all of them.
// Rule 15: delete is Super Admin only. Rule 14: an Admin with the Employees tick runs the
// Employees screen without Super Admin approval. Rule 16: an Admin can't act on its own
// linked employee. Rule 17: the approve sign-up reply carries no password hash.
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
const { pagesForRole } = require("../config/pages");

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await User.deleteMany({});
  await Employee.deleteMany({});
  await Settings.deleteMany({});
  await Attendance.deleteMany({});
  await LeaveApplication.deleteMany({});
  await OvertimeApplication.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const PASSWORD = "Password123!";
const DENIED = {
  message: "You do not have access to this page",
  code: "PAGE_ACCESS_DENIED",
};
const OWN_RECORD = {
  message: "You can't act on your own employee record.",
  code: "OWN_EMPLOYEE_RECORD",
};
const ADMIN_PAGE_KEYS = pagesForRole("Admin").map((page) => page.key);

const loginAs = async (username) => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
};

// Creates Auth + Employee + Settings for one person and signs them in (when Active)
const person = async (
  username,
  { role = "Employee", status = "Active", employeeId } = {},
) => {
  const user = await User.create({
    username,
    password: PASSWORD,
    email: `${username}@example.com`,
    role,
    status,
  });
  await Employee.create({
    userId: user._id,
    firstName: username.charAt(0).toUpperCase() + username.slice(1),
    lastName: "Test",
    employeeId: employeeId ?? `EMP-${username}`,
    email: `${username}@example.com`,
    role,
  });
  await Settings.create({
    userId: user._id,
    general: {
      jobDescription: { employmentType: "Probationary", startDate: "2026-01-05" },
    },
  });
  const token = status === "Active" ? await loginAs(username) : null;
  return { user, token };
};

// An Admin account as POST /api/admins makes it (Auth record only, no Employee or
// Settings), with its own password already set
const adminAccount = async (username, pageAccess, extra = {}) => {
  const user = await User.create({
    username,
    password: PASSWORD,
    email: `${username}@example.com`,
    role: "Admin",
    status: "Active",
    firstName: "Rhea",
    lastName: "Cruz",
    pageAccess,
    ...extra,
  });
  return { user, token: await loginAs(username) };
};

const as = (token) => ({ Authorization: `Bearer ${token}` });
const send = (method, url, token, body) => {
  const req = request(app)[method](url).set(as(token));
  return body === undefined ? req : req.send(body);
};
const superAdmin = () =>
  person("admin", { role: "Super Admin", employeeId: "ADM-001" });

const NEW_EMPLOYEE = {
  firstName: "Nina",
  lastName: "Lopez",
  employeeId: "AC-050",
  gender: "Female",
  email: "nina@example.com",
  username: "nina",
  password: "abcdefgh",
  designation: "Staff",
  department: "Admin",
  position: "Clerk",
  employmentType: "Probationary",
  startDate: "2026-02-02",
  timeIn: "08:00",
  timeOut: "17:00",
  basicPay: 20000,
};

// [page key, method, url for the target employee id, body, other ticks the route also
// needs]. Bodies are chosen so a caller who passes the guard gets a validation reply or
// a harmless success.
const GUARDED = (id) => [
  ["employees", "get", `/api/employee/employees/${id}`],
  ["employees", "post", "/api/employee/check-user-exists", { username: "x" }],
  ["employees", "get", "/api/employee/latest-employeeId"],
  ["employees", "patch", `/api/employee/employees/${id}/resign`, {}],
  ["employees", "patch", `/api/employee/employees/${id}/reinstate`, {}],
  ["employees", "post", "/api/employee/add-employee-via-admin", { password: "x" }],
  ["employees", "put", `/api/employee/edit-employee-via-admin/${id}`, { password: "x" }],
  ["employees", "get", "/api/auth/pending-users"],
  ["employees", "put", `/api/auth/users/${id}/status`],
  ["employees", "get", `/api/thirteenth-month/${id}?year=2026`],
  ["employees", "put", `/api/settings/updateGeneralSettings/${id}`, { employee: {} }],
  ["employee-access", "get", "/api/access/pages"],
  ["employee-access", "get", `/api/access/users/${id}`],
  ["employee-access", "put", `/api/access/users/${id}`, { pages: "bad" }],
  ["admin-attendance", "post", "/api/attendance/import-biometric", {}],
  ["admin-attendance", "put", `/api/attendance/edit-attendance/${id}`, {}],
  ["admin-attendance", "post", "/api/attendance/create-blank.today"],
  ["reports", "get", "/api/thirteenth-month?year=2026", undefined, ["thirteenth-month"]],
  ["thirteenth-month", "get", "/api/thirteenth-month?year=2026", undefined, ["reports"]],
  ["admin-filing", "get", "/api/filing"],
  ["admin-filing", "get", "/api/filing/overtime"],
  ["admin-filing", "get", `/api/filing/leave-credits/${id}`],
  ["admin-filing", "patch", `/api/filing/leave/${id}/status`, { status: "Pending" }],
  ["admin-filing", "patch", `/api/filing/overtime/${id}/status`, { status: "Pending" }],
  ["settings-company", "put", "/api/settings/company", {}],
  ["settings-company", "put", "/api/settings/company/logo"],
  ["settings-company", "delete", "/api/settings/company/logo"],
  ["settings-manage", "post", "/api/dropdownOption/departments/add", {}],
  ["settings-manage", "put", "/api/dropdownOption/departments/edit", {}],
  ["settings-manage", "delete", "/api/dropdownOption/departments/delete", {}],
  ["settings-manage", "post", "/api/dropdownOption/positions/Admin/add", {}],
  ["settings-manage", "put", "/api/dropdownOption/positions/Admin/edit", {}],
  ["settings-manage", "delete", "/api/dropdownOption/positions/Admin/delete", {}],
  ["logistics-setup", "post", "/api/dropdownOption/itemCategories/add", {}],
  ["logistics-setup", "put", "/api/dropdownOption/unitsOfMeasure/edit", {}],
  ["logistics-setup", "delete", "/api/dropdownOption/itemCategories/delete", {}],
  ["logistics-setup", "get", "/api/logistics/projects/eligible?position=nope"],
  ["logistics-setup", "post", "/api/logistics/projects", {}],
  ["logistics-setup", "put", `/api/logistics/projects/${id}`, {}],
  ["logistics-setup", "get", "/api/logistics/setup/health"],
  ["logistics-setup", "post", "/api/logistics/setup/seed-reserved"],
];

const guardedCases = GUARDED(":id").map(([key, method, url, body, also = []]) => [
  key,
  method.toUpperCase(),
  url,
  body,
  also,
]);

const passed = (res) => {
  expect(res.status).not.toBe(401);
  expect(res.status).not.toBe(403);
  expect(res.status).toBeLessThan(500);
};

describe("each admin route checks its page key (rule 5)", () => {
  it.each(guardedCases)(
    "%s: %s %s",
    async (key, method, urlTemplate, body, also) => {
      const sa = await superAdmin();
      // ana makes the Employee request; ben is the employee the route acts on
      const ana = await person("ana", { employeeId: "AC-001" });
      const ben = await person("ben", { employeeId: "AC-002" });
      const url = urlTemplate.replace(":id", String(ben.user._id));
      const verb = method.toLowerCase();

      // An Admin with every tick but this one is refused
      const without = await adminAccount(
        "hr.without",
        ADMIN_PAGE_KEYS.filter((k) => k !== key),
      );
      const refused = await send(verb, url, without.token, body);
      expect(refused.status).toBe(403);
      expect(refused.body).toEqual(DENIED);

      // An Admin with only this tick (and any other the route also needs) passes the
      // guard. Ben is on its pay list, so the routes that follow the pay list (PR C)
      // answer as they would for the Super Admin
      const withKey = await adminAccount("hr.with", [key, ...also], {
        payAccess: [ben.user._id],
      });
      passed(await send(verb, url, withKey.token, body));

      // The Super Admin always passes
      passed(await send(verb, url, sa.token, body));

      // An Employee is still refused as before
      const refusedEmployee = await send(verb, url, ana.token, body);
      expect(refusedEmployee.status).toBe(403);
    },
  );

  it("stores nothing when the guard refuses", async () => {
    await superAdmin();
    const ana = await person("ana", { employeeId: "AC-001" });
    const { token } = await adminAccount("hr", ["admin-attendance"]);

    const added = await send(
      "post",
      "/api/employee/add-employee-via-admin",
      token,
      NEW_EMPLOYEE,
    );
    expect(added.status).toBe(403);
    expect(await User.exists({ username: "nina" })).toBeNull();

    const resigned = await send(
      "patch",
      `/api/employee/employees/${ana.user._id}/resign`,
      token,
      { resignationDate: "2026-10-16", resignationReason: "Moving" },
    );
    expect(resigned.status).toBe(403);
    expect((await User.findById(ana.user._id)).status).toBe("Active");

    const company = await send("put", "/api/settings/company", token, {
      name: "Changed",
    });
    expect(company.status).toBe(403);
  });

  it("keeps the read-only lists open to an Admin with no ticks", async () => {
    await superAdmin();
    await person("ana", { employeeId: "AC-001" });
    const { token } = await adminAccount("hr", []);

    for (const url of [
      "/api/employee/employees",
      "/api/dropdownOption",
      "/api/attendance/attendance",
      "/api/settings/company",
      "/api/auth/me",
    ]) {
      const res = await send("get", url, token);
      expect(res.status).toBe(200);
    }
  });

  it("gives an Admin with nothing stored only Dashboard and Settings (rule 4)", async () => {
    const { token } = await adminAccount("hr", undefined);
    const me = await send("get", "/api/auth/me", token);
    expect(me.body.user.allowedPages).toEqual([
      "admin-dashboard",
      "admin-settings",
    ]);
    const res = await send("get", "/api/employee/latest-employeeId", token);
    expect(res.body).toEqual(DENIED);
  });
});

describe("Logistics for an Admin", () => {
  it("opens Logistics, with every-step power, only with a Logistics page ticked", async () => {
    const none = await adminAccount("hr.none", ["employees"]);
    const projects = await send("get", "/api/logistics/projects", none.token);
    expect(projects.status).toBe(403);
    expect(projects.body).toEqual(DENIED);
    const meNone = await send("get", "/api/logistics/me", none.token);
    expect(meNone.body.isAdmin).toBe(false);

    const ticked = await adminAccount("hr.logi", ["logistics-dashboard"]);
    expect(
      (await send("get", "/api/logistics/projects", ticked.token)).status,
    ).toBe(200);
    const me = await send("get", "/api/logistics/me", ticked.token);
    expect(me.body.isAdmin).toBe(true);
    // Setup still needs its own tick
    const setup = await send("get", "/api/logistics/setup/health", ticked.token);
    expect(setup.body).toEqual(DENIED);
  });
});

describe("delete employee is Super Admin only (rule 15)", () => {
  it("refuses an Admin with every tick and deletes nothing", async () => {
    await superAdmin();
    const ana = await person("ana", { employeeId: "AC-001" });
    const { token } = await adminAccount("hr", ADMIN_PAGE_KEYS);

    const res = await send("delete", "/api/employee/delete-employee/AC-001", token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(DENIED);
    expect(await User.exists({ _id: ana.user._id })).not.toBeNull();
    expect(await Employee.exists({ userId: ana.user._id })).not.toBeNull();
  });

  it("refuses an Employee", async () => {
    const ana = await person("ana", { employeeId: "AC-001" });
    const res = await send("delete", "/api/employee/delete-employee/AC-001", ana.token);
    expect(res.status).toBe(403);
    expect(await User.exists({ _id: ana.user._id })).not.toBeNull();
  });

  it("lets the Super Admin delete", async () => {
    const sa = await superAdmin();
    const ana = await person("ana", { employeeId: "AC-001" });
    const res = await send("delete", "/api/employee/delete-employee/AC-001", sa.token);
    expect(res.status).toBe(200);
    expect(await User.exists({ _id: ana.user._id })).toBeNull();
  });
});

describe("an Admin with the Employees tick runs the Employees screen (rule 14)", () => {
  it("adds, approves, edits, resigns and reinstates without Super Admin approval", async () => {
    await superAdmin();
    const { token } = await adminAccount("hr", ["employees"]);

    const added = await send(
      "post",
      "/api/employee/add-employee-via-admin",
      token,
      NEW_EMPLOYEE,
    );
    expect(added.status).toBe(201);
    const nina = await User.findOne({ username: "nina" }).lean();
    expect(nina.role).toBe("Employee");
    expect(nina.status).toBe("Active");

    const pending = await person("pia", { status: "Pending" });
    const approved = await send(
      "put",
      `/api/auth/users/${pending.user._id}/status`,
      token,
    );
    expect(approved.status).toBe(200);
    expect((await User.findById(pending.user._id)).status).toBe("Active");

    const edited = await send(
      "put",
      `/api/employee/edit-employee-via-admin/${nina._id}`,
      token,
      { contactNumber: "0917 000 0000" },
    );
    expect(edited.status).toBe(200);

    const resigned = await send(
      "patch",
      `/api/employee/employees/${nina._id}/resign`,
      token,
      { resignationDate: "2026-10-16", resignationReason: "Moving" },
    );
    expect(resigned.status).toBe(200);

    const reinstated = await send(
      "patch",
      `/api/employee/employees/${nina._id}/reinstate`,
      token,
    );
    expect(reinstated.status).toBe(200);
    expect((await User.findById(nina._id)).status).toBe("Active");
  });
});

describe("the approve sign-up reply (rule 17)", () => {
  it("carries no password hash and no reset token", async () => {
    const sa = await superAdmin();
    const pending = await person("pia", { status: "Pending" });
    await User.updateOne({ _id: pending.user._id }, { resetToken: "secret" });

    const res = await send("put", `/api/auth/users/${pending.user._id}/status`, sa.token);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("User approved successfully");
    expect(res.body.user.status).toBe("Active");
    expect(res.body.user.username).toBe("pia");
    expect(res.body.user).not.toHaveProperty("password");
    expect(res.body.user).not.toHaveProperty("resetToken");
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
  });
});

describe("an Admin can't act on its own linked employee (rule 16)", () => {
  const setup = async () => {
    const sa = await superAdmin();
    const own = await person("ana", { employeeId: "AC-001" });
    const other = await person("ben", { employeeId: "AC-002" });
    const hr = await adminAccount("hr", ADMIN_PAGE_KEYS, {
      linkedEmployeeId: own.user._id,
    });
    return { sa, own, other, hr };
  };

  const ACTIONS = (id) => [
    ["put", `/api/employee/edit-employee-via-admin/${id}`, { contactNumber: "1" }],
    [
      "patch",
      `/api/employee/employees/${id}/resign`,
      { resignationDate: "2026-10-16", resignationReason: "Moving" },
    ],
    ["patch", `/api/employee/employees/${id}/reinstate`],
    ["put", `/api/access/users/${id}`, { pages: ["dashboard"] }],
    ["put", `/api/auth/users/${id}/status`],
    [
      "put",
      `/api/settings/updateGeneralSettings/${id}`,
      { employee: { contactNumber: "1" } },
    ],
    [
      "put",
      `/api/attendance/edit-attendance/${id}`,
      { date: "2026-11-03", timeIn: "08:00:00" },
    ],
  ];

  it("refuses every action on the linked employee and saves nothing", async () => {
    const { own, hr } = await setup();
    for (const [method, url, body] of ACTIONS(own.user._id)) {
      const res = await send(method, url, hr.token, body);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(OWN_RECORD);
    }
    const stored = await User.findById(own.user._id).lean();
    expect(stored.status).toBe("Active");
    expect(stored.pageAccess).toBeUndefined();
    const record = await Employee.findOne({ userId: own.user._id }).lean();
    expect(record.contactNumber).not.toBe("1");
    expect(await Attendance.exists({ userId: own.user._id })).toBeNull();
  });

  it("refuses approving the linked employee's own sign-up", async () => {
    await superAdmin();
    const pending = await person("pia", { status: "Pending" });
    const hr = await adminAccount("hr", ["employees"], {
      linkedEmployeeId: pending.user._id,
    });
    const res = await send("put", `/api/auth/users/${pending.user._id}/status`, hr.token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(OWN_RECORD);
    expect((await User.findById(pending.user._id)).status).toBe("Pending");
  });

  it("still lets the Admin act on anyone else", async () => {
    const { other, hr } = await setup();
    const edited = await send(
      "put",
      `/api/employee/edit-employee-via-admin/${other.user._id}`,
      hr.token,
      { contactNumber: "1" },
    );
    expect(edited.status).toBe(200);
    const access = await send(
      "put",
      `/api/access/users/${other.user._id}`,
      hr.token,
      { pages: ["dashboard"] },
    );
    expect(access.status).toBe(200);
  });

  it("lets the Admin read its linked employee's profile", async () => {
    const { own, hr } = await setup();
    const res = await send("get", `/api/employee/employees/${own.user._id}`, hr.token);
    expect(res.status).toBe(200);
  });

  it("never stops the Super Admin", async () => {
    const { sa, own } = await setup();
    const res = await send(
      "put",
      `/api/employee/edit-employee-via-admin/${own.user._id}`,
      sa.token,
      { contactNumber: "1" },
    );
    expect(res.status).toBe(200);
  });
});

// Rule 16 on Filing: an Admin can't approve or disapprove a leave or overtime request
// filed by its own linked employee. The refusal uses Filing's { error } shape.
describe("an Admin can't decide its own linked employee's filings (rule 16)", () => {
  const FILING_OWN_RECORD = {
    error: "You can't act on your own employee record.",
    code: "OWN_EMPLOYEE_RECORD",
  };

  const setup = async () => {
    const sa = await superAdmin();
    const own = await person("ana", { employeeId: "AC-001" });
    const other = await person("ben", { employeeId: "AC-002" });
    const hr = await adminAccount("hr", ["admin-filing"], {
      linkedEmployeeId: own.user._id,
    });
    return { sa, own, other, hr };
  };

  const fileLeave = (userId) =>
    LeaveApplication.create({
      userId,
      leaveType: "Emergency Leave",
      leaveDetails: "Family",
      startDate: "2026-11-02",
      endDate: "2026-11-03",
    });

  const fileOvertime = (userId) =>
    OvertimeApplication.create({
      userId,
      selectedOvertime: "2026-11-02",
      end: "20:00",
      overtimeDetails: "Month-end",
    });

  const decide = (kind, id, token, status) =>
    send("patch", `/api/filing/${kind}/${id}/status`, token, { status });

  it.each(["Approved", "Disapproved"])(
    "refuses to set a linked employee's leave to %s; nothing saved",
    async (status) => {
      const { own, hr } = await setup();
      const leave = await fileLeave(own.user._id);

      const res = await decide("leave", leave._id, hr.token, status);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(FILING_OWN_RECORD);
      expect((await LeaveApplication.findById(leave._id)).status).toBe(
        "Pending",
      );
      expect(await Attendance.exists({ userId: own.user._id })).toBeNull();
    },
  );

  it.each(["Approved", "Disapproved"])(
    "refuses to set a linked employee's overtime to %s; nothing saved",
    async (status) => {
      const { own, hr } = await setup();
      const overtime = await fileOvertime(own.user._id);

      const res = await decide("overtime", overtime._id, hr.token, status);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(FILING_OWN_RECORD);
      expect((await OvertimeApplication.findById(overtime._id)).status).toBe(
        "Pending",
      );
    },
  );

  it("lets the same Admin decide anyone else's leave and overtime", async () => {
    const { other, hr } = await setup();
    const leave = await fileLeave(other.user._id);
    const overtime = await fileOvertime(other.user._id);

    const leaveRes = await decide("leave", leave._id, hr.token, "Disapproved");
    expect(leaveRes.status).toBe(200);
    expect((await LeaveApplication.findById(leave._id)).status).toBe(
      "Disapproved",
    );

    const otRes = await decide("overtime", overtime._id, hr.token, "Approved");
    expect(otRes.status).toBe(200);
    expect((await OvertimeApplication.findById(overtime._id)).status).toBe(
      "Approved",
    );
  });

  it("never stops the Super Admin", async () => {
    const { sa, own } = await setup();
    const leave = await fileLeave(own.user._id);
    const overtime = await fileOvertime(own.user._id);
    expect(
      (await decide("leave", leave._id, sa.token, "Disapproved")).status,
    ).toBe(200);
    expect(
      (await decide("overtime", overtime._id, sa.token, "Disapproved")).status,
    ).toBe(200);
  });
});
