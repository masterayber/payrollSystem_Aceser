jest.mock("../utils/nodemailer", () => jest.fn().mockResolvedValue());

const request = require("supertest");
const mongoose = require("mongoose");
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

// The pre-save hook hashes the password, so tests pass it in plain text
const createUser = (overrides = {}) =>
  User.create({
    username: "employee1",
    password: "Password123!",
    email: "employee1@example.com",
    role: "Employee",
    status: "Active",
    ...overrides,
  });

const loginAs = async (username, password = "Password123!") => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password });
  return res.body.token;
};

describe("GET /", () => {
  it("returns 200", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toBe("API is running...");
  });
});

describe("POST /api/auth/login", () => {
  it("returns a token for an active user with the right password", async () => {
    await createUser();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "employee1", password: "Password123!" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.password).toBeUndefined();
  });

  it("reject a wrong password", async () => {
    await createUser();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "employee1", password: "wrong" });

    expect(res.status).toBe(400);
    expect(res.body.token).toBeUndefined();
  });

  it("rejects an account pending approval", async () => {
    await createUser({ status: "Pending" });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "employee1", password: "Password123!" });

    expect(res.status).toBe(403);
  });
});

describe("Admin-only route guard (GET /api/employee/emloyees)", () => {
  it("return 401 without a token", async () => {
    const res = await request(app).get("/api/employee/employees");
    expect(res.status).toBe(401);
  });

  it("returns 401 with a forged token", async () => {
    const res = await request(app)
      .get("/api/employee/employees")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("returns 403 for an employee", async () => {
    await createUser();
    const token = await loginAs("employee1");

    const res = await request(app)
      .get("/api/employee/employees")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("returns 200 for an admin", async () => {
    await createUser({
      username: "admin1",
      email: "admin1@example.com",
      role: "Admin",
    });
    const token = await loginAs("admin1");

    const res = await request(app)
      .get("/api/employee/employees")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("does not return the OTP in the response", async () => {
    await createUser();
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "employee1@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.otp).toBeUndefined();
  });
});

describe("PUT /api/settings/updateGeneralSettings/:id", () => {
  it("ignores role, status and password sent by an employee", async () => {
    const user = await createUser();
    const token = await loginAs("employee1");

    const res = await request(app)
      .put(`/api/settings/updateGeneralSettings/${user._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        role: "Admin",
        status: "Inactive",
        password: "hacked",
        employee: {},
        settings: {},
      });

    expect(res.status).toBe(200);
    expect(res.body.password).toBeUndefined();

    const saved = await User.findById(user._id);
    expect(saved.role).toBe("Employee");
    expect(saved.status).toBe("Active");
    // The old password still works, so it was not overwritten
    expect(await loginAs("employee1")).toBeDefined();
  });

  it("still lets an employee change their own email", async () => {
    const user = await createUser();
    const token = await loginAs("employee1");

    const res = await request(app)
      .put(`/api/settings/updateGeneralSettings/${user._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "new@example.com", employee: {}, settings: {} });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("new@example.com");
  });

  it("returns 403 when an employee edits someone else", async () => {
    const other = await createUser({
      username: "employee2",
      email: "employee2@example.com",
    });
    await createUser();
    const token = await loginAs("employee1");

    const res = await request(app)
      .put(`/api/settings/updateGeneralSettings/${other._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "Admin", employee: {}, settings: {} });

    expect(res.status).toBe(403);
  });

  it("saves the employee's own profile fields", async () => {
    const user = await createUser();
    await Employee.create({
      userId: user._id,
      firstName: "Juan",
      lastName: "Dela Cruz",
      email: "employee1@example.com",
    });
    const token = await loginAs("employee1");

    const res = await request(app)
      .put(`/api/settings/updateGeneralSettings/${user._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        employee: { contactNumber: "09171234567", address: { city: "Makati" } },
        settings: {},
      });

    expect(res.status).toBe(200);
    expect(res.body.employee.contactNumber).toBe("09171234567");
    expect(res.body.employee.address.city).toBe("Makati");
  });
});

describe("POST /api/auth/signup", () => {
  it("ignores role and status sent in the body", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      firstName: "Eve",
      lastName: "Attacker",
      email: "eve@example.com",
      username: "eve",
      password: "Password123!",
      role: "Admin",
      status: "Active,",
    });

    expect(res.status).toBeLessThan(300);
    const user = await User.findOne({ email: "eve@example.com" });
    expect(user.role).toBe("Employee");
    expect(user.status).toBe("Pending");
  });
});
