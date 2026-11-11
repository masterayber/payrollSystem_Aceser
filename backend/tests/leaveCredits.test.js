const {
  weekdaysBetween,
  vacationEarned,
  leaveBalance,
  checkLeaveDates,
  leaveTypeError,
  workingDaysError,
  checkLeaveCredits,
} = require("../utils/leaveCredits");

const job = { regularizationDate: new Date("2026-03-16") };
const leave = (leaveType, startDate, endDate, status = "Approved") => ({
  leaveType,
  startDate: new Date(startDate),
  endDate: new Date(endDate),
  status,
});
const request = (leaveType, startKey, endKey) => ({
  leaveType,
  startKey,
  endKey,
});

describe("weekdaysBetween", () => {
  it("counts Monday to Friday only, both ends included", () => {
    // Fri Oct 30 to Tue Nov 3: Fri, Mon, Tue
    expect(weekdaysBetween("2026-10-30", "2026-11-03")).toEqual([
      "2026-10-30",
      "2026-11-02",
      "2026-11-03",
    ]);
    expect(weekdaysBetween("2026-10-31", "2026-11-01")).toEqual([]);
  });
});

describe("vacationEarned", () => {
  it("is 15 from the date of regularization, plus 15 every January 1, plus the opening balance", () => {
    expect(vacationEarned(job, "2026-03-15")).toBe(0);
    expect(vacationEarned(job, "2026-03-16")).toBe(15);
    expect(vacationEarned(job, "2026-12-31")).toBe(15);
    expect(vacationEarned(job, "2027-01-01")).toBe(30);
    expect(vacationEarned(job, "2028-06-01")).toBe(45);
    expect(
      vacationEarned({ ...job, vacationLeaveOpening: 4 }, "2026-12-31"),
    ).toBe(19);
  });

  it("is only the opening balance without a date of regularization", () => {
    expect(vacationEarned({ vacationLeaveOpening: 3 }, "2026-12-31")).toBe(3);
  });
});

describe("leaveBalance", () => {
  it("shows VL over all time and SL for this month, with pending days held", () => {
    const leaves = [
      leave("Vacation Leave", "2026-05-04", "2026-05-08"), // 5 used
      leave("Vacation Leave", "2026-12-07", "2026-12-08", "Pending"), // 2 pending
      leave("Vacation Leave", "2026-06-01", "2026-06-01", "Disapproved"), // ignored
      leave("Sick Leave", "2026-10-05", "2026-10-06"), // 2 used in October
      leave("Sick Leave", "2026-10-29", "2026-11-03", "Pending"), // 2 pending in October
    ];

    expect(leaveBalance(job, leaves, "2026-10-27")).toEqual({
      regularizationDate: "2026-03-16",
      vacation: { earned: 15, used: 5, pending: 2, available: 8 },
      sick: {
        month: "2026-10",
        earned: 15,
        used: 2,
        pending: 2,
        available: 11,
      },
    });
  });

  it("has no SL before the date of regularization", () => {
    expect(leaveBalance(job, [], "2026-03-02").sick.available).toBe(0);
  });
});

describe("checkLeaveDates", () => {
  it("needs valid dates with the end on or after the start", () => {
    expect(
      checkLeaveDates({ startDate: "2026-11-02", endDate: "2026-11-03" }),
    ).toEqual({
      startKey: "2026-11-02",
      endKey: "2026-11-03",
    });
    expect(checkLeaveDates({ startDate: "2026-11-02" }).error).toBeDefined();
    expect(
      checkLeaveDates({ startDate: "2026-11-05", endDate: "2026-11-03" }).error,
    ).toMatch(/before the start date/);
  });
});

describe("leaveTypeError", () => {
  it("passes a type on the list and refuses anything else", () => {
    expect(leaveTypeError("Vacation Leave")).toBeNull();
    expect(leaveTypeError("Leave Without Pay (LWOP)")).toBeNull();
    for (const value of ["Emergency Leave", "vacation leave", "", undefined]) {
      expect(leaveTypeError(value)).toBe("Choose a leave type from the list.");
    }
  });
});

describe("workingDaysError", () => {
  const NO_WORKING_DAYS = "This leave has no working days (Monday to Friday).";

  it("refuses dates with no Monday-to-Friday day, whatever the leave type", () => {
    // Sat Oct 31 to Sun Nov 1, and a single Saturday
    expect(
      workingDaysError({ startKey: "2026-10-31", endKey: "2026-11-01" }),
    ).toBe(NO_WORKING_DAYS);
    expect(
      workingDaysError({ startKey: "2026-11-14", endKey: "2026-11-14" }),
    ).toBe(NO_WORKING_DAYS);
  });

  it("passes dates with at least one working day", () => {
    // Fri Nov 13 to Mon Nov 16, Sun Nov 15 to Mon Nov 16, and a single Monday
    expect(
      workingDaysError({ startKey: "2026-11-13", endKey: "2026-11-16" }),
    ).toBeNull();
    expect(
      workingDaysError({ startKey: "2026-11-15", endKey: "2026-11-16" }),
    ).toBeNull();
    expect(
      workingDaysError({ startKey: "2026-11-16", endKey: "2026-11-16" }),
    ).toBeNull();
  });
});

describe("checkLeaveCredits", () => {
  it("lets other leave types through", () => {
    expect(
      checkLeaveCredits(
        {},
        [],
        request("Maternity Leave", "2026-11-02", "2026-12-31"),
      ),
    ).toBeNull();
  });

  it("refuses VL and SL without a date of regularization", () => {
    expect(
      checkLeaveCredits(
        {},
        [],
        request("Vacation Leave", "2026-11-02", "2026-11-02"),
      ),
    ).toMatch(/date of regularization/);
    expect(
      checkLeaveCredits(
        {},
        [],
        request("Sick Leave", "2026-11-02", "2026-11-02"),
      ),
    ).toMatch(/date of regularization/);
  });

  // Kept for approval, which checks a VL or SL request again (filing uses workingDaysError)
  it("refuses a VL or SL request with no working days", () => {
    expect(
      checkLeaveCredits(
        job,
        [],
        request("Vacation Leave", "2026-10-31", "2026-11-01"),
      ),
    ).toMatch(/no working days/);
  });

  it("allows VL up to what's left, counting pending requests", () => {
    const leaves = [
      leave("Vacation Leave", "2026-05-04", "2026-05-15", "Pending"),
    ]; // 10 held
    expect(
      checkLeaveCredits(
        job,
        leaves,
        request("Vacation Leave", "2026-11-02", "2026-11-06"),
      ),
    ).toBeNull(); // 5 of 5 left
    expect(
      checkLeaveCredits(
        job,
        leaves,
        request("Vacation Leave", "2026-11-02", "2026-11-09"),
      ),
    ).toBe("Not enough Vacation Leave: 5 days left, and this request needs 6.");
  });

  it("counts the January 1 credit for VL that starts in the new year", () => {
    const leaves = [leave("Vacation Leave", "2026-04-06", "2026-04-24")]; // 15 used
    expect(
      checkLeaveCredits(
        job,
        leaves,
        request("Vacation Leave", "2026-12-28", "2026-12-28"),
      ),
    ).toMatch(/0 days left/);
    expect(
      checkLeaveCredits(
        job,
        leaves,
        request("Vacation Leave", "2027-01-04", "2027-01-04"),
      ),
    ).toBeNull();
  });

  it("checks SL month by month, and not before the date of regularization", () => {
    // 14 SL days already in November
    const leaves = [leave("Sick Leave", "2026-11-02", "2026-11-19")];
    // Nov 30 (1 day in November) + Dec 1-2: fits
    expect(
      checkLeaveCredits(
        job,
        leaves,
        request("Sick Leave", "2026-11-30", "2026-12-02"),
      ),
    ).toBeNull();
    // Nov 26-27 (2 days in November): only 1 left
    expect(
      checkLeaveCredits(
        job,
        leaves,
        request("Sick Leave", "2026-11-26", "2026-11-27"),
      ),
    ).toBe(
      "Not enough Sick Leave for November 2026: 1 day left that month, and this request needs 2.",
    );
    expect(
      checkLeaveCredits(
        job,
        [],
        request("Sick Leave", "2026-03-13", "2026-03-16"),
      ),
    ).toMatch(/start on the date of regularization \(2026-03-16\)/);
  });
});
