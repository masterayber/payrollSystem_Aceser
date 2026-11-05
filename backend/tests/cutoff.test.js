import * as frontendCutoff from "../../frontend/src/utils/cutoff";
import { getDateRange } from "../../frontend/src/utils/reports/reportHelpers";

const backendCutoff = require("../utils/cutoff");

const { getCutoffOptions, toManilaDate } = frontendCutoff;
const values = (options) => options.map((option) => option.value);

// One table of cases for both copies of the cut-off rule, so they can't drift apart
describe.each([
  ["frontend", frontendCutoff],
  ["backend", backendCutoff],
])("%s cut-off rule", (copy, cutoffs) => {
  const { getCutoffFor, getCutoffRange, parseCutoffValue, toCutoffValue } =
    cutoffs;

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

  describe("parseCutoffValue and toCutoffValue", () => {
    it.each(["2026-01-1st", "2026-12-2nd", "2027-06-1st"])(
      "round-trips %s",
      (value) => {
        expect(toCutoffValue(parseCutoffValue(value))).toBe(value);
      },
    );

    it("uses a 0-based month index", () => {
      expect(parseCutoffValue("2026-11-1st")).toEqual({
        year: 2026,
        monthIndex: 10,
        half: "1st",
      });
    });
  });
});

describe("calendarYearCutoffs (backend)", () => {
  const year = backendCutoff.calendarYearCutoffs(2026);

  it("has 25 parts from Jan 1 to Dec 31, the year-end cut-off split at both ends", () => {
    expect(year).toHaveLength(25);
    expect(year[0]).toEqual({
      cutoff: "2026-01-yearEnd",
      month: "2026-01",
      half: "yearEnd",
      start: "2026-01-01",
      end: "2026-01-10",
    });
    expect(year[1]).toEqual({
      cutoff: "2026-01-1st",
      month: "2026-01",
      half: "1st",
      start: "2026-01-11",
      end: "2026-01-25",
    });
    expect(year[21]).toMatchObject({
      cutoff: "2026-11-1st",
      start: "2026-11-11",
      end: "2026-11-25",
    });
    expect(year[23]).toEqual({
      cutoff: "2026-12-1st",
      month: "2026-12",
      half: "1st",
      start: "2026-12-11",
      end: "2026-12-25",
    });
    expect(year[24]).toEqual({
      cutoff: "2026-12-yearEnd",
      month: "2026-12",
      half: "yearEnd",
      start: "2026-12-26",
      end: "2026-12-31",
    });
  });

  it("has 23 ordinary cut-offs and no December 2nd", () => {
    const ordinary = year.filter((part) => part.half !== "yearEnd");
    expect(ordinary).toHaveLength(23);
    expect(year.map((part) => part.cutoff)).not.toContain("2026-12-2nd");
    expect(year.filter((part) => part.half === "yearEnd")).toHaveLength(2);
  });

  it("leaves no gap and no overlap between parts", () => {
    for (let i = 1; i < year.length; i += 1) {
      const dayAfter = new Date(`${year[i - 1].end}T00:00:00Z`);
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
      expect(year[i].start).toBe(dayAfter.toISOString().slice(0, 10));
    }
  });

  it("follows on from the previous year with no gap", () => {
    const last2026 = year[24];
    const first2027 = backendCutoff.calendarYearCutoffs(2027)[0];
    expect(last2026.end).toBe("2026-12-31");
    expect(first2027).toMatchObject({
      cutoff: "2027-01-yearEnd",
      start: "2027-01-01",
      end: "2027-01-10",
    });
  });

  it("handles a leap year's February", () => {
    const feb2nd = backendCutoff
      .calendarYearCutoffs(2028)
      .find((part) => part.cutoff === "2028-02-2nd");
    expect(feb2nd).toMatchObject({ start: "2028-02-26", end: "2028-03-10" });
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
