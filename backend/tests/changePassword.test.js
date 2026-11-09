// Forced password change and the password rule (PR A): the block in loadCurrentUser,
// POST /api/auth/change-password, the flag in login and /me, and the rule (at least 8
// characters, every account) on sign-up, change password, Forgot password reset, Add
// Employee and Edit Employee. The flag is set true only when an admin or the Super Admin
// sets someone else's password (Add Employee, Edit Employee with a password); the
// person's own change, a Forgot password reset and sign-up leave or make it false.
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await User.deleteMany({});
  await Employee.deleteMany({});
  await Settings.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const PASSWORD = "Password123!";
// 7 characters (refused) and 8 characters (accepted)
const SEVEN = "abcdefg";
const EIGHT = "abcdefgh";
const TOO_SHORT = "New password must be at least 8 characters.";
const REQUIRED = "New password is required.";
const PLAIN_TOO_SHORT = "Password must be at least 8 characters.";
const PLAIN_REQUIRED = "Password is required.";
const BLOCKED = {
  message: "Please change your password before continuing.",
  code: "PASSWORD_CHANGE_REQUIRED",
};
const INACTIVE = { message: "Account is not active", code: "ACCOUNT_INACTIVE" };
const ROLE_CHANGED = {
  message: "Your role has changed. Please sign in again.",
  code: "ROLE_CHANGED",
};

const ME = "/api/auth/me";
const CHANGE = "/api/auth/change-password";
// requirePage("filing"): an Employee page, open by default
const EMPLOYEE_ROUTE = "/api/filing/user-leave-requests";
// requireAdmin
const ADMIN_ROUTE = "/api/employee/employees";
// requireAnyLogisticsPage, from middleware/logisticsAccess.js
const LOGISTICS_ROUTE = "/api/logistics/projects";

const login = (username, password = PASSWORD) =>
  request(app).post("/api/auth/login").send({ username, password });

const loginAs = async (username, password = PASSWORD) => {
  const res = await login(username, password);
  expect(res.status).toBe(200);
  return res.body.token;
};

// Creates Auth + Employee + Settings for one person and signs them in
const person = async (
  username,
  { role = "Employee", password = PASSWORD, ...auth } = {},
) => {
  const user = await User.create({
    username,
    password,
    email: `${username}@example.com`,
    role,
    status: "Active",
    ...auth,
  });
  await Employee.create({
    userId: user._id,
    firstName: username.charAt(0).toUpperCase() + username.slice(1),
    lastName: "Test",
    employeeId: `EMP-${username}`,
    email: `${username}@example.com`,
    role,
  });
  await Settings.create({
    userId: user._id,
    general: { jobDescription: { employmentType: "Regular" } },
  });
  return { user, token: await loginAs(username, password) };
};

const as = (token) => ({ Authorization: `Bearer ${token}` });
const get = (url, token) => request(app).get(url).set(as(token));
const change = (token, body) => request(app).post(CHANGE).set(as(token)).send(body);
const setFlag = (user, value = true) =>
  User.updateOne({ _id: user._id }, { mustChangePassword: value });

const passwordMatches = async (userId, plain) => {
  const stored = await User.findById(userId).lean();
  return bcrypt.compare(plain, stored.password);
};

// The same token POST /api/auth/otp signs after a correct code
const resetTokenFor = (email) =>
  jwt.sign({ email, purpose: "reset" }, process.env.JWT_SECRET, {
    expiresIn: "5m",
  });
const reset = (email, password) =>
  request(app)
    .post("/api/auth/reset-password")
    .send({ resetToken: resetTokenFor(email), password });

const newEmployeeBody = (overrides = {}) => ({
  firstName: "Rico",
  lastName: "Test",
  employeeId: "AC-001",
  email: "rico@example.com",
  username: "rico",
  password: "Rico2026x",
  employmentType: "Probationary",
  startDate: "2026-11-02",
  ...overrides,
});
const addEmployee = (token, body) =>
  request(app)
    .post("/api/employee/add-employee-via-admin")
    .set(as(token))
    .send(body);

describe("The block while mustChangePassword is set", () => {
  it("refuses ordinary routes with 403 PASSWORD_CHANGE_REQUIRED", async () => {
    const { user, token } = await person("ana");
    await setFlag(user);

    for (const url of [EMPLOYEE_ROUTE, LOGISTICS_ROUTE, "/api/protected"]) {
      const res = await get(url, token);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(BLOCKED);
    }
  });

  it("refuses admin routes for an admin account too", async () => {
    const { user, token } = await person("boss", { role: "Super Admin" });
    await setFlag(user);

    const res = await get(ADMIN_ROUTE, token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual(BLOCKED);
  });

  it("lets /me and change-password through", async () => {
    const { user, token } = await person("ana");
    await setFlag(user);

    const me = await get(ME, token);
    expect(me.status).toBe(200);
    expect(me.body.user.mustChangePassword).toBe(true);

    const res = await change(token, {
      currentPassword: PASSWORD,
      newPassword: "Another1",
    });
    expect(res.status).toBe(200);
  });

  it("does not block when the flag is false", async () => {
    const { token } = await person("ana");
    expect((await get(EMPLOYEE_ROUTE, token)).status).toBe(200);
    expect((await get("/api/protected", token)).status).toBe(200);
  });
});

describe("Order of the checks in loadCurrentUser", () => {
  it("answers ACCOUNT_INACTIVE for an Inactive account with the flag", async () => {
    const { user, token } = await person("ana");
    await User.updateOne(
      { _id: user._id },
      { status: "Inactive", mustChangePassword: true },
    );

    for (const url of [ME, EMPLOYEE_ROUTE]) {
      const res = await get(url, token);
      expect(res.status).toBe(401);
      expect(res.body).toEqual(INACTIVE);
    }
    const res = await change(token, {
      currentPassword: PASSWORD,
      newPassword: "Another1",
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual(INACTIVE);
  });

  it("answers ROLE_CHANGED for a changed role with the flag", async () => {
    const { user, token } = await person("ana");
    await User.updateOne(
      { _id: user._id },
      { role: "Admin", mustChangePassword: true },
    );

    for (const url of [ME, EMPLOYEE_ROUTE]) {
      const res = await get(url, token);
      expect(res.status).toBe(401);
      expect(res.body).toEqual(ROLE_CHANGED);
    }
  });

  it("signs out a resigned employee who is still signed in", async () => {
    const { user, token } = await person("ana");
    await User.updateOne({ _id: user._id }, { status: "Resigned" });

    for (const url of [ME, EMPLOYEE_ROUTE]) {
      const res = await get(url, token);
      expect(res.status).toBe(401);
      expect(res.body).toEqual(INACTIVE);
    }
  });

  it("answers ACCOUNT_INACTIVE for a deleted account", async () => {
    const { user, token } = await person("ana");
    await User.deleteOne({ _id: user._id });

    const res = await get(ME, token);
    expect(res.status).toBe(401);
    expect(res.body).toEqual(INACTIVE);
  });
});

describe("POST /api/auth/change-password refusals", () => {
  it("needs both passwords as filled strings", async () => {
    const { token } = await person("ana");
    for (const body of [
      {},
      { currentPassword: PASSWORD },
      { newPassword: "Another1" },
      { currentPassword: "  ", newPassword: "Another1" },
      { currentPassword: PASSWORD, newPassword: "" },
      { currentPassword: PASSWORD, newPassword: "        " },
      { currentPassword: PASSWORD, newPassword: 12345678 },
    ]) {
      const res = await change(token, body);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Current and new password are required.");
    }
    expect(await passwordMatches((await User.findOne()).id, PASSWORD)).toBe(
      true,
    );
  });

  it("refuses a wrong current password and saves nothing", async () => {
    const { user, token } = await person("ana");
    await setFlag(user);

    const res = await change(token, {
      currentPassword: "Wrong123!",
      newPassword: "Another1",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Current password is incorrect.");
    expect(await passwordMatches(user._id, PASSWORD)).toBe(true);
    expect((await User.findById(user._id)).mustChangePassword).toBe(true);
  });

  it("checks the current password before the length", async () => {
    const { token } = await person("ana");
    const res = await change(token, {
      currentPassword: "Wrong123!",
      newPassword: SEVEN,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Current password is incorrect.");
  });

  it("refuses the same password as the current one", async () => {
    const { user, token } = await person("ana");
    const res = await change(token, {
      currentPassword: PASSWORD,
      newPassword: PASSWORD,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "New password must be different from the current one.",
    );
    expect((await User.findById(user._id).lean()).updatedAt).toBeNull();
  });

  it("checks the length before 'same as current'", async () => {
    // An older account whose current password is already too short
    const { token } = await person("ana", { password: "abc" });
    const res = await change(token, {
      currentPassword: "abc",
      newPassword: "abc",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(TOO_SHORT);
  });

  it("refuses 7 characters for every account and saves nothing", async () => {
    for (const role of ["Employee", "Admin", "Super Admin"]) {
      const username = `u${role.replace(" ", "").toLowerCase()}`;
      const { user, token } = await person(username, {
        role,
        password: "Temp1234",
        mustChangePassword: true,
      });

      const res = await change(token, {
        currentPassword: "Temp1234",
        newPassword: SEVEN,
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(TOO_SHORT);
      expect(await passwordMatches(user._id, "Temp1234")).toBe(true);
      expect((await User.findById(user._id)).mustChangePassword).toBe(true);
    }
  });
});

describe("POST /api/auth/change-password success", () => {
  it("accepts 8 characters with no letter or number rule", async () => {
    const { user, token } = await person("ana");
    const res = await change(token, {
      currentPassword: PASSWORD,
      newPassword: EIGHT,
    });
    expect(res.status).toBe(200);
    expect(await passwordMatches(user._id, EIGHT)).toBe(true);

    const again = await loginAs("ana", EIGHT);
    const digits = await change(again, {
      currentPassword: EIGHT,
      newPassword: "12345678",
    });
    expect(digits.status).toBe(200);
  });

  it("clears the flag, swaps the password, and keeps the same token working", async () => {
    const { user, token } = await person("rhea", {
      password: "Temp1234",
      mustChangePassword: true,
    });
    expect((await get(EMPLOYEE_ROUTE, token)).status).toBe(403);

    const res = await change(token, {
      currentPassword: "Temp1234",
      newPassword: "Rhea2026x",
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: "Password changed.",
      mustChangePassword: false,
    });

    const stored = await User.findById(user._id).lean();
    expect(stored.mustChangePassword).toBe(false);
    expect(stored).not.toHaveProperty("createdBySuperAdmin");
    expect(stored.updatedAt).toBeInstanceOf(Date);
    // Stored hashed, never in plain text
    expect(stored.password).not.toBe("Rhea2026x");

    // Same token, blocked route now open
    expect((await get(EMPLOYEE_ROUTE, token)).status).toBe(200);
    expect((await get(ME, token)).body.user.mustChangePassword).toBe(false);

    expect((await login("rhea", "Rhea2026x")).status).toBe(200);
    expect((await login("rhea", "Temp1234")).status).toBe(401);
  });

  it("works for an account without the flag (Settings > General)", async () => {
    const { token } = await person("ana");
    const res = await change(token, {
      currentPassword: PASSWORD,
      newPassword: "Another1",
    });
    expect(res.status).toBe(200);
    expect((await login("ana", "Another1")).status).toBe(200);
  });

  it("does not store createdBySuperAdmin sent in the body", async () => {
    const { user, token } = await person("ana");
    const res = await change(token, {
      currentPassword: PASSWORD,
      newPassword: "Another1",
      createdBySuperAdmin: true,
    });
    expect(res.status).toBe(200);
    const raw = await User.collection.findOne({ _id: user._id });
    expect(raw).not.toHaveProperty("createdBySuperAdmin");
  });

  it("needs a signed-in account", async () => {
    const res = await request(app)
      .post(CHANGE)
      .send({ currentPassword: PASSWORD, newPassword: "Another1" });
    expect(res.status).toBe(401);
  });
});

describe("Login", () => {
  it("returns a token and mustChangePassword true while the flag is set", async () => {
    await person("rhea", { password: "Temp1234", mustChangePassword: true });

    const res = await login("rhea", "Temp1234");
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.mustChangePassword).toBe(true);
    expect(res.body.user).not.toHaveProperty("createdBySuperAdmin");
    expect(res.body.user.password).toBeUndefined();
  });

  it("still signs in with an existing password shorter than 8 characters", async () => {
    // Set before the rule existed; login does not check the rule
    const { token } = await person("ana", { password: "abc" });
    expect(typeof token).toBe("string");
    expect((await get(EMPLOYEE_ROUTE, token)).status).toBe(200);
    expect((await get(ME, token)).status).toBe(200);
  });

  it("refuses an Inactive account with 'This account is disabled.'", async () => {
    const { user } = await person("ana");
    await User.updateOne({ _id: user._id }, { status: "Inactive" });

    const res = await login("ana");
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("This account is disabled.");
  });

  it("keeps the Pending and Resigned messages", async () => {
    const { user } = await person("ana");
    await User.updateOne({ _id: user._id }, { status: "Pending" });
    expect((await login("ana")).body.message).toBe(
      "Account is pending approval.",
    );

    await User.updateOne({ _id: user._id }, { status: "Resigned" });
    expect((await login("ana")).body.message).toBe(
      "This account is no longer active.",
    );
  });
});

describe("Accounts created before PR A, or stored with the retired mark", () => {
  const insertRaw = async (username, extra = {}) => {
    const { insertedId } = await User.collection.insertOne({
      username,
      password: await bcrypt.hash(PASSWORD, 10),
      email: `${username}@example.com`,
      role: "Employee",
      status: "Active",
      createdAt: new Date(),
      ...extra,
    });
    return insertedId;
  };

  it("get mustChangePassword false in login and /me", async () => {
    // Stored without the field, as every existing account is
    const insertedId = await insertRaw("old");
    const raw = await User.collection.findOne({ _id: insertedId });
    expect(raw.mustChangePassword).toBeUndefined();

    const res = await login("old");
    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(false);

    const me = await get(ME, res.body.token);
    expect(me.status).toBe(200);
    expect(me.body.user.mustChangePassword).toBe(false);

    // And nothing is blocked
    expect((await get(EMPLOYEE_ROUTE, res.body.token)).status).toBe(200);
  });

  it("never send a stored createdBySuperAdmin back in login or /me", async () => {
    for (const [username, mark] of [
      ["marked", true],
      ["unmarked", false],
    ]) {
      await insertRaw(username, { createdBySuperAdmin: mark });

      const res = await login(username);
      expect(res.status).toBe(200);
      expect(res.body.user).not.toHaveProperty("createdBySuperAdmin");
      expect(res.body.user.username).toBe(username);

      const me = await get(ME, res.body.token);
      expect(me.status).toBe(200);
      expect(me.body.user).not.toHaveProperty("createdBySuperAdmin");
      expect(me.body.user.password).toBeUndefined();
    }
  });

  it("follow the same rule as every account (the stored mark is ignored)", async () => {
    await insertRaw("marked", { createdBySuperAdmin: true });
    const token = await loginAs("marked");

    const res = await change(token, {
      currentPassword: PASSWORD,
      newPassword: "abcdefgh",
    });
    expect(res.status).toBe(200);
  });
});

describe("Forgot password reset (POST /api/auth/reset-password)", () => {
  it("refuses 7 characters for every account; saves nothing", async () => {
    const { user } = await person("rhea", {
      password: "Temp1234",
      mustChangePassword: true,
    });
    const boss = await person("boss", { role: "Super Admin" });

    for (const email of ["rhea@example.com", "boss@example.com"]) {
      const res = await reset(email, SEVEN);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(TOO_SHORT);
    }
    expect(await passwordMatches(user._id, "Temp1234")).toBe(true);
    expect(await passwordMatches(boss.user._id, PASSWORD)).toBe(true);
    expect((await User.findById(user._id)).mustChangePassword).toBe(true);
  });

  it("refuses a blank or spaces-only password as required", async () => {
    const { user } = await person("ana");
    for (const password of ["", "        ", undefined]) {
      const res = await reset("ana@example.com", password);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(REQUIRED);
    }
    expect(await passwordMatches(user._id, PASSWORD)).toBe(true);
  });

  it("accepts 8 characters and clears the flag", async () => {
    const { user } = await person("rhea", {
      password: "Temp1234",
      mustChangePassword: true,
    });

    const res = await reset("rhea@example.com", EIGHT);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      "Password has been reset successfully. Please log in with your new password.",
    );
    const stored = await User.findById(user._id).lean();
    expect(stored.mustChangePassword).toBe(false);

    const again = await login("rhea", EIGHT);
    expect(again.status).toBe(200);
    expect(again.body.user.mustChangePassword).toBe(false);
    expect((await get(EMPLOYEE_ROUTE, again.body.token)).status).toBe(200);
  });

  it("never sets the flag on an account without it", async () => {
    const { user } = await person("ana");
    expect((await reset("ana@example.com", EIGHT)).status).toBe(200);
    expect((await User.findById(user._id).lean()).mustChangePassword).toBe(
      false,
    );
  });

  it("allows the same password as before (no 'different' check)", async () => {
    await person("ana");
    expect((await reset("ana@example.com", PASSWORD)).status).toBe(200);
  });

  it("still refuses a missing reset token first", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ password: SEVEN });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Reset token is required");
  });
});

describe("Self sign-up (POST /api/auth/signup)", () => {
  const signup = (overrides = {}) =>
    request(app)
      .post("/api/auth/signup")
      .send({
        firstName: "Sol",
        lastName: "Test",
        email: "sol@example.com",
        username: "sol",
        password: EIGHT,
        ...overrides,
      });

  it("refuses 7 characters and creates nothing", async () => {
    const res = await signup({ password: SEVEN });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(PLAIN_TOO_SHORT);
    expect(await User.findOne({ username: "sol" })).toBeNull();
    expect(await Employee.findOne({ email: "sol@example.com" })).toBeNull();
    expect(await Settings.countDocuments()).toBe(0);
  });

  it("refuses a blank or spaces-only password as required", async () => {
    for (const password of ["", "        ", undefined]) {
      const res = await signup({ password });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(PLAIN_REQUIRED);
    }
    expect(await User.countDocuments()).toBe(0);
  });

  it("checks the password before the email", async () => {
    await person("ana");
    const res = await signup({ email: "ana@example.com", password: SEVEN });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(PLAIN_TOO_SHORT);
  });

  it("accepts 8 characters", async () => {
    const res = await signup();
    expect(res.status).toBe(200);
    const sol = await User.findOne({ username: "sol" });
    expect(await bcrypt.compare(EIGHT, sol.password)).toBe(true);
    // The person chose their own password: never forced to change it
    expect(sol.mustChangePassword).toBe(false);
  });

  it("stores neither createdBySuperAdmin nor mustChangePassword from the body", async () => {
    const res = await signup({
      createdBySuperAdmin: true,
      mustChangePassword: true,
    });
    expect(res.status).toBe(200);
    const sol = await User.collection.findOne({ username: "sol" });
    expect(sol).not.toHaveProperty("createdBySuperAdmin");
    expect(sol.mustChangePassword).toBe(false);
  });
});

describe("Add Employee (POST /api/employee/add-employee-via-admin)", () => {
  it("refuses 7 characters from an Admin and a Super Admin; nothing created", async () => {
    const hr = await person("hr", { role: "Admin", pageAccess: ["employees"] });
    const boss = await person("boss", { role: "Super Admin" });

    for (const token of [hr.token, boss.token]) {
      const res = await addEmployee(token, newEmployeeBody({ password: SEVEN }));
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(PLAIN_TOO_SHORT);
    }
    expect(await User.findOne({ username: "rico" })).toBeNull();
    expect(await Employee.findOne({ employeeId: "AC-001" })).toBeNull();
  });

  it("refuses a blank, spaces-only or missing password as required", async () => {
    const { token } = await person("hr", { role: "Admin", pageAccess: ["employees"] });
    for (const password of ["", "        ", undefined]) {
      const res = await addEmployee(token, newEmployeeBody({ password }));
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(PLAIN_REQUIRED);
    }
    expect(await User.findOne({ username: "rico" })).toBeNull();
  });

  it("accepts 8 characters from an Admin and from a Super Admin", async () => {
    const hr = await person("hr", { role: "Admin", pageAccess: ["employees"] });
    const boss = await person("boss", { role: "Super Admin" });

    const fromAdmin = await addEmployee(
      hr.token,
      newEmployeeBody({ password: EIGHT }),
    );
    expect(fromAdmin.status).toBe(201);
    expect((await login("rico", EIGHT)).status).toBe(200);

    const fromBoss = await addEmployee(
      boss.token,
      newEmployeeBody({
        employeeId: "AC-002",
        username: "sol",
        email: "sol@example.com",
        password: EIGHT,
      }),
    );
    expect(fromBoss.status).toBe(201);
    expect((await login("sol", EIGHT)).status).toBe(200);
  });

  it("sets mustChangePassword true on the new account, from an Admin and a Super Admin", async () => {
    const hr = await person("hr", { role: "Admin", pageAccess: ["employees"] });
    const boss = await person("boss", { role: "Super Admin" });

    expect((await addEmployee(hr.token, newEmployeeBody())).status).toBe(201);
    expect(
      (
        await addEmployee(
          boss.token,
          newEmployeeBody({
            employeeId: "AC-002",
            username: "sol",
            email: "sol@example.com",
          }),
        )
      ).status,
    ).toBe(201);

    for (const username of ["rico", "sol"]) {
      const raw = await User.collection.findOne({ username });
      expect(raw.mustChangePassword).toBe(true);
    }
  });

  it("forces the change at first sign-in until the employee sets their own", async () => {
    const { token } = await person("hr", { role: "Admin", pageAccess: ["employees"] });
    const res = await addEmployee(token, newEmployeeBody());
    expect(res.status).toBe(201);
    expect(res.body.user.mustChangePassword).toBe(true);

    const first = await login("rico", "Rico2026x");
    expect(first.status).toBe(200);
    expect(first.body.user.mustChangePassword).toBe(true);
    const blocked = await get(EMPLOYEE_ROUTE, first.body.token);
    expect(blocked.status).toBe(403);
    expect(blocked.body).toEqual(BLOCKED);

    const changed = await change(first.body.token, {
      currentPassword: "Rico2026x",
      newPassword: "Rico2027x",
    });
    expect(changed.status).toBe(200);
    expect(
      (await User.collection.findOne({ username: "rico" })).mustChangePassword,
    ).toBe(false);
    expect((await get(EMPLOYEE_ROUTE, first.body.token)).status).toBe(200);
  });

  it("takes neither createdBySuperAdmin nor mustChangePassword from the body", async () => {
    const { token } = await person("boss", { role: "Super Admin" });
    // A body asking for no forced change is ignored: the rule sets it
    const res = await addEmployee(
      token,
      newEmployeeBody({ createdBySuperAdmin: true, mustChangePassword: false }),
    );
    expect(res.status).toBe(201);
    expect(res.body.user).not.toHaveProperty("createdBySuperAdmin");

    const rico = await User.collection.findOne({ username: "rico" });
    expect(rico).not.toHaveProperty("createdBySuperAdmin");
    expect(rico.mustChangePassword).toBe(true);
  });

  it("still refuses an Employee caller", async () => {
    const { token } = await person("ana");
    const res = await addEmployee(token, newEmployeeBody());
    expect(res.status).toBe(403);
    expect(await User.findOne({ username: "rico" })).toBeNull();
  });
});

describe("A password reset through Edit Employee", () => {
  const edit = (token, id, body) =>
    request(app)
      .put(`/api/employee/edit-employee-via-admin/${id}`)
      .set(as(token))
      .send(body);

  it("refuses 7 characters, whoever edits; nothing saved", async () => {
    const boss = await person("boss", { role: "Super Admin" });
    const hr = await person("hr", { role: "Admin", pageAccess: ["employees"] });
    const { user } = await person("rhea", { password: "Temp1234" });

    for (const token of [boss.token, hr.token]) {
      const res = await edit(token, user._id, {
        username: "renamed",
        firstName: "Changed",
        password: SEVEN,
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(PLAIN_TOO_SHORT);
    }
    const stored = await User.findById(user._id).lean();
    expect(stored.username).toBe("rhea");
    expect(await bcrypt.compare("Temp1234", stored.password)).toBe(true);
    expect((await Employee.findOne({ userId: user._id })).firstName).toBe(
      "Rhea",
    );
  });

  it("accepts 8 characters and sets the flag, from an Admin and a Super Admin", async () => {
    const hr = await person("hr", { role: "Admin", pageAccess: ["employees"] });
    const boss = await person("boss", { role: "Super Admin" });
    const rhea = await person("rhea", { password: "Temp1234" });
    const ana = await person("ana");

    for (const [token, target] of [
      [hr.token, rhea],
      [boss.token, ana],
    ]) {
      const res = await edit(token, target.user._id, { password: EIGHT });
      expect(res.status).toBe(200);
      const stored = await User.findById(target.user._id).lean();
      expect(await bcrypt.compare(EIGHT, stored.password)).toBe(true);
      expect(stored.mustChangePassword).toBe(true);
    }

    // The employee's own session is now blocked until they set their own
    const blocked = await get(EMPLOYEE_ROUTE, rhea.token);
    expect(blocked.status).toBe(403);
    expect(blocked.body).toEqual(BLOCKED);
    const again = await login("rhea", EIGHT);
    expect(again.body.user.mustChangePassword).toBe(true);
  });

  it("keeps the flag true on an account that already had it", async () => {
    const hr = await person("hr", { role: "Admin", pageAccess: ["employees"] });
    const { user } = await person("rhea", {
      password: "Temp1234",
      mustChangePassword: true,
    });

    const res = await edit(hr.token, user._id, { password: EIGHT });
    expect(res.status).toBe(200);
    expect((await User.findById(user._id).lean()).mustChangePassword).toBe(
      true,
    );
  });

  it("takes no mustChangePassword from the body, with or without a password", async () => {
    const hr = await person("hr", { role: "Admin", pageAccess: ["employees"] });
    const ana = await person("ana");
    const rhea = await person("rhea", { mustChangePassword: true });

    // With a password: the rule sets true, whatever the body says
    let res = await edit(hr.token, ana.user._id, {
      password: EIGHT,
      mustChangePassword: false,
    });
    expect(res.status).toBe(200);
    expect((await User.findById(ana.user._id).lean()).mustChangePassword).toBe(
      true,
    );

    // Without a password: the body changes nothing either way
    await setFlag(ana.user, false);
    res = await edit(hr.token, ana.user._id, {
      firstName: "Ana",
      mustChangePassword: true,
    });
    expect(res.status).toBe(200);
    expect((await User.findById(ana.user._id).lean()).mustChangePassword).toBe(
      false,
    );

    res = await edit(hr.token, rhea.user._id, {
      firstName: "Rhea",
      mustChangePassword: false,
    });
    expect(res.status).toBe(200);
    expect(
      (await User.findById(rhea.user._id).lean()).mustChangePassword,
    ).toBe(true);
  });

  it("leaves the flag unchanged on an edit without a password", async () => {
    const boss = await person("boss", { role: "Super Admin" });
    const ana = await person("ana");
    const rhea = await person("rhea", { mustChangePassword: true });

    for (const [target, expected] of [
      [ana, false],
      [rhea, true],
    ]) {
      for (const body of [
        { firstName: "Changed", password: "" },
        { firstName: "Changed", password: "   " },
        { firstName: "Changed", username: target.user.username },
      ]) {
        const res = await edit(boss.token, target.user._id, body);
        expect(res.status).toBe(200);
        expect(
          (await User.findById(target.user._id).lean()).mustChangePassword,
        ).toBe(expected);
      }
    }
  });

  it("cannot reach an admin's own account, so an admin never forces themselves", async () => {
    // Edit Employee answers 404 for every admin account, the editor's own included;
    // an admin changes their own password through change-password (flag false)
    const hr = await person("hr", { role: "Admin", pageAccess: ["employees"] });
    const boss = await person("boss", { role: "Super Admin" });

    for (const self of [hr, boss]) {
      const res = await edit(self.token, self.user._id, { password: EIGHT });
      expect(res.status).toBe(404);
      const stored = await User.findById(self.user._id).lean();
      expect(stored.mustChangePassword).toBe(false);
      expect(await bcrypt.compare(PASSWORD, stored.password)).toBe(true);
    }
  });

  it("refuses an Employee caller; nothing saved", async () => {
    const ana = await person("ana");
    const { user } = await person("rhea", { password: "Temp1234" });

    const res = await edit(ana.token, user._id, { password: EIGHT });
    expect(res.status).toBe(403);
    const stored = await User.findById(user._id).lean();
    expect(stored.mustChangePassword).toBe(false);
    expect(await bcrypt.compare("Temp1234", stored.password)).toBe(true);
  });

  it("leaves the password alone when it is blank, spaces only or not sent", async () => {
    const boss = await person("boss", { role: "Super Admin" });
    // An older account with a short password keeps it on an edit without one
    const { user } = await person("rhea", { password: "abc" });

    for (const body of [
      { firstName: "Rhea", password: "" },
      { firstName: "Rhea", password: "   " },
      { firstName: "Rhea" },
    ]) {
      const res = await edit(boss.token, user._id, body);
      expect(res.status).toBe(200);
      expect(await passwordMatches(user._id, "abc")).toBe(true);
    }
    expect((await login("rhea", "abc")).status).toBe(200);
  });
});

describe("The stored default stays false", () => {
  it("on a new Auth record that does not set the flag", async () => {
    expect(new User({}).mustChangePassword).toBe(false);
    const user = await User.create({
      username: "plain",
      password: PASSWORD,
      email: "plain@example.com",
    });
    const raw = await User.collection.findOne({ _id: user._id });
    expect(raw.mustChangePassword).toBe(false);
  });

  it("on createEmployeeAccount without the option (the sample-data script)", async () => {
    const { createEmployeeAccount } = require("../utils/employeeAccount");
    // Even a body asking for it is ignored; only the option sets it
    const { user } = await createEmployeeAccount(
      newEmployeeBody({ mustChangePassword: true }),
    );
    expect(
      (await User.collection.findOne({ _id: user._id })).mustChangePassword,
    ).toBe(false);

    const forced = await createEmployeeAccount(
      newEmployeeBody({
        employeeId: "AC-002",
        username: "sol",
        email: "sol@example.com",
      }),
      {},
      { mustChangePassword: true },
    );
    expect(
      (await User.collection.findOne({ _id: forced.user._id }))
        .mustChangePassword,
    ).toBe(true);
  });
});

describe("The Add Employee reply", () => {
  it("carries no password hash and no reset token", async () => {
    const { token } = await person("boss", { role: "Super Admin" });

    const res = await addEmployee(token, newEmployeeBody());
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Employee account created successfully");
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user).not.toHaveProperty("resetToken");
    expect(res.body.user.username).toBe("rico");
    expect(res.body.user._id).toBeDefined();
    expect(res.body.employee.employeeId).toBe("AC-001");
    expect(res.body.settings).toBeDefined();
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
  });
});
