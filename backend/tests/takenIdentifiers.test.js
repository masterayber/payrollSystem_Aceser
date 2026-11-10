// utils/takenIdentifiers.js: "is this username, email or Employee ID used by someone
// else?", ignoring case. The routes using it are tested in app.test.js.
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const User = require("../models/authUsers");
const Employee = require("../models/employees");
const {
  TAKEN_MESSAGES,
  takenField,
  takenRefusal,
} = require("../utils/takenIdentifiers");

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await User.deleteMany({});
  await Employee.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

// Carlo, with an Auth account and an Employee record
const createCarlo = async () => {
  const user = await User.create({
    username: "cmercado",
    password: "Password123!",
    email: "carlo.mercado@aceserph.com",
    role: "Employee",
    status: "Active",
  });
  await Employee.create({
    userId: user._id,
    firstName: "Carlo",
    lastName: "Mercado",
    email: "carlo.mercado@aceserph.com",
    employeeId: "AC-007",
  });
  return user;
};

describe("takenField", () => {
  it("finds each value taken by another account, in any case", async () => {
    await createCarlo();

    expect(await takenField({ username: "CMercado" })).toBe("username");
    expect(await takenField({ email: "Carlo.Mercado@ACESERPH.com" })).toBe("email");
    expect(await takenField({ employeeId: "ac-007" })).toBe("employeeId");
  });

  it("does not count the account's own values, in any case", async () => {
    const carlo = await createCarlo();

    expect(
      await takenField(
        {
          username: "CMERCADO",
          email: ["Carlo.Mercado@aceserph.com", "CARLO.MERCADO@aceserph.com"],
          employeeId: "ac-007",
        },
        carlo._id,
      ),
    ).toBeNull();
  });

  it("checks every email in a list", async () => {
    await createCarlo();

    expect(
      await takenField({ email: ["free@aceserph.com", "carlo.mercado@aceserph.com"] }),
    ).toBe("email");
  });

  it("finds an email only an Employee record still uses", async () => {
    await Employee.create({
      firstName: "Old",
      lastName: "Record",
      email: "old.record@aceserph.com",
    });

    expect(await takenField({ email: "OLD.record@aceserph.com" })).toBe("email");
  });

  it("matches whole values only and skips missing, blank or odd values", async () => {
    await createCarlo();

    expect(
      await takenField({
        username: "cmerc",
        email: "carlo.mercado@aceserphXcom",
        employeeId: "AC-0",
      }),
    ).toBeNull();
    expect(
      await takenField({
        username: "",
        email: [undefined, null, ""],
        employeeId: { $ne: null },
      }),
    ).toBeNull();
    expect(await takenField()).toBeNull();
  });

  it("refuses the username first, then the email, then the Employee ID", async () => {
    await createCarlo();

    expect(
      await takenField({
        username: "cmercado",
        email: "carlo.mercado@aceserph.com",
        employeeId: "AC-007",
      }),
    ).toBe("username");
    expect(
      await takenField({ email: "carlo.mercado@aceserph.com", employeeId: "AC-007" }),
    ).toBe("email");
  });
});

describe("takenRefusal", () => {
  it("gives the plain-English message, or null", async () => {
    await createCarlo();

    expect(await takenRefusal({ username: "CMERCADO" })).toBe(
      "Username is already taken.",
    );
    expect(await takenRefusal({ email: "CARLO.MERCADO@aceserph.com" })).toBe(
      "Email is already registered.",
    );
    expect(await takenRefusal({ employeeId: "ac-007" })).toBe(
      "Employee ID already exists.",
    );
    expect(await takenRefusal({ username: "someone.new" })).toBeNull();
    expect(TAKEN_MESSAGES.username).toBe("Username is already taken.");
  });
});
