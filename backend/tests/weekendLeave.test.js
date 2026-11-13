import {
  isWeekendKey,
  isWeekendLeave,
} from "../../frontend/src/utils/dateFormatter";

// Group 7: an On-Leave row on a Saturday or Sunday is a rest day, not a leave
// day, on Admin Attendance, the employee Attendance and the employee Dashboard
// (the Calendar's rule, PR #56). 2026-11-13 is a Friday.
describe("isWeekendKey", () => {
  it.each([
    ["2026-11-14", true], // Saturday
    ["2026-11-15", true], // Sunday
    ["2026-11-13", false], // Friday
    ["2026-11-16", false], // Monday
    ["2026-11-14T00:00:00.000Z", true], // API date with a time part
    ["", false],
    [null, false],
    [undefined, false],
  ])("%s is a weekend: %s", (dateKey, expected) => {
    expect(isWeekendKey(dateKey)).toBe(expected);
  });
});

describe("isWeekendLeave", () => {
  it.each([
    ["2026-11-14", "On-Leave", true], // Saturday leave row
    ["2026-11-15", "On-Leave", true], // Sunday leave row
    ["2026-11-15T00:00:00.000Z", "On-Leave", true],
    ["2026-11-13", "On-Leave", false], // Friday stays On-Leave
    ["2026-11-16", "On-Leave", false], // Monday stays On-Leave
    ["2026-11-14", "On-Time", false], // weekend work is not a leave row
    ["2026-11-14", "Late", false],
    ["2026-11-14", undefined, false], // no row on that day
    [undefined, "On-Leave", false], // no date
  ])("%s with %s is a weekend leave row: %s", (dateKey, behavior, expected) => {
    expect(isWeekendLeave(dateKey, behavior)).toBe(expected);
  });
});
