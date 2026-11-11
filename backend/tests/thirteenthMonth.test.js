const {
  roundCentavos,
  yearColumns,
  isListed,
  cutoffShare,
  thirteenthMonth,
  reportTotals,
  checkYear,
} = require("../utils/thirteenthMonth");
const {
  payChangesToRecord,
  sortHistory,
  payInForce,
} = require("../utils/basicPayHistory");
const { PAY_HISTORY_START } = require("../config/payroll");

const TODAY = "2026-11-04";
const in2026 = (extra = {}) => ({ year: 2026, todayKey: TODAY, ...extra });
const in2027 = (todayKey, extra = {}) => ({ year: 2027, todayKey, ...extra });
const byCutoff = (result, value) =>
  result.cutoffs.find((cutoff) => cutoff.cutoff === value);
const kinds = (result) => result.cutoffs.map((cutoff) => cutoff.kind);
const amounts = (result) => result.cutoffs.map((cutoff) => cutoff.amount);

// 2026 parts used below (weekdays, Mon to Fri):
//   2026-01-yearEnd Jan 1 (Thu) to Jan 10: 7    2026-11-1st Nov 11 (Wed) to Nov 25: 11
//   2026-11-2nd Nov 26 to Dec 10: 11            2026-12-1st Dec 11 to Dec 25: 11
//   2026-12-yearEnd Dec 26 (Sat) to Dec 31: 4   so the year-end cut-off has 7 + 4 = 11
// Columns: 0 = Jan 1-10, 1 to 23 = Jan 1st to Dec 1st (19 = Oct 1st, 20 = Oct 2nd,
// 21 = Nov 1st), 24 = Dec 26-31. As of Nov 4, 2026, columns 0 to 19 have ended
// (computed); 20 (Oct 26 to Nov 10) to 24 are projected.

describe("roundCentavos", () => {
  it("rounds half a centavo up", () => {
    expect(roundCentavos(1.005)).toBe(1.01);
    expect(roundCentavos(1041.6666666)).toBe(1041.67);
    expect(roundCentavos(0)).toBe(0);
  });
});

describe("yearColumns", () => {
  const columns = yearColumns(2026);

  it("has 25 columns, the year-end parts first and last with the combined weekdays", () => {
    expect(columns).toHaveLength(25);
    expect(columns[0]).toEqual({
      cutoff: "2026-01-yearEnd",
      month: "2026-01",
      half: "yearEnd",
      start: "2026-01-01",
      end: "2026-01-10",
      weekdays: 7,
      cutoffWeekdays: 11,
    });
    expect(columns[24]).toEqual({
      cutoff: "2026-12-yearEnd",
      month: "2026-12",
      half: "yearEnd",
      start: "2026-12-26",
      end: "2026-12-31",
      weekdays: 4,
      cutoffWeekdays: 11,
    });
    expect(columns[21]).toEqual({
      cutoff: "2026-11-1st",
      month: "2026-11",
      half: "1st",
      start: "2026-11-11",
      end: "2026-11-25",
      weekdays: 11,
      cutoffWeekdays: 11,
    });
  });

  it("gives an ordinary cut-off its own weekdays", () => {
    for (const column of columns.slice(1, 24)) {
      expect(column.half).not.toBe("yearEnd");
      expect(column.cutoffWeekdays).toBe(column.weekdays);
    }
  });

  it("adds up the year-end parts of each year on their own (2027: 6 + 5)", () => {
    const columns2027 = yearColumns(2027);
    expect(columns2027[0]).toMatchObject({ weekdays: 6, cutoffWeekdays: 11 });
    expect(columns2027[24]).toMatchObject({ weekdays: 5, cutoffWeekdays: 11 });
  });
});

describe("cutoffShare", () => {
  const nov1st = { start: "2026-11-11", end: "2026-11-25" };
  const decYearEnd = yearColumns(2026)[24];

  it("is 1 for a whole cut-off and 0 outside the employment", () => {
    expect(cutoffShare({ startDate: "2020-01-01" }, nov1st)).toMatchObject({
      weekdays: 11,
      cutoffWeekdays: 11,
      weekdaysEmployed: 11,
      share: 1,
    });
    expect(cutoffShare({ startDate: "2026-12-01" }, nov1st).share).toBe(0);
    expect(
      cutoffShare(
        { startDate: "2020-01-01", resignationDate: "2026-11-10" },
        nov1st,
      ).share,
    ).toBe(0);
  });

  it("counts weekdays employed from a start on a weekend", () => {
    // Sat Nov 14: employed Mon Nov 16 to Wed Nov 25 = 8 of 11 weekdays
    expect(cutoffShare({ startDate: "2026-11-14" }, nov1st)).toMatchObject({
      weekdaysEmployed: 8,
      share: 8 / 11,
    });
  });

  it("divides a year-end part by the whole year-end cut-off's weekdays", () => {
    expect(cutoffShare({ startDate: "2020-01-01" }, decYearEnd)).toMatchObject({
      weekdays: 4,
      cutoffWeekdays: 11,
      weekdaysEmployed: 4,
      share: 4 / 11,
    });
  });

  it("is unknown without a start date", () => {
    expect(cutoffShare({}, nov1st)).toMatchObject({
      weekdays: 11,
      weekdaysEmployed: null,
      share: null,
    });
  });
});

describe("thirteenthMonth: worked examples (2026, as of Nov 4)", () => {
  it("Ana: P25,000 for the whole year comes to exactly P25,000.00", () => {
    const result = thirteenthMonth(
      { basicPay: 25000, startDate: "2023-03-01" },
      in2026(),
    );

    expect(result.cutoffs).toHaveLength(25);
    expect(kinds(result).slice(0, 20)).toEqual(Array(20).fill("computed"));
    expect(kinds(result).slice(20)).toEqual(Array(5).fill("projected"));
    // Jan 1-10: 7 of the year-end cut-off's 11 weekdays x 1,041.67
    expect(result.cutoffs[0]).toMatchObject({
      cutoff: "2026-01-yearEnd",
      weekdaysEmployed: 7,
      share: 7 / 11,
      amount: 662.88,
      kind: "computed",
    });
    expect(amounts(result).slice(1, 24)).toEqual(Array(23).fill(1041.67));
    expect(byCutoff(result, "2026-12-yearEnd")).toMatchObject({
      weekdays: 4,
      cutoffWeekdays: 11,
      weekdaysEmployed: 4,
      share: 4 / 11,
      amount: 378.79,
    });
    // 1,041.67 x (7/11 + 19) computed, 1,041.67 x (4 + 4/11) projected
    expect(result).toMatchObject({
      computed: 20454.55,
      projected: 4545.45,
      total: 25000,
      flags: [],
    });
    expect(result).not.toHaveProperty("opening");
    expect(result).not.toHaveProperty("openingNeeded");
  });

  it("Ben: P18,000 from Wed Nov 18: 750 x 6/11 + 750 + 750 + 750 x 4/11 = P2,181.82", () => {
    const result = thirteenthMonth(
      { basicPay: 18000, startDate: "2026-11-18" },
      in2026(),
    );

    expect(kinds(result).slice(0, 21)).toEqual(Array(21).fill("none"));
    expect(byCutoff(result, "2026-11-1st")).toMatchObject({
      weekdays: 11,
      cutoffWeekdays: 11,
      weekdaysEmployed: 6,
      share: 6 / 11,
      amount: 409.09,
      kind: "projected",
    });
    expect(byCutoff(result, "2026-12-yearEnd").amount).toBe(272.73);
    expect(result).toMatchObject({
      computed: 0,
      projected: 2181.82,
      total: 2181.82,
      flags: [],
    });
  });

  it("Carla: P30,000, last day Fri Dec 4: 1,250 x (7/11 + 21 + 7/11) = P27,840.91", () => {
    const result = thirteenthMonth(
      {
        basicPay: 30000,
        startDate: "2019-06-03",
        resignationDate: "2026-12-04",
      },
      in2026({ status: "Resigned" }),
    );

    expect(result.cutoffs[0].amount).toBe(795.45);
    expect(byCutoff(result, "2026-11-1st").amount).toBe(1250);
    expect(byCutoff(result, "2026-11-2nd")).toMatchObject({
      weekdaysEmployed: 7,
      cutoffWeekdays: 11,
      amount: 795.45,
      kind: "projected",
    });
    for (const value of ["2026-12-1st", "2026-12-yearEnd"]) {
      expect(byCutoff(result, value)).toMatchObject({
        kind: "none",
        share: 0,
        amount: 0,
      });
    }
    expect(result).toMatchObject({
      computed: 24545.45,
      projected: 3295.45,
      total: 27840.91,
      flags: [],
    });
  });

  it("Dan: P20,000 since 2021 needs nothing entered: P20,000.00", () => {
    const result = thirteenthMonth(
      { basicPay: 20000, startDate: "2021-02-01" },
      in2026(),
    );

    expect(result).toMatchObject({ total: 20000, flags: [] });
  });

  it("Eva: P20,000 raised to P22,000 from Dec 1 (pay history) comes to P20,174.24", () => {
    const history = [
      { amount: 20000, effectiveFrom: "2026-11-01" },
      { amount: 22000, effectiveFrom: "2026-12-01" },
    ];
    const result = thirteenthMonth(
      { basicPay: 22000, startDate: "2022-08-01" },
      in2026({ history }),
    );

    // Jan 1 to Nov 25 at 20,000 (before the first record, its amount)
    expect(result.cutoffs[0].amount).toBe(530.3);
    expect(amounts(result).slice(1, 22)).toEqual(Array(21).fill(833.33));
    expect(amounts(result).slice(22)).toEqual([
      893.94, // Nov 26-30 (3 days) at 20,000 + Dec 1-10 (8 days) at 22,000, / 11
      916.67, // Dec 11-25 at 22,000
      333.33, // Dec 26-31: 4/11 x 916.67
    ]);
    expect(result.total).toBe(20174.24);
  });
});

describe("thirteenthMonth: Ayber's 2026 accounts (as of Nov 5)", () => {
  const asOfNov5 = (extra = {}) => in2026({ todayKey: "2026-11-05", ...extra });

  it("wew: P20,000 since Aug 18, 2025, Active: P20,000.00", () => {
    const result = thirteenthMonth(
      { basicPay: 20000, startDate: "2025-08-18" },
      asOfNov5(),
    );

    expect(kinds(result)).toEqual([
      ...Array(20).fill("computed"),
      ...Array(5).fill("projected"),
    ]);
    expect(result).toMatchObject({
      computed: 16363.64,
      projected: 3636.36,
      total: 20000,
      flags: [],
    });
  });

  it("ako: P25,000 from Wed Sep 30, 2026, Active: 1,041.67 x (8/10 + 5 + 4/11) = P6,420.45", () => {
    const result = thirteenthMonth(
      { basicPay: 25000, startDate: "2026-09-30" },
      asOfNov5(),
    );

    expect(kinds(result).slice(0, 18)).toEqual(Array(18).fill("none"));
    // Sep 26 to Oct 10: 10 weekdays, employed Sep 30 to Oct 9 = 8
    expect(byCutoff(result, "2026-09-2nd")).toMatchObject({
      weekdays: 10,
      weekdaysEmployed: 8,
      amount: 833.33,
      kind: "computed",
    });
    expect(amounts(result).slice(19, 24)).toEqual(Array(5).fill(1041.67));
    expect(byCutoff(result, "2026-12-yearEnd").amount).toBe(378.79);
    // Unrounded 6,420.4545...: only the total is rounded
    expect(result).toMatchObject({
      computed: 1875,
      projected: 4545.45,
      total: 6420.45,
      flags: [],
    });
  });

  it("ivers: P18,000 from Thu Oct 1, last day Tue Oct 27, 2026, Resigned: 525 + 750 + 125 = P1,400.00", () => {
    const result = thirteenthMonth(
      {
        basicPay: 18000,
        startDate: "2026-10-01",
        resignationDate: "2026-10-27",
      },
      asOfNov5({ status: "Resigned" }),
    );

    // Sep 26 to Oct 10: 7 of 10 weekdays; Oct 11-25 whole; Oct 26 to Nov 10: 2 of 12
    expect(byCutoff(result, "2026-09-2nd")).toMatchObject({
      weekdaysEmployed: 7,
      amount: 525,
      kind: "computed",
    });
    expect(byCutoff(result, "2026-10-1st")).toMatchObject({
      amount: 750,
      kind: "computed",
    });
    expect(byCutoff(result, "2026-10-2nd")).toMatchObject({
      weekdays: 12,
      weekdaysEmployed: 2,
      amount: 125,
      // The cut-off ends Nov 10, but the last working day (Oct 27) has passed
      kind: "computed",
    });
    expect(kinds(result).slice(21)).toEqual(Array(4).fill("none"));
    expect(result).toMatchObject({
      computed: 1400,
      projected: 0,
      total: 1400,
      flags: [],
    });
  });

  it("ivers: the cut-off with the last working day is projected on that day, computed the day after", () => {
    const ivers = {
      basicPay: 18000,
      startDate: "2026-10-01",
      resignationDate: "2026-10-27",
    };
    const onLastDay = thirteenthMonth(
      ivers,
      in2026({ todayKey: "2026-10-27", status: "Resigned" }),
    );
    const dayAfter = thirteenthMonth(
      ivers,
      in2026({ todayKey: "2026-10-28", status: "Resigned" }),
    );

    expect(byCutoff(onLastDay, "2026-10-2nd")).toMatchObject({
      amount: 125,
      kind: "projected",
    });
    expect(onLastDay).toMatchObject({
      computed: 1275,
      projected: 125,
      total: 1400,
    });
    expect(byCutoff(dayAfter, "2026-10-2nd")).toMatchObject({
      amount: 125,
      kind: "computed",
    });
    expect(dayAfter).toMatchObject({ computed: 1400, projected: 0, total: 1400 });
  });

  it("a Resigned employee whose last working day is still ahead keeps the current cut-off projected", () => {
    // Last working day Fri Nov 6: Oct 26 to Nov 10 has 10 of 12 weekdays employed
    const result = thirteenthMonth(
      {
        basicPay: 18000,
        startDate: "2026-10-01",
        resignationDate: "2026-11-06",
      },
      asOfNov5({ status: "Resigned" }),
    );

    expect(byCutoff(result, "2026-10-2nd")).toMatchObject({
      weekdaysEmployed: 10,
      amount: 625,
      kind: "projected",
    });
    expect(kinds(result).slice(21)).toEqual(Array(4).fill("none"));
    expect(result).toMatchObject({ computed: 1275, projected: 625 });
  });

  it("the totals row: computed P19,638.64 + projected P8,181.81 = P27,820.45", () => {
    const rows = [
      thirteenthMonth({ basicPay: 20000, startDate: "2025-08-18" }, asOfNov5()),
      thirteenthMonth({ basicPay: 25000, startDate: "2026-09-30" }, asOfNov5()),
      thirteenthMonth(
        {
          basicPay: 18000,
          startDate: "2026-10-01",
          resignationDate: "2026-10-27",
        },
        asOfNov5({ status: "Resigned" }),
      ),
    ];

    // 16,363.64 + 1,875 + 1,400 computed; 3,636.36 + 4,545.45 + 0 projected
    expect(reportTotals(rows, 25)).toMatchObject({
      employees: 3,
      computed: 19638.64,
      projected: 8181.81,
      total: 27820.45,
    });
  });
});

describe("thirteenthMonth: from 2027 (all 25 parts count)", () => {
  it("a full year is exactly one month's basic", () => {
    const result = thirteenthMonth(
      { basicPay: 25000, startDate: "2020-01-06" },
      in2027("2028-01-15"),
    );

    expect(result.cutoffs).toHaveLength(25);
    expect(kinds(result)).toEqual(Array(25).fill("computed"));
    expect(result).toMatchObject({
      computed: 25000,
      projected: 0,
      total: 25000,
      flags: [],
    });
  });

  it("a joiner on Tue Jan 5, 2027 earns basic / 24 x (23 + 9/11)", () => {
    // Jan 1-10, 2027: 6 weekdays (Fri Jan 1, Jan 4-8), employed Jan 5-8 = 4.
    // Dec 26-31, 2027: 5 weekdays (Dec 27-31), all employed. 4 + 5 = 9 of 11.
    // P24,000 = 1,000 a cut-off: 23,000 + 1,000 x 9/11 = 23,818.18
    const job = { basicPay: 24000, startDate: "2027-01-05" };
    const result = thirteenthMonth(job, in2027("2028-01-15"));

    expect(byCutoff(result, "2027-01-yearEnd")).toMatchObject({
      weekdays: 6,
      cutoffWeekdays: 11,
      weekdaysEmployed: 4,
      amount: 363.64,
      kind: "computed",
    });
    expect(byCutoff(result, "2027-12-yearEnd")).toMatchObject({
      weekdays: 5,
      cutoffWeekdays: 11,
      weekdaysEmployed: 5,
      amount: 454.55,
    });
    expect(result.total).toBe(23818.18);

    // Jan 1-10 belongs to the new year: the same person isn't in 2026's report
    const account = { role: "Employee", status: "Active" };
    expect(isListed(account, job, 2026)).toBe(false);
    expect(isListed(account, job, 2027)).toBe(true);
  });

  it("a mid-year joiner earns from the start date", () => {
    // P24,000 = 1,000 a cut-off. Start Wed 2027-07-14. 2027-07-1st (Sun Jul 11 to Sun
    // Jul 25) has 10 weekdays; employed Jul 14-16 and 19-23 = 8 -> 800. Then Jul 2nd to
    // Dec 1st = 10 whole cut-offs, and Dec 26-31 = 5/11 -> 454.55. Total 11,254.55.
    const result = thirteenthMonth(
      { basicPay: 24000, startDate: "2027-07-14" },
      in2027("2028-01-15"),
    );

    expect(kinds(result).slice(0, 13)).toEqual(Array(13).fill("none"));
    expect(byCutoff(result, "2027-07-1st")).toMatchObject({
      weekdays: 10,
      weekdaysEmployed: 8,
      amount: 800,
      kind: "computed",
    });
    expect(result.total).toBe(11254.55);
  });

  it("a last working day of Jan 7, 2027 counts in 2027 only", () => {
    const job = {
      basicPay: 24000,
      startDate: "2020-01-06",
      resignationDate: "2027-01-07",
    };
    const resigned = { role: "Employee", status: "Resigned" };
    expect(isListed(resigned, job, 2026)).toBe(false);
    expect(isListed(resigned, job, 2027)).toBe(true);

    // Employed Fri Jan 1 and Jan 4-7 = 5 of the year-end cut-off's 11 weekdays
    const result = thirteenthMonth(
      job,
      in2027("2027-02-01", { status: "Resigned" }),
    );
    expect(byCutoff(result, "2027-01-yearEnd")).toMatchObject({
      weekdaysEmployed: 5,
      amount: 454.55,
      kind: "computed",
    });
    expect(kinds(result).slice(1)).toEqual(Array(24).fill("none"));
    expect(result.total).toBe(454.55);
  });

  it("is partly projected during the year", () => {
    // As of Jun 30, 2027: Jan 1-10 and Jan 1st to Jun 1st (ends Jun 25) have ended =
    // 1 + 11 parts computed; Jun 2nd (ends Jul 10) onwards = 13 projected.
    // Computed: 6/11 + 11 cut-offs = 1,041.67 x 11.5454... = 12,026.52
    const result = thirteenthMonth(
      { basicPay: 25000, startDate: "2020-01-06" },
      in2027("2027-06-30"),
    );

    expect(kinds(result).filter((kind) => kind === "computed")).toHaveLength(12);
    expect(byCutoff(result, "2027-06-1st").kind).toBe("computed");
    expect(byCutoff(result, "2027-06-2nd").kind).toBe("projected");
    expect(result).toMatchObject({
      computed: 12026.52,
      projected: 12973.48,
      total: 25000,
    });
  });
});

describe("thirteenthMonth: computed or projected", () => {
  it("an ordinary cut-off is projected on its last day and computed the day after", () => {
    const job = { basicPay: 25000, startDate: "2026-11-11" };
    const onEnd = thirteenthMonth(job, in2026({ todayKey: "2026-11-25" }));
    const dayAfter = thirteenthMonth(job, in2026({ todayKey: "2026-11-26" }));

    expect(byCutoff(onEnd, "2026-11-1st").kind).toBe("projected");
    expect(onEnd).toMatchObject({ computed: 0, projected: 3503.79 });
    expect(byCutoff(dayAfter, "2026-11-1st").kind).toBe("computed");
    expect(byCutoff(dayAfter, "2026-11-2nd").kind).toBe("projected");
    expect(dayAfter).toMatchObject({ computed: 1041.67, projected: 2462.12 });
    expect(dayAfter.total).toBe(3503.79);
  });

  it("the Jan 1-10 part is computed from Jan 11", () => {
    const job = { basicPay: 24000, startDate: "2020-01-06" };
    const jan10 = thirteenthMonth(job, in2027("2027-01-10"));
    const jan11 = thirteenthMonth(job, in2027("2027-01-11"));

    expect(byCutoff(jan10, "2027-01-yearEnd").kind).toBe("projected");
    expect(jan10.computed).toBe(0);
    expect(byCutoff(jan11, "2027-01-yearEnd").kind).toBe("computed");
    expect(jan11.computed).toBe(545.45); // 1,000 x 6/11
  });

  it("the Dec 26-31 part is computed from Jan 1 of the next year", () => {
    const job = { basicPay: 24000, startDate: "2020-01-06" };
    const dec31 = thirteenthMonth(job, in2027("2027-12-31"));
    const jan1 = thirteenthMonth(job, in2027("2028-01-01"));

    expect(byCutoff(dec31, "2027-12-yearEnd").kind).toBe("projected");
    expect(byCutoff(dec31, "2027-12-1st").kind).toBe("computed");
    expect(dec31.projected).toBe(454.55); // 1,000 x 5/11
    expect(byCutoff(jan1, "2027-12-yearEnd").kind).toBe("computed");
    expect(jan1).toMatchObject({ computed: 24000, projected: 0 });
  });

  it("only ever uses the kinds computed, projected and none", () => {
    const results = [
      thirteenthMonth({ basicPay: 25000, startDate: "2023-03-01" }, in2026()),
      thirteenthMonth({ basicPay: 18000, startDate: "2026-11-18" }, in2026()),
      thirteenthMonth({ basicPay: 25000 }, in2026()),
    ];
    for (const result of results) {
      for (const kind of kinds(result)) {
        expect(["computed", "projected", "none"]).toContain(kind);
      }
    }
  });
});

describe("thirteenthMonth: basic pay history", () => {
  it("a raise in the middle of a cut-off, recorded with no history before it", () => {
    // P20,000 since 2022, raised to P22,000 on Wed Nov 18, 2026: the first change
    // records the old pay from the day pay history began (later than the start date)
    // and the new from today
    const history = payChangesToRecord({
      oldPay: 20000,
      newPay: 22000,
      hasHistory: false,
      startDate: "2022-08-01",
      todayKey: "2026-11-18",
    });
    expect(history).toEqual([
      { amount: 20000, effectiveFrom: PAY_HISTORY_START },
      { amount: 22000, effectiveFrom: "2026-11-18" },
    ]);

    const result = thirteenthMonth(
      { basicPay: 22000, startDate: "2022-08-01" },
      in2026({ todayKey: "2026-11-18", history }),
    );
    // Jan 1 to Nov 17 at 20,000 (Jan 1 to Nov 3 are before the first record: its amount)
    expect(result.cutoffs[0].amount).toBe(530.3);
    expect(amounts(result).slice(1, 21)).toEqual(Array(20).fill(833.33));
    // Nov 11-25: 5 days (Nov 11-13, 16-17) at 20,000, 6 days (Nov 18-25) at 22,000
    // (5 x 833.33 + 6 x 916.67) / 11 = 878.79
    expect(amounts(result).slice(21)).toEqual([878.79, 916.67, 916.67, 333.33]);
    expect(result.total).toBe(20242.42);
  });

  it("uses the current basic pay for every day of the year with no history", () => {
    const result = thirteenthMonth(
      { basicPay: 22000, startDate: "2022-08-01" },
      in2026({ history: [] }),
    );
    // Jan 1-10: 7/11 x 916.67; Jan to Oct cut-offs at 22,000 too
    expect(result.cutoffs[0].amount).toBe(583.33);
    expect(amounts(result).slice(1, 24)).toEqual(Array(23).fill(916.67));
    expect(result.cutoffs[24].amount).toBe(333.33);
    expect(result.total).toBe(22000);
  });

  it("uses the first record's amount for Jan to Oct, not the current pay", () => {
    // Raised to P22,000 on Dec 1; the first record (P20,000 from Nov 4) covers every
    // earlier day of the year
    const result = thirteenthMonth(
      { basicPay: 22000, startDate: "2022-08-01" },
      in2026({
        history: [
          { amount: 20000, effectiveFrom: PAY_HISTORY_START },
          { amount: 22000, effectiveFrom: "2026-12-01" },
        ],
      }),
    );
    expect(byCutoff(result, "2026-01-yearEnd").amount).toBe(530.3);
    for (const month of ["01", "04", "07", "10"]) {
      expect(byCutoff(result, `2026-${month}-1st`).amount).toBe(833.33);
      expect(byCutoff(result, `2026-${month}-2nd`).amount).toBe(833.33);
    }
    expect(byCutoff(result, "2026-12-1st").amount).toBe(916.67);
  });

  it("uses the first entry's amount before the first entry", () => {
    // History only from Dec 1: Nov uses the first entry's P22,000
    const result = thirteenthMonth(
      { basicPay: 22000, startDate: "2026-11-11" },
      in2026({ history: [{ amount: 22000, effectiveFrom: "2026-12-01" }] }),
    );
    expect(byCutoff(result, "2026-11-1st").amount).toBe(916.67);
  });

  it("is still flagged NO_BASIC_PAY when the current pay is cleared", () => {
    const result = thirteenthMonth(
      { basicPay: null, startDate: "2026-11-11" },
      in2026({ history: [{ amount: 22000, effectiveFrom: "2026-11-01" }] }),
    );
    expect(result.flags).toEqual(["NO_BASIC_PAY"]);
    expect(result.total).toBeNull();
    expect(result.cutoffs[21].amount).toBeNull();
  });

  it("a sign-up's first real pay covers the days before it was saved", () => {
    // Started Tue Nov 3 on the sign-up's 0 ("Pay needs an update"); P18,000 saved Wed
    // Nov 11. Only the new pay is recorded, so Nov 3 to 10 are at P18,000 too.
    const history = payChangesToRecord({
      oldPay: 0,
      payWasNotSet: true,
      newPay: 18000,
      hasHistory: false,
      startDate: "2026-11-03",
      todayKey: "2026-11-11",
    });
    expect(history).toEqual([{ amount: 18000, effectiveFrom: "2026-11-11" }]);

    const result = thirteenthMonth(
      { basicPay: 18000, payNotSet: false, startDate: "2026-11-03" },
      in2026({ todayKey: "2026-11-11", history }),
    );
    // Oct 26 to Nov 10: 6 of 12 weekdays (Nov 3-6, 9-10) x 750 = 375 (not 0)
    expect(byCutoff(result, "2026-10-2nd")).toMatchObject({
      weekdaysEmployed: 6,
      amount: 375,
      kind: "computed",
    });
    // Nov 11 to 25: the full share, 18,000 / 24
    expect(byCutoff(result, "2026-11-1st")).toMatchObject({ share: 1, amount: 750 });
    // 375 + 3 x 750 + 4/11 x 750
    expect(result).toMatchObject({
      computed: 375,
      projected: 2522.73,
      total: 2897.73,
      flags: [],
    });

    // Recording the 0 (as for an ordinary pay change) would have left Nov 3 to 10 at 0
    const asChange = payChangesToRecord({
      oldPay: 0,
      newPay: 18000,
      hasHistory: false,
      startDate: "2026-11-03",
      todayKey: "2026-11-11",
    });
    expect(asChange[0]).toEqual({ amount: 0, effectiveFrom: PAY_HISTORY_START });
    const wrong = thirteenthMonth(
      { basicPay: 18000, startDate: "2026-11-03" },
      in2026({ todayKey: "2026-11-11", history: asChange }),
    );
    expect(byCutoff(wrong, "2026-10-2nd").amount).toBe(0);
  });

  it("two changes on the same day: the later one wins", () => {
    const history = [
      {
        amount: 20000,
        effectiveFrom: "2026-11-01",
        changedAt: "2026-11-01T01:00:00Z",
      },
      {
        amount: 30000,
        effectiveFrom: "2026-11-11",
        changedAt: "2026-11-11T02:00:00Z",
      },
      {
        amount: 24000,
        effectiveFrom: "2026-11-11",
        changedAt: "2026-11-11T05:00:00Z",
      },
    ];
    const result = thirteenthMonth(
      { basicPay: 24000, startDate: "2026-11-11" },
      in2026({ history }),
    );
    expect(byCutoff(result, "2026-11-1st").amount).toBe(1000);
  });
});

describe("thirteenthMonth: edge cases", () => {
  it("a start on a weekend counts from the next Monday", () => {
    const result = thirteenthMonth(
      { basicPay: 24000, startDate: "2026-11-14" }, // Sat
      in2026(),
    );
    // 1,000 x 8/11 + 2 x 1,000 + 1,000 x 4/11 = 3,090.91
    expect(byCutoff(result, "2026-11-1st").weekdaysEmployed).toBe(8);
    expect(result.total).toBe(3090.91);
  });

  it("a last working day of Fri Sep 18 stops the count there", () => {
    // P25,000: Jan 1-10 (7/11), Jan 1st to Aug 2nd (16 cut-offs), Sep 11-25: Sep 11 and
    // 14-18 = 6 of 11. 1,041.67 x (7/11 + 16 + 6/11) = 17,897.73
    const result = thirteenthMonth(
      {
        basicPay: 25000,
        startDate: "2024-02-01",
        resignationDate: "2026-09-18",
      },
      in2026({ status: "Resigned" }),
    );

    expect(byCutoff(result, "2026-09-1st")).toMatchObject({
      weekdaysEmployed: 6,
      amount: 568.18,
      kind: "computed",
    });
    expect(kinds(result).slice(18)).toEqual(Array(7).fill("none"));
    expect(result).toMatchObject({
      computed: 17897.73,
      projected: 0,
      total: 17897.73,
      flags: [],
    });
  });

  it("has no amounts without a basic pay", () => {
    const result = thirteenthMonth(
      { basicPay: null, startDate: "2020-01-01" },
      in2026(),
    );

    expect(result.flags).toEqual(["NO_BASIC_PAY"]);
    expect(result.cutoffs.every((cutoff) => cutoff.amount === null)).toBe(true);
    expect(result.cutoffs[21].share).toBe(1);
    expect(result).toMatchObject({
      computed: null,
      projected: null,
      total: null,
    });
  });

  it("treats a sign-up still marked Pay needs an update as having no basic pay", () => {
    const result = thirteenthMonth(
      { basicPay: 0, payNotSet: true, startDate: "2026-11-03" },
      in2026(),
    );

    expect(result.flags).toEqual(["NO_BASIC_PAY"]);
    expect(result.cutoffs.every((cutoff) => cutoff.amount === null)).toBe(true);
    expect(byCutoff(result, "2026-11-1st").share).toBe(1);
    expect(result).toMatchObject({ computed: null, projected: null, total: null });

    // Whatever amount is stored with the flag, and alongside the other flags
    expect(
      thirteenthMonth({ basicPay: 18000, payNotSet: true, startDate: "2026-11-03" }, in2026())
        .flags,
    ).toEqual(["NO_BASIC_PAY"]);
    expect(thirteenthMonth({ basicPay: 0, payNotSet: true }, in2026()).flags).toEqual([
      "NO_BASIC_PAY",
      "NO_START_DATE",
    ]);
  });

  it("counts a saved basic pay of 0 (flag cleared) as a pay", () => {
    const result = thirteenthMonth(
      { basicPay: 0, payNotSet: false, startDate: "2026-11-03" },
      in2026(),
    );
    expect(result).toMatchObject({ computed: 0, projected: 0, total: 0, flags: [] });
  });

  it("has no amounts or shares without a start date", () => {
    const result = thirteenthMonth({ basicPay: 25000 }, in2026());

    expect(result.flags).toEqual(["NO_START_DATE"]);
    expect(result.cutoffs[21]).toMatchObject({
      weekdays: 11,
      cutoffWeekdays: 11,
      share: null,
      weekdaysEmployed: null,
      amount: null,
      kind: "projected",
    });
    expect(result).toMatchObject({ computed: null, projected: null, total: null });
  });

  it("has no amounts for a Resigned account with no last working day", () => {
    const result = thirteenthMonth(
      { basicPay: 25000, startDate: "2020-01-01" },
      in2026({ status: "Resigned" }),
    );

    expect(result.flags).toEqual(["NO_LAST_DAY"]);
    expect(result.cutoffs[21].amount).toBeNull();
    expect(result.total).toBeNull();
  });

  it("ignores a last working day on an Active account", () => {
    const result = thirteenthMonth(
      {
        basicPay: 25000,
        startDate: "2020-01-01",
        resignationDate: "2026-11-13",
      },
      in2026({ status: "Active" }),
    );
    expect(result.total).toBe(25000);
  });

  it("rounds only the final amounts", () => {
    // P10,000 = 416.666... a cut-off: 3 x 416.666... + 4/11 x 416.666... = 1,401.515...
    // = 1,401.52 (rounding each part first would give 3 x 416.67 + 151.52 = 1,401.53)
    const result = thirteenthMonth(
      { basicPay: 10000, startDate: "2026-11-11" },
      in2026(),
    );
    expect(result.cutoffs[21].amount).toBe(416.67);
    expect(result.cutoffs[24].amount).toBe(151.52);
    expect(result.projected).toBe(1401.52);
    expect(result.total).toBe(1401.52);
  });
});

describe("payChangesToRecord", () => {
  const change = (extra) =>
    payChangesToRecord({
      oldPay: 20000,
      newPay: 22000,
      hasHistory: false,
      startDate: "2022-08-01",
      todayKey: "2026-11-18",
      ...extra,
    });

  it("pay history starts on Nov 4, 2026", () => {
    expect(PAY_HISTORY_START).toBe("2026-11-04");
  });

  it("seeds the old pay from the day pay history began on the first change", () => {
    expect(change()).toEqual([
      { amount: 20000, effectiveFrom: "2026-11-04" },
      { amount: 22000, effectiveFrom: "2026-11-18" },
    ]);
    expect(change({ startDate: "2026-11-02" })[0].effectiveFrom).toBe(
      "2026-11-04",
    );
  });

  it("takes another history start day when given one", () => {
    expect(change({ historyStartKey: "2026-11-10" })[0].effectiveFrom).toBe(
      "2026-11-10",
    );
  });

  it("seeds the old pay from the start date when that is later", () => {
    expect(change({ startDate: "2026-11-09" })[0]).toEqual({
      amount: 20000,
      effectiveFrom: "2026-11-09",
    });
    expect(change({ startDate: new Date("2026-11-09T00:00:00Z") })[0]).toEqual({
      amount: 20000,
      effectiveFrom: "2026-11-09",
    });
  });

  it("seeds from the history start without a start date", () => {
    expect(change({ startDate: null })[0].effectiveFrom).toBe("2026-11-04");
  });

  it("doesn't seed when the start date is today or later", () => {
    expect(change({ startDate: "2026-11-18" })).toEqual([
      { amount: 22000, effectiveFrom: "2026-11-18" },
    ]);
    expect(change({ startDate: "2026-12-01" })).toEqual([
      { amount: 22000, effectiveFrom: "2026-11-18" },
    ]);
  });

  it("records only the new pay when there is history or no old pay", () => {
    expect(change({ hasHistory: true })).toEqual([
      { amount: 22000, effectiveFrom: "2026-11-18" },
    ]);
    expect(change({ oldPay: null })).toEqual([
      { amount: 22000, effectiveFrom: "2026-11-18" },
    ]);
    expect(change({ oldPay: undefined })).toEqual([
      { amount: 22000, effectiveFrom: "2026-11-18" },
    ]);
  });

  it("records nothing for an unchanged or cleared pay", () => {
    expect(change({ newPay: 20000 })).toEqual([]);
    expect(change({ newPay: null })).toEqual([]);
  });

  it("records only the new pay when the old one was a sign-up's starting pay", () => {
    const signUp = (extra) =>
      change({ oldPay: 0, payWasNotSet: true, startDate: "2026-11-09", ...extra });
    expect(signUp()).toEqual([{ amount: 22000, effectiveFrom: "2026-11-18" }]);
    // Even the same 0: it is now a saved pay
    expect(signUp({ newPay: 0 })).toEqual([{ amount: 0, effectiveFrom: "2026-11-18" }]);
    expect(signUp({ newPay: null })).toEqual([]);
  });

  it("still seeds the old pay from the start date when the flag is false", () => {
    expect(change({ startDate: "2026-11-09", payWasNotSet: false })).toEqual([
      { amount: 20000, effectiveFrom: "2026-11-09" },
      { amount: 22000, effectiveFrom: "2026-11-18" },
    ]);
  });
});

describe("sortHistory and payInForce", () => {
  it("sorts by day, keeps the later change of a day, and reads Date days", () => {
    expect(
      sortHistory([
        {
          amount: 22000,
          effectiveFrom: new Date("2026-12-01T00:00:00Z"),
          changedAt: new Date("2026-12-01T03:00:00Z"),
        },
        {
          amount: 21000,
          effectiveFrom: "2026-12-01",
          changedAt: "2026-12-01T01:00:00Z",
        },
        { amount: 20000, effectiveFrom: "2026-11-01" },
      ]),
    ).toEqual([
      { amount: 20000, effectiveFrom: "2026-11-01" },
      { amount: 22000, effectiveFrom: "2026-12-01" },
    ]);
  });

  it("gives the latest pay on or before the day, the first before any entry (Jan to Oct too)", () => {
    const payOn = payInForce(
      [
        { amount: 22000, effectiveFrom: "2026-12-01" },
        { amount: 20000, effectiveFrom: "2026-11-04" },
      ],
      22000,
    );
    expect(payOn("2026-01-01")).toBe(20000);
    expect(payOn("2026-05-15")).toBe(20000);
    expect(payOn("2026-10-30")).toBe(20000);
    expect(payOn("2026-11-03")).toBe(20000);
    expect(payOn("2026-11-30")).toBe(20000);
    expect(payOn("2026-12-01")).toBe(22000);
    expect(payOn("2027-06-01")).toBe(22000);
  });

  it("gives the current pay with no history, on any day of the year", () => {
    expect(payInForce([], 18000)("2026-01-02")).toBe(18000);
    expect(payInForce([], 18000)("2026-11-20")).toBe(18000);
    expect(payInForce(undefined, 18000)("2026-11-20")).toBe(18000);
  });
});

describe("reportTotals", () => {
  it("counts and adds up the rows that aren't blocked only", () => {
    const row = (total, cutoffAmounts) => ({
      computed: 10,
      projected: 20,
      total,
      cutoffs: cutoffAmounts.map((amount) => ({ amount })),
    });
    const totals = reportTotals(
      [row(30, [1, 2]), row(30.5, [3, null]), row(null, [50, 50])],
      2,
    );

    expect(totals).toEqual({
      employees: 2,
      computed: 20,
      projected: 40,
      total: 60.5,
      byCutoff: [4, 2],
    });
  });

  it("is all zeros with no complete rows", () => {
    expect(reportTotals([], 25)).toEqual({
      employees: 0,
      computed: 0,
      projected: 0,
      total: 0,
      byCutoff: Array(25).fill(0),
    });
  });
});

describe("isListed (calendar year)", () => {
  const active = { role: "Employee", status: "Active" };
  const resigned = { role: "Employee", status: "Resigned" };

  it("lists Active employees who started on or before Dec 31", () => {
    expect(isListed(active, { startDate: "2020-01-01" }, 2026)).toBe(true);
    expect(isListed(active, { startDate: "2026-12-31" }, 2026)).toBe(true);
    expect(isListed(active, { startDate: "2027-01-01" }, 2026)).toBe(false);
    expect(isListed(active, {}, 2026)).toBe(true);
  });

  it("lists Resigned employees whose last working day is from Jan 1 to Dec 31", () => {
    const job = (resignationDate) => ({
      startDate: "2020-01-01",
      resignationDate,
    });
    expect(isListed(resigned, job("2026-09-18"), 2026)).toBe(true);
    expect(isListed(resigned, job("2025-12-31"), 2026)).toBe(false);
    expect(isListed(resigned, job("2026-01-01"), 2026)).toBe(true);
    expect(isListed(resigned, job("2026-01-10"), 2026)).toBe(true);
    expect(isListed(resigned, job("2026-12-31"), 2026)).toBe(true);
    expect(isListed(resigned, job("2027-01-01"), 2026)).toBe(false);
    expect(isListed(resigned, job("2027-01-01"), 2027)).toBe(true);
  });

  it("lists a Resigned account with no last working day in every year", () => {
    expect(isListed(resigned, { startDate: "2020-01-01" }, 2026)).toBe(true);
    expect(isListed(resigned, { startDate: "2020-01-01" }, 2027)).toBe(true);
  });

  it("never lists admins, Pending or Inactive accounts", () => {
    const job = { startDate: "2020-01-01" };
    expect(isListed({ role: "Admin", status: "Active" }, job, 2026)).toBe(false);
    expect(isListed({ role: "Employee", status: "Pending" }, job, 2026)).toBe(
      false,
    );
    expect(isListed({ role: "Employee", status: "Inactive" }, job, 2026)).toBe(
      false,
    );
  });
});

describe("checkYear", () => {
  it("defaults to the current year", () => {
    expect(checkYear(undefined, 2026)).toEqual({ year: 2026 });
    expect(checkYear("", 2027)).toEqual({ year: 2027 });
  });

  it("accepts 2026 to the current year", () => {
    expect(checkYear("2026", 2027)).toEqual({ year: 2026 });
    expect(checkYear("2027", 2027)).toEqual({ year: 2027 });
  });

  it.each(["2025", "2027", "abc", "2026.5", "26"])("refuses %s", (value) => {
    expect(checkYear(value, 2026)).toEqual({
      error: "Year must be from 2026 to 2026.",
    });
  });
});
