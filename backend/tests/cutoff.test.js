import {
  getCutoffFor,
  getCutoffOptions,
  getCutoffRange,
  parseCutoffValue,
  toCutoffValue,
  toManilaDate,
} from "../../frontend/src/utils/cutoff";
import { getDateRange } from "../../frontend/src/utils/reports/reportHelpers";

const values = (options) => options.map((option) => option.value);

describe("getCutoffFor", () => {
  it.each([
    ["2026-10-11", "2026-10-1st"],
    ["2026-10-25", "2026-10-1st"],
    ["2026-10-26", "2026-10-2nd"],
    ["2026-10-31", "2026-10-2nd"],
    ["2026-10-01", "2026-09-2nd"],
    ["2026-10-10", "2026-09-2nd"],
    ["2026-01-05", "2025-12-2nd"],
  ])("puts %s in %s", (date, expected) => {
    expect(toCutoffValue(getCutoffFor(date))).toBe(expected);
  });
});

describe("getCutoffRange", () => {
  it.each([
    ["2026-10-1st", "2026-10-11", "2026-10-25"],
    ["2026-10-2nd", "2026-10-26", "2026-11-10"],
    ["2026-12-2nd", "2026-12-26", "2027-01-10"],
    ["2026-02-2nd", "2026-02-26", "2026-03-10"],
  ])("%s runs from %s to %s", (value, start, end) => {
    expect(getCutoffRange(parseCutoffValue(value))).toEqual({ start, end });
  });
});

describe("getCutoffOptions", () => {
  it("starts at the current cut-off and never lists a future one", () => {
    const options = getCutoffOptions({ today: "2026-10-05", count: 3 });
    expect(values(options)).toEqual([
      "2026-09-2nd",
      "2026-09-1st",
      "2026-08-2nd",
    ]);
    expect(options[0].label).toBe("September 2026 2nd Cut-off");
  });

  it("crosses into the previous year", () => {
    expect(values(getCutoffOptions({ today: "2026-01-05", count: 3 }))).toEqual(
      ["2025-12-2nd", "2025-12-1st", "2025-11-2nd"],
    );
  });

  it("stops at the cut-off of the hire date", () => {
    expect(
      values(getCutoffOptions({ today: "2026-10-23", since: "2026-09-15" })),
    ).toEqual(["2026-10-1st", "2026-09-2nd", "2026-09-1st"]);
  });
});

describe("Reports export range (getDateRange)", () => {
  it("uses the shared cut-off dates and label", () => {
    expect(getDateRange("cutoff", "2026-12-2nd")).toMatchObject({
      start: "2026-12-26",
      end: "2027-01-10",
      label: "December 2026 2nd Cut-off",
      monthName: "December",
      nextMonthName: "January",
      cutoff: "2nd",
    });
  });
});

describe("toManilaDate", () => {
  it("uses the Manila day, not the UTC day", () => {
    expect(toManilaDate("2026-10-22T17:30:00.000Z")).toBe("2026-10-23");
  });
});
