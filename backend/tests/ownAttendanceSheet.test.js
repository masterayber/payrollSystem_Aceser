// Employee Attendance page, Download (Friday bug B): the file was named
// "Attendance_Employee_..." and every day cell was blank, although the signed-in user's
// data carries the names (userData.employee) and the attendance (userData.attendance).
// The sheet is built by frontend/src/utils/reports/ownAttendance.js; the user below has
// the shape login and GET /api/auth/me send, with records like the 2026-11-27 presenter
// attendance seed passed through the same toClientAttendance the route uses.
import XLSX from "xlsx-js-style";
import {
  buildOwnAttendanceWorkbook,
  ownCutoffDays,
} from "../../frontend/src/utils/reports/ownAttendance";
import { toClientAttendance } from "../utils/clientAttendance";

const NOV_1ST = { year: 2026, monthIndex: 10, half: "1st" }; // Nov 11 to 25, 2026
const SHEET = "November 1st Cutoff";

// Every weekday Nov 2 to 26, 2026: 07:55-17:02 On-Time; Late (08:17-17:10) on Nov 10
// and 18; out at 19:30 on Nov 12 and 20:00 on Nov 25 (as the seed writes them)
const seedRecords = () => {
  const late = ["2026-11-10", "2026-11-18"];
  const ot = { "2026-11-12": "19:30:00", "2026-11-25": "20:00:00" };
  const at = (d, h) => new Date(`${d}T${h}Z`);
  const rows = [];
  for (
    let d = new Date("2026-11-02T00:00:00Z");
    d < new Date("2026-11-27T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const w = d.getUTCDay();
    if (w === 0 || w === 6) continue;
    const ds = d.toISOString().slice(0, 10);
    const isLate = late.includes(ds);
    rows.push({
      _id: `att-${ds}`,
      userId: "u-aramos",
      date: new Date(`${ds}T00:00:00Z`),
      timeIn: at(ds, isLate ? "08:17:00" : "07:55:00"),
      timeOut: at(ds, ot[ds] || (isLate ? "17:10:00" : "17:02:00")),
      behavior: isLate ? "Late" : "On-Time",
      leaveType: null,
      overtime: { isEligible: Boolean(ot[ds]), hours: 0, isFiled: false },
      sample: true,
    });
  }
  return rows;
};

const makeUser = ({ records = seedRecords(), startDate = "2025-09-01T00:00:00.000Z" } = {}) => ({
  _id: "u-aramos",
  username: "aramos",
  role: "Employee",
  createdAt: "2026-11-05T07:58:51.389Z",
  employee: {
    userId: "u-aramos",
    firstName: "Angelica",
    lastName: "Ramos",
    employeeId: "AC-008",
  },
  settings: {
    general: {
      jobDescription: { designation: "Head Office", department: "HR", startDate },
    },
  },
  attendance: records.map(toClientAttendance),
});

// Row 5 of the sheet (index 4), the day columns from F: Nov 11 is F5, Nov 25 is T5
const dayCell = (ws, day) => ws[XLSX.utils.encode_cell({ r: 4, c: 5 + (day - 11) })]?.v;

// Written and read back, as Excel would open the downloaded file
const roundTrip = (workbook) =>
  XLSX.read(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), {
    type: "buffer",
  });

describe("Employee attendance download (own sheet)", () => {
  test("the file name carries the employee's last and first name", () => {
    const { fileName } = buildOwnAttendanceWorkbook({
      userData: makeUser(),
      cutoff: NOV_1ST,
      today: "2026-11-27",
    });
    expect(fileName).toBe("Attendance_Ramos_Angelica_November_1stCutoff_2026.xlsx");
  });

  test("a name with spaces is joined with underscores; no employee record falls back to Employee", () => {
    const user = makeUser();
    user.employee = { ...user.employee, firstName: "Ma. Luisa", lastName: "Dela Cruz" };
    expect(
      buildOwnAttendanceWorkbook({ userData: user, cutoff: NOV_1ST, today: "2026-11-27" })
        .fileName,
    ).toBe("Attendance_Dela_Cruz_Ma._Luisa_November_1stCutoff_2026.xlsx");

    expect(
      buildOwnAttendanceWorkbook({
        userData: { ...makeUser(), employee: null },
        cutoff: NOV_1ST,
        today: "2026-11-27",
      }).fileName,
    ).toBe("Attendance_Employee_November_1stCutoff_2026.xlsx");
  });

  test("each day cell holds time in, time out and status; weekends show Rest Day", () => {
    const { workbook } = buildOwnAttendanceWorkbook({
      userData: makeUser(),
      cutoff: NOV_1ST,
      today: "2026-11-27",
    });
    const ws = roundTrip(workbook).Sheets[SHEET];

    expect(ws.C5.v).toBe("Ramos, Angelica");
    expect(ws.B5.v).toBe("AC-008");
    expect(dayCell(ws, 11)).toBe("07:55 - 17:02\nOn-Time");
    expect(dayCell(ws, 12)).toBe("07:55 - 19:30\nOn-Time");
    expect(dayCell(ws, 14)).toBe("Rest Day");
    expect(dayCell(ws, 15)).toBe("Rest Day");
    expect(dayCell(ws, 18)).toBe("08:17 - 17:10\nLate");
    expect(dayCell(ws, 25)).toBe("07:55 - 20:00\nOn-Time");

    // 15 day columns (F to T), none blank
    const days = Array.from({ length: 15 }, (_, i) => dayCell(ws, 11 + i));
    expect(days.every((v) => typeof v === "string" && v !== "")).toBe(true);
  });

  test("a past weekday without a record is Absent, today is Pending, later days are blank", () => {
    const records = seedRecords().filter((r) => {
      const key = r.date.toISOString().slice(0, 10);
      return key < "2026-11-20" && key !== "2026-11-13";
    });
    const { workbook } = buildOwnAttendanceWorkbook({
      userData: makeUser({ records }),
      cutoff: NOV_1ST,
      today: "2026-11-20",
    });
    const ws = roundTrip(workbook).Sheets[SHEET];

    expect(dayCell(ws, 13)).toBe("Absent");
    expect(dayCell(ws, 19)).toBe("07:55 - 17:02\nOn-Time");
    expect(dayCell(ws, 20)).toBe("Pending");
    [21, 22, 23, 24, 25].forEach((day) => expect(dayCell(ws, day)).toBe(""));
  });

  test("days before the start date show '-'", () => {
    const records = seedRecords().filter(
      (r) => r.date.toISOString().slice(0, 10) >= "2026-11-16",
    );
    const { workbook } = buildOwnAttendanceWorkbook({
      userData: makeUser({ records, startDate: "2026-11-16T00:00:00.000Z" }),
      cutoff: NOV_1ST,
      today: "2026-11-27",
    });
    const ws = roundTrip(workbook).Sheets[SHEET];

    [11, 12, 13, 14, 15].forEach((day) => expect(dayCell(ws, day)).toBe("-"));
    expect(dayCell(ws, 16)).toBe("07:55 - 17:02\nOn-Time");
  });

  test("the screen's list (same days) leaves out later days and keeps the rest in order", () => {
    const records = seedRecords().filter(
      (r) => r.date.toISOString().slice(0, 10) < "2026-11-20",
    );
    const days = ownCutoffDays(
      makeUser({ records }).attendance,
      { start: "2026-11-11", end: "2026-11-25" },
      { hireKey: "2025-09-01", todayKey: "2026-11-20" },
    );
    const shown = days.filter((d) => !d.upcoming);

    expect(days).toHaveLength(15);
    expect(shown.map((d) => d.date)).toEqual([
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
      "2026-11-16",
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
    ]);
    expect(shown.map((d) => d.behavior).slice(3)).toEqual([
      "Rest Day",
      "Rest Day",
      "On-Time",
      "On-Time",
      "Late",
      "On-Time",
      "Pending",
    ]);
    expect(shown[0].timeIn).toBe("07:55:00");
  });

  test("a weekend On-Leave row is a Rest Day; a weekday leave with no times shows its status", () => {
    const records = seedRecords().filter(
      (r) => r.date.toISOString().slice(0, 10) !== "2026-11-16",
    );
    ["2026-11-14", "2026-11-15", "2026-11-16"].forEach((ds) =>
      records.push({
        _id: `leave-${ds}`,
        userId: "u-aramos",
        date: new Date(`${ds}T00:00:00Z`),
        timeIn: null,
        timeOut: null,
        behavior: "On-Leave",
        leaveType: "Vacation Leave",
      }),
    );
    const { workbook } = buildOwnAttendanceWorkbook({
      userData: makeUser({ records }),
      cutoff: NOV_1ST,
      today: "2026-11-27",
    });
    const ws = roundTrip(workbook).Sheets[SHEET];

    expect(dayCell(ws, 14)).toBe("Rest Day");
    expect(dayCell(ws, 15)).toBe("Rest Day");
    expect(dayCell(ws, 16)).toBe("On-Leave");
  });
});
