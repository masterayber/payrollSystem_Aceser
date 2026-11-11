const {
  BASIC_PAY_REQUIRED,
  checkJobDetails,
  checkNewEmployeeJob,
  checkResignation,
} = require("../utils/jobDetails");

// Add Employee: basic pay is required, whoever adds (replaces rule 22)
describe("checkNewEmployeeJob", () => {
  it.each([[{}], [{ basicPay: undefined }], [{ basicPay: null }], [{ basicPay: "" }], [{ basicPay: "   " }], [undefined]])(
    "refuses %p as no basic pay",
    (body) => {
      expect(checkNewEmployeeJob(body)).toEqual({ error: BASIC_PAY_REQUIRED });
      expect(BASIC_PAY_REQUIRED).toBe("Basic pay is required.");
    },
  );

  it("checks the basic pay before the other job rules", () => {
    expect(checkNewEmployeeJob({ employmentType: "Regular" })).toEqual({
      error: BASIC_PAY_REQUIRED,
    });
  });

  it.each([-1, "abc", "-0.01"])("gives the usual message for %p", (basicPay) => {
    expect(checkNewEmployeeJob({ basicPay }).error).toBe(
      "Basic pay must be an amount of 0 or more.",
    );
  });

  it("then runs the usual job rules", () => {
    expect(
      checkNewEmployeeJob({ basicPay: 20000, employmentType: "Regular" }).error,
    ).toMatch(/date of regularization/);
  });

  it.each([
    [20000, 20000],
    ["15000.555", 15000.56],
    [0, 0],
    ["0", 0],
  ])("accepts %p as %p", (basicPay, stored) => {
    expect(checkNewEmployeeJob({ basicPay })).toEqual({
      fields: { basicPay: stored },
    });
  });
});

describe("checkJobDetails", () => {
  it("keeps basic pay as a number rounded to centavos", () => {
    expect(checkJobDetails({ basicPay: "25000.555" })).toEqual({
      fields: { basicPay: 25000.56 },
    });
  });

  it("keeps the VL opening balance as whole days (empty means 0)", () => {
    expect(checkJobDetails({ vacationLeaveOpening: "4" })).toEqual({
      fields: { vacationLeaveOpening: 4 },
    });
    expect(checkJobDetails({ vacationLeaveOpening: "" })).toEqual({
      fields: { vacationLeaveOpening: 0 },
    });
    expect(checkJobDetails({ vacationLeaveOpening: "2.5" }).error).toMatch(
      /whole number/,
    );
  });

  it("clears basic pay and the date when sent empty", () => {
    expect(checkJobDetails({ basicPay: "", regularizationDate: "" })).toEqual({
      fields: { basicPay: null, regularizationDate: null },
    });
  });

  it("rejects negative or non-number basic pay", () => {
    expect(checkJobDetails({ basicPay: -1 }).error).toMatch(/Basic pay/);
    expect(checkJobDetails({ basicPay: "abc" }).error).toMatch(/Basic pay/);
  });

  it("rejects a date that isn't YYYY-MM-DD", () => {
    expect(checkJobDetails({ regularizationDate: "10/26/2026" }).error).toMatch(
      /valid date/,
    );
    expect(checkJobDetails({ regularizationDate: "2026-13-40" }).error).toMatch(
      /valid date/,
    );
  });

  it("needs a date of regularization for a regular employee", () => {
    expect(checkJobDetails({ employmentType: "Regular" }).error).toMatch(
      /needs a date of regularization/,
    );
    expect(
      checkJobDetails({
        employmentType: "Regular",
        regularizationDate: "2026-10-26",
      }),
    ).toEqual({ fields: { regularizationDate: "2026-10-26" } });
  });

  it("uses the saved date when the edit doesn't send one", () => {
    const current = {
      employmentType: "Probationary",
      regularizationDate: new Date("2026-04-01"),
    };
    expect(checkJobDetails({ employmentType: "Regular" }, current)).toEqual({
      fields: {},
    });
  });

  it("rejects a date of regularization before the start date", () => {
    expect(
      checkJobDetails({
        startDate: "2026-05-01",
        regularizationDate: "2026-04-30",
      }).error,
    ).toMatch(/before the start date/);
  });

  it("skips the employment rules on a personal-details edit", () => {
    const current = { employmentType: "Regular", regularizationDate: null };
    expect(checkJobDetails({ contactNumber: "0917" }, current)).toEqual({
      fields: {},
    });
  });
});

describe("checkResignation", () => {
  it("keeps the date and a trimmed reason", () => {
    expect(
      checkResignation({
        resignationDate: "2026-10-30",
        resignationReason: "  Moving abroad ",
      }),
    ).toEqual({
      fields: {
        resignationDate: "2026-10-30",
        resignationReason: "Moving abroad",
      },
    });
  });

  it("needs a valid last working day", () => {
    expect(checkResignation({}).error).toMatch(/last working day/);
    expect(checkResignation({ resignationDate: "2026-02-30x" }).error).toMatch(
      /last working day/,
    );
  });

  it("rejects a last working day before the start date", () => {
    const job = { startDate: new Date("2026-05-01") };
    expect(
      checkResignation({ resignationDate: "2026-04-30" }, job).error,
    ).toMatch(/before the start date/);
  });
});
