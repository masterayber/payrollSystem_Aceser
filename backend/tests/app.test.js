const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await User.deleteMany({});
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
