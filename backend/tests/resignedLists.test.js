import {
  activeFirst,
  activeOnly,
  isPastLastWorkingDay,
} from "../../frontend/src/utils/employees";
import { isNotEmployedOn } from "../../frontend/src/utils/reports/reportHelpers";

const active = (name) => ({ name, status: "Active" });
const resigned = (name, resignationDate) => ({
  name,
  status: "Resigned",
  createdAt: "2026-01-05T00:00:00.000Z",
  jobDescription: { resignationDate },
});

describe("shared employee list", () => {
  const list = [
    resigned("Ana", "2026-10-15"),
    active("Ben"),
    resigned("Cid", "2026-09-30"),
    active("Dan"),
  ];

  test("activeFirst puts resigned employees last, keeping each group's order", () => {
    expect(activeFirst(list).map((e) => e.name)).toEqual([
      "Ben",
      "Dan",
      "Ana",
      "Cid",
    ]);
  });

  test("activeOnly leaves resigned employees out", () => {
    expect(activeOnly(list).map((e) => e.name)).toEqual(["Ben", "Dan"]);
  });
});

describe("isNotEmployedOn", () => {
  const employee = resigned("Ana", "2026-10-15");

  test("days before hire and after the last working day are outside", () => {
    expect(isNotEmployedOn(employee, "2026-01-02")).toBe(true);
    expect(isNotEmployedOn(employee, "2026-10-16")).toBe(true);
  });

  test("the hire date, the last working day and days between are inside", () => {
    expect(isNotEmployedOn(employee, "2026-01-05")).toBe(false);
    expect(isNotEmployedOn(employee, "2026-10-01")).toBe(false);
    expect(isNotEmployedOn(employee, "2026-10-15")).toBe(false);
  });

  test("a reinstated (active) employee has no end date", () => {
    expect(
      isNotEmployedOn({ ...employee, status: "Active" }, "2026-12-01"),
    ).toBe(false);
  });
});

describe("isPastLastWorkingDay", () => {
  test("only dates after a resigned employee's last working day", () => {
    const employee = resigned("Ana", "2026-10-15");
    expect(isPastLastWorkingDay(employee, "2026-10-15")).toBe(false);
    expect(isPastLastWorkingDay(employee, "2026-10-16")).toBe(true);
    expect(
      isPastLastWorkingDay({ ...employee, status: "Active" }, "2026-10-16"),
    ).toBe(false);
  });
});
