// No raw error text in error replies (Friday batch 2026-11-27, Group 2; decision 2). A
// server error in routes/filing.js, routes/holidays.js, routes/access.js,
// routes/thirteenthMonth.js, the logistics routes (files, items, setup, suppliers) and the
// logistics guards (middleware/logisticsAccess.js) answers with a fixed text only; the raw
// detail is logged on the server with console.error. Filing keeps the `error` key its
// forms read, with one fixed sentence; the others answer `message` only.
// The same pattern for routes/settings.js is in settingsReplies.test.js.
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Settings = require("../models/settings");
const LeaveApplication = require("../models/leaveApplication");
const OvertimeApplication = require("../models/overtimeApplication");
const Holiday = require("../models/holiday");
const BasicPayChange = require("../models/basicPayChange");
const Item = require("../models/item");
const Supplier = require("../models/supplier");
const Project = require("../models/project");
const filesRouter = require("../routes/logistics/files");

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  jest.restoreAllMocks();
  delete filesRouter.documentReaders.MaterialRequest;
  await User.deleteMany({});
  await Settings.deleteMany({});
  await LeaveApplication.deleteMany({});
  await OvertimeApplication.deleteMany({});
  await Holiday.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const PASSWORD = "Password123!";
const RAW_DETAIL = "raw-database-detail-xyz";
const FILING_SERVER_ERROR = "Something went wrong. Please try again.";

const as = (token) => ({ Authorization: `Bearer ${token}` });

const loginAs = async (username) => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
};

const account = async (username, role = "Employee") => {
  const user = await User.create({
    username,
    password: PASSWORD,
    email: `${username}@example.com`,
    role,
    status: "Active",
  });
  return { user, token: await loginAs(username) };
};

const superAdmin = () => account("boss", "Super Admin");

// A regularized employee, so VL and SL have credits
const employee = async (username = "ana") => {
  const signedIn = await account(username);
  await Settings.create({
    userId: signedIn.user._id,
    general: {
      jobDescription: {
        employmentType: "Regular",
        startDate: new Date("2025-07-01"),
        regularizationDate: new Date("2026-01-05"),
      },
    },
  });
  return signedIn;
};

// Makes `target[method]` throw a database-style error carrying RAW_DETAIL. A throw (not a
// rejected promise) works whatever the route chains after the call (.select, .lean).
const breakCall = (target, method) =>
  jest.spyOn(target, method).mockImplementation(() => {
    throw new Error(RAW_DETAIL);
  });

const quietLog = () => jest.spyOn(console, "error").mockImplementation(() => {});

const expectLogged = (logSpy) =>
  expect(
    logSpy.mock.calls.some((args) =>
      args.some((arg) => String(arg?.message ?? arg).includes(RAW_DETAIL)),
    ),
  ).toBe(true);

// A 500 that answers exactly `body`, holds no raw detail and was logged
const expectServerError = (res, body, logSpy) => {
  expect(res.status).toBe(500);
  expect(res.body).toEqual(body);
  expect(JSON.stringify(res.body)).not.toContain(RAW_DETAIL);
  expectLogged(logSpy);
};

const expectPlainServerError = (res, message, logSpy) => {
  expectServerError(res, { message }, logSpy);
  expect(res.body).not.toHaveProperty("error");
};

const expectFilingServerError = (res, logSpy) =>
  expectServerError(res, { error: FILING_SERVER_ERROR }, logSpy);

describe("routes/filing.js: a 500 keeps `error` with the fixed sentence", () => {
  it("GET /user-leave-requests", async () => {
    const { token } = await employee();
    const log = quietLog();
    breakCall(LeaveApplication, "find");

    const res = await request(app)
      .get("/api/filing/user-leave-requests")
      .set(as(token));

    expectFilingServerError(res, log);
  });

  it("GET /leave-credits", async () => {
    const { token } = await employee();
    const log = quietLog();
    breakCall(LeaveApplication, "find");

    const res = await request(app).get("/api/filing/leave-credits").set(as(token));

    expectFilingServerError(res, log);
  });

  it("POST /apply-leave: a failed save answers 500 and nothing is saved", async () => {
    const { token } = await employee();
    const log = quietLog();
    jest
      .spyOn(LeaveApplication.prototype, "save")
      .mockRejectedValueOnce(new Error(RAW_DETAIL));

    const res = await request(app)
      .post("/api/filing/apply-leave")
      .set(as(token))
      .send({
        leaveType: "Study Leave",
        leaveDetails: "Family matter",
        startDate: "2026-11-02",
        endDate: "2026-11-02",
      });

    expectFilingServerError(res, log);
    expect(await LeaveApplication.countDocuments({})).toBe(0);
  });

  it("GET /user-overtime-requests", async () => {
    const { token } = await employee();
    const log = quietLog();
    breakCall(OvertimeApplication, "find");

    const res = await request(app)
      .get("/api/filing/user-overtime-requests")
      .set(as(token));

    expectFilingServerError(res, log);
  });

  it("DELETE /leave/:id", async () => {
    const { token } = await employee();
    const log = quietLog();
    breakCall(LeaveApplication, "findOneAndDelete");

    const res = await request(app)
      .delete(`/api/filing/leave/${new mongoose.Types.ObjectId()}`)
      .set(as(token));

    expectFilingServerError(res, log);
  });

  it("a refusal (400) still carries its own words under `error`, with no log", async () => {
    const { token } = await employee();
    const log = quietLog();

    const res = await request(app)
      .post("/api/filing/apply-leave")
      .set(as(token))
      .send({
        leaveType: "Not a leave type",
        leaveDetails: "Family matter",
        startDate: "2026-11-02",
        endDate: "2026-11-02",
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Choose a leave type from the list." });
    expect(log).not.toHaveBeenCalled();
    expect(await LeaveApplication.countDocuments({})).toBe(0);
  });
});

describe("routes/holidays.js: a 500 answers its message only", () => {
  it("GET /api/holidays", async () => {
    const { token } = await employee();
    const log = quietLog();
    breakCall(Holiday, "find");

    const res = await request(app).get("/api/holidays").set(as(token));

    expectPlainServerError(res, "Error fetching holidays", log);
  });

  it("DELETE /api/holidays/:id", async () => {
    const { token } = await superAdmin();
    const log = quietLog();
    breakCall(Holiday, "findByIdAndDelete");

    const res = await request(app)
      .delete(`/api/holidays/${new mongoose.Types.ObjectId()}`)
      .set(as(token));

    expectPlainServerError(res, "Error removing the holiday", log);
  });
});

describe("routes/access.js: a 500 answers its message only", () => {
  // Breaks User.findById for the target account only, so the sign-in guard
  // (loadCurrentUser) still reads the caller
  const breakLookupOf = (targetId) => {
    const original = User.findById;
    return jest.spyOn(User, "findById").mockImplementation(function (id, ...rest) {
      if (String(id) === String(targetId)) throw new Error(RAW_DETAIL);
      return original.call(this, id, ...rest);
    });
  };

  it("GET /api/access/users/:userId", async () => {
    const { token } = await superAdmin();
    const { user: ana } = await employee();
    const log = quietLog();
    breakLookupOf(ana._id);

    const res = await request(app)
      .get(`/api/access/users/${ana._id}`)
      .set(as(token));

    expectPlainServerError(res, "Server error", log);
  });

  it("PUT /api/access/users/:userId changes nothing", async () => {
    const { token } = await superAdmin();
    const { user: ana } = await employee();
    const log = quietLog();
    breakLookupOf(ana._id);

    const res = await request(app)
      .put(`/api/access/users/${ana._id}`)
      .set(as(token))
      .send({ pages: ["filing"] });

    expectPlainServerError(res, "Server error", log);
    const stored = await User.findOne({ _id: ana._id }).lean();
    expect(stored.pageAccess).toBeUndefined();
  });
});

describe("routes/thirteenthMonth.js: a 500 answers its message only", () => {
  it("GET /api/thirteenth-month", async () => {
    const { token } = await superAdmin();
    const log = quietLog();
    breakCall(BasicPayChange, "find");

    const res = await request(app)
      .get("/api/thirteenth-month?year=2026")
      .set(as(token));

    expectPlainServerError(res, "Error fetching 13th month pay", log);
  });

  it("GET /api/thirteenth-month/:userId", async () => {
    const { token } = await superAdmin();
    const { user: ana } = await employee();
    const log = quietLog();
    breakCall(BasicPayChange, "find");

    const res = await request(app)
      .get(`/api/thirteenth-month/${ana._id}?year=2026`)
      .set(as(token));

    expectPlainServerError(res, "Error fetching 13th month pay", log);
  });
});

describe("Logistics: a 500 answers \"Server error\" only", () => {
  it("routes/logistics/items.js: GET /api/logistics/items", async () => {
    const { token } = await superAdmin();
    const log = quietLog();
    breakCall(Item, "find");

    const res = await request(app).get("/api/logistics/items").set(as(token));

    expectPlainServerError(res, "Server error", log);
  });

  it("routes/logistics/suppliers.js: GET /api/logistics/suppliers", async () => {
    const { token } = await superAdmin();
    const log = quietLog();
    breakCall(Supplier, "find");

    const res = await request(app)
      .get("/api/logistics/suppliers")
      .set(as(token));

    expectPlainServerError(res, "Server error", log);
  });

  it("routes/logistics/setup.js: GET /api/logistics/me", async () => {
    const { token } = await superAdmin();
    const log = quietLog();
    breakCall(Project, "find");

    const res = await request(app).get("/api/logistics/me").set(as(token));

    expectPlainServerError(res, "Server error", log);
  });

  it("routes/logistics/files.js: GET /api/logistics/files/...", async () => {
    const { token } = await superAdmin();
    const log = quietLog();
    filesRouter.documentReaders.MaterialRequest = async () => {
      throw new Error(RAW_DETAIL);
    };

    const res = await request(app)
      .get(
        `/api/logistics/files/MaterialRequest/${new mongoose.Types.ObjectId()}/${new mongoose.Types.ObjectId()}`,
      )
      .set(as(token));

    expectPlainServerError(res, "Server error", log);
  });

  it("middleware/logisticsAccess.js: the guard that reads the caller's position", async () => {
    const { token } = await superAdmin();
    const log = quietLog();
    breakCall(Settings, "findOne");

    const res = await request(app).get("/api/logistics/items").set(as(token));

    expectPlainServerError(res, "Server error", log);
  });

  it("a logistics refusal (403) still answers its own message, with no log", async () => {
    const { token } = await employee();
    const log = quietLog();

    const res = await request(app).get("/api/logistics/items").set(as(token));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("You do not have access to this page");
    expect(res.body).not.toHaveProperty("error");
    expect(log).not.toHaveBeenCalled();
  });
});
