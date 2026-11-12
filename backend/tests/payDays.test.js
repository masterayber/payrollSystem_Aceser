// Pay days (backend/utils/payDays.js, rule 6 of the deductions plan): what each day of a
// cut-off is for pay. One table of days is run against the server's rule and against the
// attendance sheet's (frontend/src/utils/reports/leaveCodes.js), so a day is unpaid on a
// payslip exactly when the sheet shows LWOP for it.
import {
  HOLIDAY,
  getLeaveMark,
  isUnfiledAbsence,
} from "../../frontend/src/utils/reports/leaveCodes";
import { isNotEmployedOn } from "../../frontend/src/utils/reports/reportHelpers";

const {
  DAY_KINDS,
  PAID_KINDS,
  UNPAID_KINDS,
  isPaidKind,
  isUnpaidKind,
  isPaidLeaveType,
  employmentKeys,
  employedWeekdays,
  payDayKind,
  classifyPayDays,
} = require("../utils/payDays");
const { LEAVE_TYPES } = require("../config/leaveTypes");
const { HOLIDAY_TYPES } = require("../config/holidays");
const { cutoffShare, thirteenthMonth } = require("../utils/thirteenthMonth");
const { manilaToday, weekdaysBetween } = require("../utils/leaveCredits");

const {
  WEEKEND,
  NOT_EMPLOYED,
  HOLIDAY: HOLIDAY_KIND,
  WORKED,
  PAID_LEAVE,
  UNPAID_LEAVE,
  ABSENT,
  NO_RECORD,
  UNDECIDED,
} = DAY_KINDS;

const LWOP = "Leave Without Pay (LWOP)";
const VL = "Vacation Leave";

// Thursday, November 12, 2026
const TODAY = "2026-11-12";
const YESTERDAY = "2026-11-11";
const TOMORROW = "2026-11-13";
// A past Tuesday, the Saturday and Sunday before it
const WEEKDAY = "2026-10-20";
const SATURDAY = "2026-10-17";
const SUNDAY = "2026-10-18";

// Attendance rows as the API sends them
const worked = (behavior = "On-Time") => ({
  behavior,
  leaveType: null,
  timeIn: "08:00:00",
  timeOut: "17:00:00",
});
const timeInOnly = { ...worked("No Time-Out"), timeOut: null };
const timeOutOnly = { ...worked("No Time-In"), timeIn: null };
const noTimes = (behavior, leaveType = null) => ({
  behavior,
  leaveType,
  timeIn: null,
  timeOut: null,
});
const onLeave = (leaveType) => noTimes("On-Leave", leaveType);
const absent = noTimes("Absent");
const pending = noTimes("Pending");

const REGULAR = { type: "Regular", name: "Regular Holiday" };
const SPECIAL = { type: "Special Non-Working", name: "Special Day" };
const WORKING = { type: "Special Working", name: "Special Working Day" };

// One day each: [what it is, { dateKey, record, holiday, isNotEmployed, todayKey }, the
// kind]. Today is Thursday 2026-11-12 unless the case says otherwise.
const CASES = [
  // 1. Saturday and Sunday: never a paid or an unpaid day
  ["a Saturday with no row", { dateKey: SATURDAY }, WEEKEND],
  ["a Sunday with no row", { dateKey: SUNDAY }, WEEKEND],
  [
    "a Saturday with an Absent row",
    { dateKey: SATURDAY, record: absent },
    WEEKEND,
  ],
  [
    "a Saturday that was worked",
    { dateKey: SATURDAY, record: worked() },
    WEEKEND,
  ],
  [
    "a Saturday inside an approved LWOP",
    { dateKey: SATURDAY, record: onLeave(LWOP) },
    WEEKEND,
  ],
  [
    "a Sunday inside an approved Vacation Leave",
    { dateKey: SUNDAY, record: onLeave(VL) },
    WEEKEND,
  ],
  [
    "a Regular holiday on a Saturday with no row",
    { dateKey: SATURDAY, holiday: REGULAR },
    WEEKEND,
  ],
  [
    "a Special Non-Working holiday on a Sunday with an Absent row",
    { dateKey: SUNDAY, holiday: SPECIAL, record: absent },
    WEEKEND,
  ],
  [
    "a Saturday outside the employment",
    { dateKey: SATURDAY, isNotEmployed: true },
    WEEKEND,
  ],

  // 2. Not employed: no pay, whatever the row or the holiday
  [
    "a weekday outside the employment with no row",
    { dateKey: WEEKDAY, isNotEmployed: true },
    NOT_EMPLOYED,
  ],
  [
    "a weekday outside the employment with an Absent row",
    { dateKey: WEEKDAY, isNotEmployed: true, record: absent },
    NOT_EMPLOYED,
  ],
  [
    "a weekday outside the employment with an approved LWOP",
    { dateKey: WEEKDAY, isNotEmployed: true, record: onLeave(LWOP) },
    NOT_EMPLOYED,
  ],
  [
    "a weekday outside the employment with a worked row",
    { dateKey: WEEKDAY, isNotEmployed: true, record: worked() },
    NOT_EMPLOYED,
  ],
  [
    "a holiday outside the employment",
    { dateKey: WEEKDAY, isNotEmployed: true, holiday: REGULAR },
    NOT_EMPLOYED,
  ],

  // 3. A non-working holiday on a weekday: paid, whatever the row says
  [
    "a Regular holiday with no row",
    { dateKey: WEEKDAY, holiday: REGULAR },
    HOLIDAY_KIND,
  ],
  [
    "a Special Non-Working holiday with no row",
    { dateKey: WEEKDAY, holiday: SPECIAL },
    HOLIDAY_KIND,
  ],
  [
    "a holiday today with no row",
    { dateKey: TODAY, holiday: REGULAR },
    HOLIDAY_KIND,
  ],
  [
    "a holiday tomorrow with no row",
    { dateKey: TOMORROW, holiday: SPECIAL },
    HOLIDAY_KIND,
  ],
  [
    "a Regular holiday over an Absent row",
    { dateKey: WEEKDAY, holiday: REGULAR, record: absent },
    HOLIDAY_KIND,
  ],
  [
    "a Special Non-Working holiday over an Absent row",
    { dateKey: WEEKDAY, holiday: SPECIAL, record: absent },
    HOLIDAY_KIND,
  ],
  [
    "a Regular holiday over an approved LWOP",
    { dateKey: WEEKDAY, holiday: REGULAR, record: onLeave(LWOP) },
    HOLIDAY_KIND,
  ],
  [
    "a Special Non-Working holiday over an approved LWOP",
    { dateKey: WEEKDAY, holiday: SPECIAL, record: onLeave(LWOP) },
    HOLIDAY_KIND,
  ],
  [
    "a holiday over an approved Vacation Leave",
    { dateKey: WEEKDAY, holiday: REGULAR, record: onLeave(VL) },
    HOLIDAY_KIND,
  ],
  [
    "a holiday that was worked",
    { dateKey: WEEKDAY, holiday: REGULAR, record: worked() },
    HOLIDAY_KIND,
  ],
  [
    "a holiday over a Pending row",
    { dateKey: WEEKDAY, holiday: SPECIAL, record: pending },
    HOLIDAY_KIND,
  ],

  // "Special Working" is an ordinary working day, and so is a holiday of an unknown type
  [
    "a Special Working holiday with no row",
    { dateKey: WEEKDAY, holiday: WORKING },
    NO_RECORD,
  ],
  [
    "a Special Working holiday with an Absent row",
    { dateKey: WEEKDAY, holiday: WORKING, record: absent },
    ABSENT,
  ],
  [
    "a Special Working holiday with an approved LWOP",
    { dateKey: WEEKDAY, holiday: WORKING, record: onLeave(LWOP) },
    UNPAID_LEAVE,
  ],
  [
    "a Special Working holiday that was worked",
    { dateKey: WEEKDAY, holiday: WORKING, record: worked() },
    WORKED,
  ],
  [
    "a Special Working holiday with an approved Vacation Leave",
    { dateKey: WEEKDAY, holiday: WORKING, record: onLeave(VL) },
    PAID_LEAVE,
  ],
  [
    "a Special Working holiday today with no row",
    { dateKey: TODAY, holiday: WORKING },
    UNDECIDED,
  ],
  [
    "a holiday whose type isn't on the list, with no row",
    { dateKey: WEEKDAY, holiday: { type: "Company Holiday", name: "Outing" } },
    NO_RECORD,
  ],
  [
    "a holiday with no type, with an Absent row",
    { dateKey: WEEKDAY, holiday: { name: "Outing" }, record: absent },
    ABSENT,
  ],

  // 4. Worked: a time in or a time out, whatever the behavior
  ...["On-Time", "Late", "Half-Day", "Early-Out"].map((behavior) => [
    `a day worked, ${behavior}`,
    { dateKey: WEEKDAY, record: worked(behavior) },
    WORKED,
  ]),
  [
    "a day with a time in only",
    { dateKey: WEEKDAY, record: timeInOnly },
    WORKED,
  ],
  [
    "a day with a time out only",
    { dateKey: WEEKDAY, record: timeOutOnly },
    WORKED,
  ],
  ["today, already timed in", { dateKey: TODAY, record: timeInOnly }, WORKED],

  // 5. Paid leave: every type whose `paid` flag is on, and a type that isn't on the list
  ...LEAVE_TYPES.filter(({ paid }) => paid).map(({ name }) => [
    `an approved ${name}`,
    { dateKey: WEEKDAY, record: onLeave(name) },
    PAID_LEAVE,
  ]),
  [
    "an approved leave of a type that isn't on the list (old data)",
    { dateKey: WEEKDAY, record: onLeave("Emergency Leave") },
    PAID_LEAVE,
  ],
  [
    "an approved leave with no type saved",
    { dateKey: WEEKDAY, record: onLeave(null) },
    PAID_LEAVE,
  ],
  [
    "an approved Vacation Leave tomorrow",
    { dateKey: TOMORROW, record: onLeave(VL) },
    PAID_LEAVE,
  ],

  // 6. Unpaid leave
  [
    "an approved LWOP",
    { dateKey: WEEKDAY, record: onLeave(LWOP) },
    UNPAID_LEAVE,
  ],
  [
    "an approved LWOP today",
    { dateKey: TODAY, record: onLeave(LWOP) },
    UNPAID_LEAVE,
  ],
  [
    "an approved LWOP tomorrow",
    { dateKey: TOMORROW, record: onLeave(LWOP) },
    UNPAID_LEAVE,
  ],

  // 7. Absent
  ["an Absent row", { dateKey: WEEKDAY, record: absent }, ABSENT],
  ["an Absent row yesterday", { dateKey: YESTERDAY, record: absent }, ABSENT],
  ["an Absent row today", { dateKey: TODAY, record: absent }, ABSENT],
  [
    "an Absent row whose times are the screen's blanks",
    {
      dateKey: WEEKDAY,
      record: { ...absent, timeIn: "--:--", timeOut: "--:--" },
    },
    ABSENT,
  ],

  // 8. No record: a day before today with no row
  ["a past weekday with no row", { dateKey: WEEKDAY }, NO_RECORD],
  ["yesterday with no row", { dateKey: YESTERDAY }, NO_RECORD],
  [
    "today with no row, seen the day after",
    { dateKey: TODAY, todayKey: TOMORROW },
    NO_RECORD,
  ],

  // 9. Undecided: neither paid nor unpaid yet
  ["today with no row", { dateKey: TODAY }, UNDECIDED],
  ["tomorrow with no row", { dateKey: TOMORROW }, UNDECIDED],
  [
    "a past day with a Pending row",
    { dateKey: WEEKDAY, record: pending },
    UNDECIDED,
  ],
  ["today with a Pending row", { dateKey: TODAY, record: pending }, UNDECIDED],
  [
    "a past day with a row that has no behavior and no times",
    { dateKey: WEEKDAY, record: noTimes(undefined) },
    UNDECIDED,
  ],
].map(([label, day, kind]) => [
  label,
  {
    todayKey: TODAY,
    record: null,
    holiday: null,
    isNotEmployed: false,
    ...day,
  },
  kind,
]);

const isLwopRow = (record) =>
  record?.behavior === "On-Leave" && record.leaveType === LWOP;

describe("the kinds of day", () => {
  it("are these nine, each with its own name", () => {
    expect(DAY_KINDS).toStrictEqual({
      WEEKEND: "weekend",
      NOT_EMPLOYED: "notEmployed",
      HOLIDAY: "holiday",
      WORKED: "worked",
      PAID_LEAVE: "paidLeave",
      UNPAID_LEAVE: "unpaidLeave",
      ABSENT: "absent",
      NO_RECORD: "noRecord",
      UNDECIDED: "undecided",
    });
    expect(new Set(Object.values(DAY_KINDS)).size).toBe(9);
  });

  it("pay a holiday, a worked day and a paid leave; dock an unpaid leave, an absence and a day with no record", () => {
    expect(PAID_KINDS).toStrictEqual(["holiday", "worked", "paidLeave"]);
    expect(UNPAID_KINDS).toStrictEqual(["unpaidLeave", "absent", "noRecord"]);
  });

  it.each(Object.values(DAY_KINDS))(
    "%s is paid, unpaid or neither, never both",
    (kind) => {
      expect(isPaidKind(kind)).toBe(PAID_KINDS.includes(kind));
      expect(isUnpaidKind(kind)).toBe(UNPAID_KINDS.includes(kind));
      expect(isPaidKind(kind) && isUnpaidKind(kind)).toBe(false);
    },
  );

  it("leave a weekend, a day not employed and an undecided day neither paid nor unpaid", () => {
    for (const kind of [WEEKEND, NOT_EMPLOYED, UNDECIDED]) {
      expect([kind, isPaidKind(kind), isUnpaidKind(kind)]).toEqual([
        kind,
        false,
        false,
      ]);
    }
  });

  it("has a case in the table for every kind", () => {
    expect(new Set(CASES.map(([, , kind]) => kind))).toEqual(
      new Set(Object.values(DAY_KINDS)),
    );
  });
});

describe("payDayKind", () => {
  it.each(CASES)("%s", (label, day, kind) => {
    expect(payDayKind(day)).toBe(kind);
  });

  it("reads a missing row and a missing holiday as none, whether null or left out", () => {
    expect(payDayKind({ dateKey: WEEKDAY, todayKey: TODAY })).toBe(NO_RECORD);
    expect(payDayKind({ dateKey: TODAY, todayKey: TODAY })).toBe(UNDECIDED);
    expect(
      payDayKind({ dateKey: WEEKDAY, todayKey: TODAY, record: absent }),
    ).toBe(ABSENT);
  });

  it("checks in order: weekend, not employed, holiday, worked, leave, absent", () => {
    const everything = {
      todayKey: TODAY,
      isNotEmployed: true,
      holiday: REGULAR,
      record: worked(),
    };
    expect(payDayKind({ ...everything, dateKey: SATURDAY })).toBe(WEEKEND);
    expect(payDayKind({ ...everything, dateKey: WEEKDAY })).toBe(NOT_EMPLOYED);
    expect(
      payDayKind({ ...everything, dateKey: WEEKDAY, isNotEmployed: false }),
    ).toBe(HOLIDAY_KIND);
    expect(
      payDayKind({
        ...everything,
        dateKey: WEEKDAY,
        isNotEmployed: false,
        holiday: null,
      }),
    ).toBe(WORKED);
  });

  // The attendance sheet reads these two rows by their behavior and shows LWOP, so they
  // are left out of the table that is run against it. Approval clears the times of a day
  // it marks On-Leave and a saved time recomputes the behavior, so such a row should not
  // exist; when one does, the time on it is what pay goes by.
  it.each([
    ["an On-Leave LWOP row", onLeave(LWOP)],
    ["an Absent row", absent],
  ])("pays %s that carries a time in as a worked day", (label, record) => {
    expect(
      payDayKind({
        dateKey: WEEKDAY,
        todayKey: TODAY,
        record: { ...record, timeIn: "08:00:00" },
      }),
    ).toBe(WORKED);
  });
});

describe("paid and unpaid leave types", () => {
  // If HR marks another type unpaid, the attendance sheet must change with it: the sheet
  // shows LWOP only for the LWOP type, so a payslip would dock a day the sheet shows as
  // that leave's own code.
  it("the only unpaid leave type today is LWOP", () => {
    expect(
      LEAVE_TYPES.filter(({ paid }) => !paid).map(({ name }) => name),
    ).toEqual([LWOP]);
  });

  it.each(LEAVE_TYPES.map(({ name, paid }) => [name, paid]))(
    "isPaidLeaveType for %s is %s, as the list says",
    (name, paid) => {
      expect(isPaidLeaveType(name)).toBe(paid);
    },
  );

  it.each([
    ["a type that isn't on the list", "Emergency Leave"],
    ["a code instead of the name", "LWOP"],
    ["an empty type", ""],
    ["null", null],
    ["undefined", undefined],
  ])("%s counts as paid", (label, leaveType) => {
    expect(isPaidLeaveType(leaveType)).toBe(true);
  });

  it("both non-working holiday types are paid, and Special Working is not a day off", () => {
    expect(
      HOLIDAY_TYPES.map(({ name }) => [
        name,
        payDayKind({
          dateKey: WEEKDAY,
          todayKey: TODAY,
          holiday: { type: name, name },
        }),
      ]),
    ).toEqual([
      ["Regular", HOLIDAY_KIND],
      ["Special Non-Working", HOLIDAY_KIND],
      ["Special Working", NO_RECORD],
    ]);
  });
});

// The attendance sheet's rule for the same days (frontend getLeaveMark and
// isUnfiledAbsence take the same five values)
describe("the attendance sheet agrees with pay", () => {
  it("has HOL as its holiday code", () => {
    expect(HOLIDAY.code).toBe("HOL");
    expect(typeof HOLIDAY.meaning).toBe("string");
  });

  it.each(CASES)(
    "%s: an unfiled absence on the sheet exactly when it is absent or has no record",
    (label, day, kind) => {
      expect(isUnfiledAbsence(day)).toBe([ABSENT, NO_RECORD].includes(kind));
    },
  );

  it.each(CASES)(
    "%s: LWOP on the sheet exactly when it is an unpaid day",
    (label, day, kind) => {
      expect(getLeaveMark(day)?.code === "LWOP").toBe(isUnpaidKind(kind));
    },
  );

  it.each(CASES)(
    "%s: HOL on the sheet when it is a holiday with no row, an Absent row or an approved LWOP, and on no other kind of day",
    (label, day, kind) => {
      const { record } = day;
      const code = getLeaveMark(day)?.code;

      if (
        kind === HOLIDAY_KIND &&
        (!record || record.behavior === "Absent" || isLwopRow(record))
      ) {
        expect(code).toBe("HOL");
      }
      if (kind !== HOLIDAY_KIND) expect(code).not.toBe("HOL");
    },
  );

  it("covers a holiday with each of the three rows that would show LWOP without it", () => {
    const holidayRows = CASES.filter(([, , kind]) => kind === HOLIDAY_KIND).map(
      ([, { record }]) => {
        if (!record) return "none";
        return isLwopRow(record) ? "LWOP" : record.behavior;
      },
    );
    expect(holidayRows).toEqual(
      expect.arrayContaining(["none", "Absent", "LWOP"]),
    );
  });
});

// October 11 to 25, 2026: Sunday to Sunday, weekdays Oct 12-16 and Oct 19-23
const OCT_1ST = { start: "2026-10-11", end: "2026-10-25" };
const OCT_1ST_WEEKDAYS = [
  "2026-10-12",
  "2026-10-13",
  "2026-10-14",
  "2026-10-15",
  "2026-10-16",
  "2026-10-19",
  "2026-10-20",
  "2026-10-21",
  "2026-10-22",
  "2026-10-23",
];

const utcDay = (key) => new Date(`${key}T00:00:00Z`);

describe("employmentKeys", () => {
  it("reads the start date, and the last working day of a Resigned account", () => {
    expect(
      employmentKeys({
        job: {
          startDate: utcDay("2026-06-01"),
          resignationDate: utcDay("2026-10-16"),
        },
        status: "Resigned",
        createdAt: new Date("2026-05-20T03:00:00Z"),
      }),
    ).toEqual({ startKey: "2026-06-01", lastKey: "2026-10-16" });
  });

  it("ignores a last working day on an account that isn't Resigned", () => {
    for (const status of ["Active", "Inactive", "Pending", undefined]) {
      expect(
        employmentKeys({
          job: {
            startDate: "2026-06-01",
            resignationDate: utcDay("2026-10-16"),
          },
          status,
        }),
      ).toEqual({ startKey: "2026-06-01", lastKey: "" });
    }
  });

  it("falls back to the day the account was created, in Manila time, when there is no start date", () => {
    // 17:30 UTC on October 13 is 01:30 on October 14 in Manila
    const createdAt = new Date("2026-10-13T17:30:00Z");

    expect(employmentKeys({ job: {}, status: "Active", createdAt })).toEqual({
      startKey: "2026-10-14",
      lastKey: "",
    });
    expect(
      employmentKeys({ job: { startDate: "" }, status: "Active", createdAt }),
    ).toEqual({ startKey: "2026-10-14", lastKey: "" });
    expect(
      employmentKeys({ job: { startDate: null }, status: "Active", createdAt }),
    ).toEqual({ startKey: "2026-10-14", lastKey: "" });
    // The start date wins when there is one
    expect(
      employmentKeys({
        job: { startDate: utcDay("2026-10-19") },
        status: "Active",
        createdAt,
      }),
    ).toEqual({ startKey: "2026-10-19", lastKey: "" });
  });

  it("gives no keys when nothing is known", () => {
    expect(employmentKeys()).toEqual({ startKey: "", lastKey: "" });
    expect(employmentKeys({ job: null, status: "Resigned" })).toEqual({
      startKey: "",
      lastKey: "",
    });
    expect(
      employmentKeys({ job: { startDate: "not a date" }, createdAt: "nope" }),
    ).toEqual({ startKey: "", lastKey: "" });
  });
});

describe("employedWeekdays", () => {
  it("is every weekday of the range for someone employed throughout", () => {
    expect(
      employedWeekdays({ startKey: "2026-01-05", lastKey: "" }, OCT_1ST),
    ).toEqual(OCT_1ST_WEEKDAYS);
  });

  it("starts on the start date: the day before is out, the day itself and the day after are in", () => {
    // Wednesday, October 14
    const days = employedWeekdays(
      { startKey: "2026-10-14", lastKey: "" },
      OCT_1ST,
    );

    expect(days).not.toContain("2026-10-13");
    expect(days).toContain("2026-10-14");
    expect(days).toContain("2026-10-15");
    expect(days).toEqual(OCT_1ST_WEEKDAYS.slice(2));
  });

  it("ends on the last working day: the day before and the day itself are in, the day after is out", () => {
    // Tuesday, October 20
    const days = employedWeekdays(
      { startKey: "2026-01-05", lastKey: "2026-10-20" },
      OCT_1ST,
    );

    expect(days).toContain("2026-10-19");
    expect(days).toContain("2026-10-20");
    expect(days).not.toContain("2026-10-21");
    expect(days).toEqual(OCT_1ST_WEEKDAYS.slice(0, 7));
  });

  it("handles a start date and a last working day on a weekend", () => {
    // Started Saturday October 17: first paid day is Monday October 19
    expect(
      employedWeekdays({ startKey: "2026-10-17", lastKey: "" }, OCT_1ST),
    ).toEqual(OCT_1ST_WEEKDAYS.slice(5));
    // Last working day Sunday October 18: last paid day is Friday October 16
    expect(
      employedWeekdays(
        { startKey: "2026-01-05", lastKey: "2026-10-18" },
        OCT_1ST,
      ),
    ).toEqual(OCT_1ST_WEEKDAYS.slice(0, 5));
  });

  it("is empty before the start date, after the last working day, and for a last day before the start", () => {
    expect(
      employedWeekdays({ startKey: "2026-10-26", lastKey: "" }, OCT_1ST),
    ).toEqual([]);
    expect(
      employedWeekdays(
        { startKey: "2026-01-05", lastKey: "2026-10-10" },
        OCT_1ST,
      ),
    ).toEqual([]);
    expect(
      employedWeekdays(
        { startKey: "2026-10-20", lastKey: "2026-10-14" },
        OCT_1ST,
      ),
    ).toEqual([]);
  });

  it("counts a one-day employment", () => {
    expect(
      employedWeekdays(
        { startKey: "2026-10-14", lastKey: "2026-10-14" },
        OCT_1ST,
      ),
    ).toEqual(["2026-10-14"]);
  });

  it("counts every weekday when no start date is known at all", () => {
    expect(employedWeekdays({ startKey: "", lastKey: "" }, OCT_1ST)).toEqual(
      OCT_1ST_WEEKDAYS,
    );
    expect(employedWeekdays(undefined, OCT_1ST)).toEqual(OCT_1ST_WEEKDAYS);
    expect(
      employedWeekdays({ startKey: "", lastKey: "2026-10-13" }, OCT_1ST),
    ).toEqual(OCT_1ST_WEEKDAYS.slice(0, 2));
  });

  it("is the 13th month's count of the same part cut-off (Liza: started June 1, last day October 16)", () => {
    const job = {
      startDate: utcDay("2026-06-01"),
      resignationDate: utcDay("2026-10-16"),
      basicPay: 18000,
    };
    const employment = employmentKeys({ job, status: "Resigned" });

    const days = employedWeekdays(employment, OCT_1ST);
    expect(days).toEqual(cutoffShare(job, OCT_1ST).days);
    expect(days).toHaveLength(5);

    const report = thirteenthMonth(job, {
      year: 2026,
      todayKey: TODAY,
      status: "Resigned",
    });
    const part = report.cutoffs.find(({ cutoff }) => cutoff === "2026-10-1st");
    expect(part.weekdaysEmployed).toBe(days.length);
  });

  // The employee as the employee list sends it to the Reports screen
  const sheetEmployee = ({
    startDate,
    resignationDate,
    status,
    createdAt,
  }) => ({
    status,
    createdAt: createdAt ? new Date(createdAt).toISOString() : undefined,
    jobDescription: {
      startDate: startDate ? utcDay(startDate).toISOString() : "",
      resignationDate: resignationDate
        ? utcDay(resignationDate).toISOString()
        : "",
    },
  });

  it.each([
    ["employed throughout", { startDate: "2026-01-05", status: "Active" }],
    [
      "started inside the cut-off",
      { startDate: "2026-10-14", status: "Active" },
    ],
    [
      "started on its first weekday",
      { startDate: "2026-10-12", status: "Active" },
    ],
    ["started after it", { startDate: "2026-11-02", status: "Active" }],
    [
      "resigned inside the cut-off",
      {
        startDate: "2026-06-01",
        resignationDate: "2026-10-16",
        status: "Resigned",
      },
    ],
    [
      "resigned on its last weekday",
      {
        startDate: "2026-06-01",
        resignationDate: "2026-10-23",
        status: "Resigned",
      },
    ],
    [
      "resigned before it",
      {
        startDate: "2026-06-01",
        resignationDate: "2026-09-30",
        status: "Resigned",
      },
    ],
    [
      "started and resigned inside it",
      {
        startDate: "2026-10-13",
        resignationDate: "2026-10-21",
        status: "Resigned",
      },
    ],
    [
      "reinstated: Active with an old last working day still saved",
      {
        startDate: "2026-06-01",
        resignationDate: "2026-10-16",
        status: "Active",
      },
    ],
    [
      "Resigned with no last working day saved",
      { startDate: "2026-06-01", status: "Resigned" },
    ],
    [
      "no start date: the account was created late on October 13 UTC (October 14 in Manila)",
      { createdAt: "2026-10-13T17:30:00Z", status: "Active" },
    ],
    [
      "no start date: the account was created early on October 14 UTC",
      { createdAt: "2026-10-14T02:00:00Z", status: "Active" },
    ],
    ["no start date and no created-at day", { status: "Active" }],
  ])(
    "agrees with the attendance sheet's isNotEmployedOn, day by day: %s",
    (label, person) => {
      const employment = employmentKeys({
        job: {
          startDate: person.startDate ? utcDay(person.startDate) : undefined,
          resignationDate: person.resignationDate
            ? utcDay(person.resignationDate)
            : null,
        },
        status: person.status,
        createdAt: person.createdAt ? new Date(person.createdAt) : undefined,
      });
      const employed = employedWeekdays(employment, OCT_1ST);

      expect(
        OCT_1ST_WEEKDAYS.filter(
          (day) => !isNotEmployedOn(sheetEmployee(person), day),
        ),
      ).toEqual(employed);
    },
  );
});

describe("classifyPayDays", () => {
  // Rows as the database gives them: the day at 00:00 UTC, times as dates
  const row = (day, record) => ({
    date: utcDay(day),
    ...record,
    timeIn: record.timeIn ? new Date(`${day}T${record.timeIn}Z`) : null,
    timeOut: record.timeOut ? new Date(`${day}T${record.timeOut}Z`) : null,
  });
  const workedOn = (days) => days.map((day) => row(day, worked()));
  const holidayOn = (day, type = "Regular", name = "Holiday") => ({
    date: utcDay(day),
    name,
    type,
  });

  const EMPLOYED = { startKey: "2026-01-05", lastKey: "" };
  const kindsOf = (result) => result.days.map(({ day, kind }) => [day, kind]);
  const expectAddsUp = ({ summary, undecided }) => {
    expect(summary.paid + summary.unpaid.length + undecided.length).toBe(
      summary.employed,
    );
  };

  it("sums up a whole cut-off (plan example A: a paid Vacation Leave day and one absence)", () => {
    const attendance = [
      ...workedOn(
        OCT_1ST_WEEKDAYS.filter(
          (day) => !["2026-10-14", "2026-10-20"].includes(day),
        ),
      ),
      row("2026-10-14", onLeave(VL)),
      row("2026-10-20", absent),
    ];

    const result = classifyPayDays({
      range: OCT_1ST,
      todayKey: TODAY,
      employment: EMPLOYED,
      attendance,
      holidays: [],
    });

    expect(result.summary).toStrictEqual({
      cutoffWeekdays: 10,
      employed: 10,
      paid: 9,
      unpaid: [{ day: "2026-10-20", reason: "absent" }],
      holidays: 0,
      paidLeave: 1,
    });
    expect(result.undecided).toEqual([]);
    expectAddsUp(result);
  });

  it("lists every calendar day of the range, oldest first, each with its kind", () => {
    const result = classifyPayDays({
      range: OCT_1ST,
      todayKey: TODAY,
      employment: EMPLOYED,
      attendance: [
        ...workedOn(["2026-10-12", "2026-10-13"]),
        row("2026-10-14", onLeave(VL)),
        row("2026-10-15", onLeave(LWOP)),
        row("2026-10-20", absent),
      ],
      holidays: [
        holidayOn("2026-10-21", "Special Non-Working", "Founding Day"),
      ],
    });

    expect(result.days).toStrictEqual([
      { day: "2026-10-11", kind: WEEKEND, holiday: null, leaveType: null },
      { day: "2026-10-12", kind: WORKED, holiday: null, leaveType: null },
      { day: "2026-10-13", kind: WORKED, holiday: null, leaveType: null },
      { day: "2026-10-14", kind: PAID_LEAVE, holiday: null, leaveType: VL },
      { day: "2026-10-15", kind: UNPAID_LEAVE, holiday: null, leaveType: LWOP },
      { day: "2026-10-16", kind: NO_RECORD, holiday: null, leaveType: null },
      { day: "2026-10-17", kind: WEEKEND, holiday: null, leaveType: null },
      { day: "2026-10-18", kind: WEEKEND, holiday: null, leaveType: null },
      { day: "2026-10-19", kind: NO_RECORD, holiday: null, leaveType: null },
      { day: "2026-10-20", kind: ABSENT, holiday: null, leaveType: null },
      {
        day: "2026-10-21",
        kind: HOLIDAY_KIND,
        holiday: { name: "Founding Day", type: "Special Non-Working" },
        leaveType: null,
      },
      { day: "2026-10-22", kind: NO_RECORD, holiday: null, leaveType: null },
      { day: "2026-10-23", kind: NO_RECORD, holiday: null, leaveType: null },
      { day: "2026-10-24", kind: WEEKEND, holiday: null, leaveType: null },
      { day: "2026-10-25", kind: WEEKEND, holiday: null, leaveType: null },
    ]);
    expect(result.summary).toStrictEqual({
      cutoffWeekdays: 10,
      employed: 10,
      paid: 4,
      unpaid: [
        { day: "2026-10-15", reason: "unpaidLeave" },
        { day: "2026-10-16", reason: "noRecord" },
        { day: "2026-10-19", reason: "noRecord" },
        { day: "2026-10-20", reason: "absent" },
        { day: "2026-10-22", reason: "noRecord" },
        { day: "2026-10-23", reason: "noRecord" },
      ],
      holidays: 1,
      paidLeave: 1,
    });
    expectAddsUp(result);
  });

  // October 26 to November 10, 2026: 12 weekdays
  describe("a cut-off with holidays, leaves and missing rows (October 26 to November 10)", () => {
    const attendance = [
      ...workedOn(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"]),
      // Oct 30: no row
      row("2026-11-02", absent), // a non-working holiday
      // Nov 3: a Special Working holiday, no row
      row("2026-11-04", onLeave(VL)),
      // An approved LWOP from Thursday to Monday: approval marks the weekend too
      ...[
        "2026-11-05",
        "2026-11-06",
        "2026-11-07",
        "2026-11-08",
        "2026-11-09",
      ].map((day) => row(day, onLeave(LWOP))),
      row("2026-11-10", pending),
    ];
    const holidays = [
      holidayOn("2026-10-31", "Regular", "A Saturday Holiday"),
      holidayOn("2026-11-02", "Special Non-Working", "All Souls' Day"),
      holidayOn("2026-11-03", "Special Working", "Company Day"),
    ];
    const classify = (extra = {}) =>
      classifyPayDays({
        cutoff: "2026-10-2nd",
        todayKey: TODAY,
        employment: EMPLOYED,
        attendance,
        holidays,
        ...extra,
      });

    it("gives each day its kind", () => {
      expect(kindsOf(classify())).toEqual([
        ["2026-10-26", WORKED],
        ["2026-10-27", WORKED],
        ["2026-10-28", WORKED],
        ["2026-10-29", WORKED],
        ["2026-10-30", NO_RECORD],
        ["2026-10-31", WEEKEND],
        ["2026-11-01", WEEKEND],
        ["2026-11-02", HOLIDAY_KIND],
        ["2026-11-03", NO_RECORD],
        ["2026-11-04", PAID_LEAVE],
        ["2026-11-05", UNPAID_LEAVE],
        ["2026-11-06", UNPAID_LEAVE],
        ["2026-11-07", WEEKEND],
        ["2026-11-08", WEEKEND],
        ["2026-11-09", UNPAID_LEAVE],
        ["2026-11-10", UNDECIDED],
      ]);
    });

    it("sums it up for the payslip, and names the day that is not decided", () => {
      const result = classify();

      expect(result.summary).toStrictEqual({
        cutoffWeekdays: 12,
        employed: 12,
        paid: 6,
        unpaid: [
          { day: "2026-10-30", reason: "noRecord" },
          { day: "2026-11-03", reason: "noRecord" },
          { day: "2026-11-05", reason: "unpaidLeave" },
          { day: "2026-11-06", reason: "unpaidLeave" },
          { day: "2026-11-09", reason: "unpaidLeave" },
        ],
        holidays: 1,
        paidLeave: 1,
      });
      expect(result.undecided).toEqual(["2026-11-10"]);
      expectAddsUp(result);
    });

    it("shows each date's holiday on the day list, whatever its type or weekday", () => {
      const byDay = Object.fromEntries(
        classify().days.map(({ day, holiday }) => [day, holiday]),
      );

      expect(byDay["2026-10-31"]).toEqual({
        name: "A Saturday Holiday",
        type: "Regular",
      });
      expect(byDay["2026-11-02"]).toEqual({
        name: "All Souls' Day",
        type: "Special Non-Working",
      });
      expect(byDay["2026-11-03"]).toEqual({
        name: "Company Day",
        type: "Special Working",
      });
      expect(byDay["2026-11-04"]).toBeNull();
    });

    it("a holiday on a Saturday changes nothing, and neither does a Special Working holiday", () => {
      const without = classify({
        holidays: holidays.filter(({ type }) => type === "Special Non-Working"),
      });

      expect(without.summary).toStrictEqual(classify().summary);
      expect(kindsOf(without)).toEqual(kindsOf(classify()));
    });

    it("without the non-working holiday, its Absent row is an unpaid day again", () => {
      const result = classify({ holidays: [] });

      expect(result.summary.paid).toBe(5);
      expect(result.summary.holidays).toBe(0);
      expect(result.summary.unpaid).toContainEqual({
        day: "2026-11-02",
        reason: "absent",
      });
      expectAddsUp(result);
    });

    it("a non-working holiday over the approved LWOP pays that day only", () => {
      const result = classify({
        holidays: [...holidays, holidayOn("2026-11-06", "Regular", "Extra")],
      });

      expect(result.summary.holidays).toBe(2);
      expect(result.summary.paid).toBe(7);
      expect(result.summary.unpaid.map(({ day }) => day)).toEqual([
        "2026-10-30",
        "2026-11-03",
        "2026-11-05",
        "2026-11-09",
      ]);
      // A holiday on the leave's Saturday still changes nothing
      const weekend = classify({
        holidays: [...holidays, holidayOn("2026-11-07", "Regular", "Extra")],
      });
      expect(weekend.summary).toStrictEqual(classify().summary);
    });

    it("gives the same answer for the range, the cut-off value and the cut-off itself", () => {
      const byValue = classify();
      const byRange = classify({
        cutoff: undefined,
        range: { start: "2026-10-26", end: "2026-11-10" },
      });
      const byObject = classify({
        cutoff: { year: 2026, monthIndex: 9, half: "2nd" },
      });

      expect(byRange).toStrictEqual(byValue);
      expect(byObject).toStrictEqual(byValue);
    });

    it("gives the same answer for rows and holidays as the API sends them", () => {
      const asSent = (docs) => JSON.parse(JSON.stringify(docs));
      const apiHolidays = holidays.map(({ date, name, type }) => ({
        id: "x",
        date: date.toISOString().slice(0, 10),
        name,
        type,
      }));

      expect(
        classify({ attendance: asSent(attendance), holidays: apiHolidays }),
      ).toStrictEqual(classify());
    });

    it("does not change what it is given", () => {
      const before = JSON.stringify({ attendance, holidays });

      classify();

      expect(JSON.stringify({ attendance, holidays })).toBe(before);
    });
  });

  describe("part cut-offs", () => {
    const allWorked = workedOn(OCT_1ST_WEEKDAYS);

    it("a new hire: the days before the start date are not employed, never 'no record'", () => {
      // Started Wednesday October 14; no rows before it
      const result = classifyPayDays({
        range: OCT_1ST,
        todayKey: TODAY,
        employment: { startKey: "2026-10-14", lastKey: "" },
        attendance: allWorked.slice(2),
      });

      expect(kindsOf(result).slice(0, 5)).toEqual([
        ["2026-10-11", WEEKEND],
        ["2026-10-12", NOT_EMPLOYED],
        ["2026-10-13", NOT_EMPLOYED],
        ["2026-10-14", WORKED],
        ["2026-10-15", WORKED],
      ]);
      expect(result.summary).toStrictEqual({
        cutoffWeekdays: 10,
        employed: 8,
        paid: 8,
        unpaid: [],
        holidays: 0,
        paidLeave: 0,
      });
      expectAddsUp(result);
    });

    it("a resigned employee: the days after the last working day are not employed (Liza, last day October 16)", () => {
      const result = classifyPayDays({
        range: OCT_1ST,
        todayKey: TODAY,
        employment: { startKey: "2026-06-01", lastKey: "2026-10-16" },
        attendance: allWorked.slice(0, 5),
      });

      expect(kindsOf(result).slice(5)).toEqual([
        ["2026-10-16", WORKED],
        ["2026-10-17", WEEKEND],
        ["2026-10-18", WEEKEND],
        ["2026-10-19", NOT_EMPLOYED],
        ["2026-10-20", NOT_EMPLOYED],
        ["2026-10-21", NOT_EMPLOYED],
        ["2026-10-22", NOT_EMPLOYED],
        ["2026-10-23", NOT_EMPLOYED],
        ["2026-10-24", WEEKEND],
        ["2026-10-25", WEEKEND],
      ]);
      expect(result.summary).toStrictEqual({
        cutoffWeekdays: 10,
        employed: 5,
        paid: 5,
        unpaid: [],
        holidays: 0,
        paidLeave: 0,
      });
    });

    it("a holiday, a worked row or an absence outside the employment counts for nothing", () => {
      const result = classifyPayDays({
        range: OCT_1ST,
        todayKey: TODAY,
        employment: { startKey: "2026-10-14", lastKey: "2026-10-20" },
        attendance: [
          row("2026-10-12", worked()),
          row("2026-10-13", absent),
          ...workedOn(["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-19"]),
          row("2026-10-20", absent),
          row("2026-10-21", onLeave(LWOP)),
        ],
        holidays: [holidayOn("2026-10-22"), holidayOn("2026-10-16")],
      });

      expect(result.summary).toStrictEqual({
        cutoffWeekdays: 10,
        employed: 5,
        paid: 4,
        unpaid: [{ day: "2026-10-20", reason: "absent" }],
        holidays: 1,
        paidLeave: 0,
      });
      expect(
        result.days
          .filter(({ kind }) => kind === NOT_EMPLOYED)
          .map(({ day }) => day),
      ).toEqual([
        "2026-10-12",
        "2026-10-13",
        "2026-10-21",
        "2026-10-22",
        "2026-10-23",
      ]);
      expectAddsUp(result);
    });

    it("someone not employed in the cut-off at all has no paid and no unpaid day", () => {
      const result = classifyPayDays({
        range: OCT_1ST,
        todayKey: TODAY,
        employment: { startKey: "2026-11-02", lastKey: "" },
      });

      expect(result.summary).toStrictEqual({
        cutoffWeekdays: 10,
        employed: 0,
        paid: 0,
        unpaid: [],
        holidays: 0,
        paidLeave: 0,
      });
      expect(result.undecided).toEqual([]);
    });
  });

  describe("the cut-off that is still running (November 11 to 25, today Thursday November 12)", () => {
    const classify = (extra = {}) =>
      classifyPayDays({
        cutoff: "2026-11-1st",
        todayKey: TODAY,
        employment: EMPLOYED,
        attendance: [
          // Nov 11: no row
          row("2026-11-16", onLeave(VL)),
          row("2026-11-17", onLeave(LWOP)),
        ],
        holidays: [holidayOn("2026-11-20")],
        ...extra,
      });

    it("docks yesterday's missing row, and leaves today and the days ahead undecided", () => {
      const result = classify();

      expect(kindsOf(result).filter(([, kind]) => kind !== WEEKEND)).toEqual([
        ["2026-11-11", NO_RECORD],
        ["2026-11-12", UNDECIDED],
        ["2026-11-13", UNDECIDED],
        ["2026-11-16", PAID_LEAVE],
        ["2026-11-17", UNPAID_LEAVE],
        ["2026-11-18", UNDECIDED],
        ["2026-11-19", UNDECIDED],
        ["2026-11-20", HOLIDAY_KIND],
        ["2026-11-23", UNDECIDED],
        ["2026-11-24", UNDECIDED],
        ["2026-11-25", UNDECIDED],
      ]);
      expect(result.summary).toStrictEqual({
        cutoffWeekdays: 11,
        employed: 11,
        paid: 2,
        unpaid: [
          { day: "2026-11-11", reason: "noRecord" },
          { day: "2026-11-17", reason: "unpaidLeave" },
        ],
        holidays: 1,
        paidLeave: 1,
      });
      expect(result.undecided).toHaveLength(7);
      expectAddsUp(result);
    });

    it("once the cut-off has ended, every weekday still without a row has no record", () => {
      const result = classify({ todayKey: "2026-11-26" });

      expect(result.undecided).toEqual([]);
      expect(result.summary.paid).toBe(2);
      expect(result.summary.unpaid).toHaveLength(9);
      expect(
        result.summary.unpaid.filter(({ reason }) => reason === "noRecord"),
      ).toHaveLength(8);
      expectAddsUp(result);
    });

    it("uses today in Manila when no day is given", () => {
      // Monday, January 3, 2000, and a week far ahead
      const past = classifyPayDays({
        range: { start: "2000-01-03", end: "2000-01-03" },
      });
      const ahead = classifyPayDays({
        range: { start: "2999-01-07", end: "2999-01-11" },
        employment: EMPLOYED,
      });
      const today = classifyPayDays({
        range: { start: manilaToday(), end: manilaToday() },
        employment: EMPLOYED,
      });

      expect(today.summary.unpaid).toEqual([]);
      expect(past.summary.unpaid).toEqual([
        { day: "2000-01-03", reason: "noRecord" },
      ]);
      expect(ahead.summary.unpaid).toEqual([]);
      expect(ahead.undecided).toHaveLength(ahead.summary.employed);
    });
  });

  it("counts December 26 to January 10 as one whole cut-off, with holidays from both years", () => {
    const result = classifyPayDays({
      cutoff: "2026-12-2nd",
      todayKey: "2027-01-20",
      employment: EMPLOYED,
      attendance: workedOn(["2026-12-28", "2027-01-04"]),
      holidays: [
        holidayOn("2026-12-25", "Regular", "Christmas Day"), // the cut-off before
        holidayOn("2026-12-30", "Regular", "Rizal Day"),
        holidayOn("2027-01-01", "Regular", "New Year's Day"),
      ],
    });

    expect(result.days[0].day).toBe("2026-12-26");
    expect(result.days[result.days.length - 1].day).toBe("2027-01-10");
    expect(result.days).toHaveLength(16);
    expect(result.summary.cutoffWeekdays).toBe(10);
    expect(result.summary.employed).toBe(10);
    expect(result.summary.holidays).toBe(2);
    expect(result.summary.paid).toBe(4);
    expect(result.summary.unpaid.map(({ day }) => day)).toEqual([
      "2026-12-29",
      "2026-12-31",
      "2027-01-05",
      "2027-01-06",
      "2027-01-07",
      "2027-01-08",
    ]);
    expectAddsUp(result);
  });

  it("ignores rows outside the range, and rows without a date", () => {
    const result = classifyPayDays({
      range: { start: "2026-10-19", end: "2026-10-20" },
      todayKey: TODAY,
      employment: EMPLOYED,
      attendance: [
        row("2026-10-16", worked()),
        row("2026-10-21", worked()),
        { ...worked(), date: null },
        row("2026-10-19", worked()),
      ],
    });

    expect(kindsOf(result)).toEqual([
      ["2026-10-19", WORKED],
      ["2026-10-20", NO_RECORD],
    ]);
  });

  it("when a day has two rows, a row with a time decides, then On-Leave, then Absent, in either order", () => {
    const pairs = [
      [[worked(), absent], WORKED],
      [[worked(), onLeave(LWOP)], WORKED],
      [[onLeave(LWOP), absent], UNPAID_LEAVE],
      [[onLeave(VL), pending], PAID_LEAVE],
      [[absent, pending], ABSENT],
    ];

    for (const [records, kind] of pairs) {
      for (const order of [records, [...records].reverse()]) {
        const result = classifyPayDays({
          range: { start: WEEKDAY, end: WEEKDAY },
          todayKey: TODAY,
          employment: EMPLOYED,
          attendance: order.map((record) => row(WEEKDAY, record)),
        });
        expect(kindsOf(result)).toEqual([[WEEKDAY, kind]]);
      }
    }
  });

  it("with nothing but a range, every past weekday has no record", () => {
    const result = classifyPayDays({ range: OCT_1ST, todayKey: TODAY });

    expect(result.summary).toStrictEqual({
      cutoffWeekdays: 10,
      employed: 10,
      paid: 0,
      unpaid: OCT_1ST_WEEKDAYS.map((day) => ({ day, reason: "noRecord" })),
      holidays: 0,
      paidLeave: 0,
    });
  });

  it("a whole cut-off of approved LWOP has no paid day", () => {
    const result = classifyPayDays({
      range: OCT_1ST,
      todayKey: TODAY,
      employment: EMPLOYED,
      attendance: weekdaysBetween("2026-10-11", "2026-10-25")
        .concat(["2026-10-17", "2026-10-18"])
        .map((day) => row(day, onLeave(LWOP))),
    });

    expect(result.summary.paid).toBe(0);
    expect(result.summary.unpaid).toHaveLength(10);
    expect(
      result.summary.unpaid.every(({ reason }) => reason === "unpaidLeave"),
    ).toBe(true);
  });
});
