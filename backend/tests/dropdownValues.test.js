const { findDuplicate, positionsIn } = require("../utils/dropdownValues");

describe("findDuplicate", () => {
  it("returns the stored spelling when the value differs only in capitals or spaces", () => {
    expect(findDuplicate(["Others", "Electrical"], " others ")).toBe("Others");
    expect(findDuplicate(["Others"], "OTHERS")).toBe("Others");
  });

  it("returns null when nothing matches", () => {
    expect(findDuplicate(["Others"], "Other")).toBeNull();
    expect(findDuplicate([], "Others")).toBeNull();
    expect(findDuplicate(undefined, "Others")).toBeNull();
  });

  it("skips the entry being renamed", () => {
    expect(findDuplicate(["Others", "Electrical"], "OTHERS", 0)).toBeNull();
    expect(findDuplicate(["Others", "Electrical"], "electrical", 0)).toBe(
      "Electrical",
    );
  });
});

describe("positionsIn", () => {
  it("reads a Map or a plain object", () => {
    expect(
      positionsIn({ positions: new Map([["HR", ["Clerk"]]]) }, "HR"),
    ).toEqual(["Clerk"]);
    expect(positionsIn({ positions: { HR: ["Clerk"] } }, "HR")).toEqual([
      "Clerk",
    ]);
  });

  it("returns an empty list for a missing department or document", () => {
    expect(positionsIn({ positions: { HR: ["Clerk"] } }, "Sales")).toEqual([]);
    expect(positionsIn(null, "HR")).toEqual([]);
  });
});
