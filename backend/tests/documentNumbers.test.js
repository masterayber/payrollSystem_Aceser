const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const DocumentCounter = require("../models/documentCounter");
const Supplier = require("../models/supplier");
const {
  nextDocumentNumber,
  counterKeysForProject,
} = require("../utils/documentNumbers");

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  // Unique indexes must exist before the duplicate tests run
  await Supplier.init();
  await DocumentCounter.init();
});

afterEach(async () => {
  await DocumentCounter.deleteMany({});
  await Supplier.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("nextDocumentNumber", () => {
  it("gives 0001 then 0002 for the same project and year", async () => {
    expect(await nextDocumentNumber("MR", "ACE01", "2026")).toBe(
      "MR-ACE01-2026-0001",
    );
    expect(await nextDocumentNumber("MR", "ACE01", "2026")).toBe(
      "MR-ACE01-2026-0002",
    );
  });

  it("pads to four digits", async () => {
    await DocumentCounter.create({ key: "MR-ACE01-2026", seq: 41 });
    expect(await nextDocumentNumber("MR", "ACE01", "2026")).toBe(
      "MR-ACE01-2026-0042",
    );
    await DocumentCounter.updateOne({ key: "MR-ACE01-2026" }, { seq: 9999 });
    expect(await nextDocumentNumber("MR", "ACE01", "2026")).toBe(
      "MR-ACE01-2026-10000",
    );
  });

  it("keeps a separate series per project and per year", async () => {
    expect(await nextDocumentNumber("MR", "ACE01", "2026")).toBe(
      "MR-ACE01-2026-0001",
    );
    expect(await nextDocumentNumber("MR", "ACE02", "2026")).toBe(
      "MR-ACE02-2026-0001",
    );
    expect(await nextDocumentNumber("MR", "ACE01", "2027")).toBe(
      "MR-ACE01-2027-0001",
    );
    expect(await nextDocumentNumber("MR", "ACE01", "2026")).toBe(
      "MR-ACE01-2026-0002",
    );
  });

  it("gives PO numbers without a project code", async () => {
    expect(await nextDocumentNumber("PO", null, "2026")).toBe("PO-2026-0001");
    expect(await nextDocumentNumber("PO", "", "2026")).toBe("PO-2026-0002");
  });

  it("gives transfer numbers with the source project code", async () => {
    expect(await nextDocumentNumber("TR", "ACE01", "2026")).toBe(
      "TR-ACE01-2026-0001",
    );
  });

  it("defaults the year to the current Manila year", async () => {
    const year = new Date(Date.now() + 8 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 4);
    expect(await nextDocumentNumber("DR", "ACE01")).toBe(
      `DR-ACE01-${year}-0001`,
    );
  });

  it("gives different numbers to parallel calls", async () => {
    const numbers = await Promise.all([
      nextDocumentNumber("WS", "ACE01", "2026"),
      nextDocumentNumber("WS", "ACE01", "2026"),
      nextDocumentNumber("WS", "ACE01", "2026"),
    ]);
    expect(new Set(numbers).size).toBe(3);
    expect(numbers.sort()).toEqual([
      "WS-ACE01-2026-0001",
      "WS-ACE01-2026-0002",
      "WS-ACE01-2026-0003",
    ]);
  });

  it("retries once when the first upsert loses the race", async () => {
    const original = DocumentCounter.findOneAndUpdate.bind(DocumentCounter);
    const spy = jest
      .spyOn(DocumentCounter, "findOneAndUpdate")
      .mockImplementationOnce(() => {
        const err = new Error("E11000 duplicate key");
        err.code = 11000;
        return Promise.reject(err);
      })
      .mockImplementation(original);
    try {
      expect(await nextDocumentNumber("MR", "ACE01", "2026")).toBe(
        "MR-ACE01-2026-0001",
      );
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });

  it("rethrows other errors", async () => {
    const spy = jest
      .spyOn(DocumentCounter, "findOneAndUpdate")
      .mockImplementationOnce(() => Promise.reject(new Error("boom")));
    try {
      await expect(nextDocumentNumber("MR", "ACE01", "2026")).rejects.toThrow(
        "boom",
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe("counterKeysForProject", () => {
  it("matches the project's series and nothing else", () => {
    const re = counterKeysForProject("ACE01");
    expect(re.test("MR-ACE01-2026")).toBe(true);
    expect(re.test("DR-ACE01-2026")).toBe(true);
    expect(re.test("WS-ACE01-2026")).toBe(true);
    expect(re.test("TR-ACE01-2026")).toBe(true);
    expect(re.test("PO-2026")).toBe(false);
    expect(re.test("MR-ACE010-2026")).toBe(false);
    expect(re.test("MR-ACE02-2026")).toBe(false);
  });

  it("escapes the code", () => {
    expect(counterKeysForProject("A.B").test("MR-AXB-2026")).toBe(false);
    expect(counterKeysForProject("A.B").test("MR-A.B-2026")).toBe(true);
  });
});

describe("Supplier nameKey", () => {
  const createdBy = new mongoose.Types.ObjectId();

  it("stores the trimmed lower-cased name as nameKey", async () => {
    const supplier = await Supplier.create({
      name: "  ABC Hardware ",
      vatType: "VAT",
      createdBy,
    });
    expect(supplier.name).toBe("ABC Hardware");
    expect(supplier.nameKey).toBe("abc hardware");
  });

  it("refuses two spellings of the same supplier", async () => {
    await Supplier.create({ name: "ABC Hardware", vatType: "VAT", createdBy });
    await expect(
      Supplier.create({ name: "abc hardware ", vatType: "Non-VAT", createdBy }),
    ).rejects.toMatchObject({ code: 11000 });
    expect(await Supplier.countDocuments()).toBe(1);
  });

  it("requires a valid vatType", async () => {
    await expect(
      Supplier.create({ name: "No VAT Type", createdBy }),
    ).rejects.toMatchObject({ name: "ValidationError" });
    await expect(
      Supplier.create({ name: "Bad VAT Type", vatType: "Zero", createdBy }),
    ).rejects.toMatchObject({ name: "ValidationError" });
    expect(await Supplier.countDocuments()).toBe(0);
  });
});
