import { useState, useContext } from "react";
import "../../styles/UserCSS/Calendar.css";
import CalendarComponent from "../../components/CalendarComponent/CalendarComponent";
import { AttendanceContext } from "../../context/AttendanceContext";
import { FilingContext } from "../../context/FilingContext";

const Calendar = () => {
  const { attendanceData } = useContext(AttendanceContext);
  const { leaveRequests } = useContext(FilingContext);

  const [currentDate, setCurrentDate] = useState(new Date());

  const formatDateISO = (date) =>
    new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];

  const currentMonthAttendance = attendanceData.filter((record) => {
    const recordDate = new Date(record.date + "T00:00:00");
    return (
      recordDate.getMonth() === currentDate.getMonth() &&
      recordDate.getFullYear() === currentDate.getFullYear()
    );
  });

  const getWorkDaysInMonth = (year, month) => {
    const days = [];
    const date = new Date(year, month, 1);

    while (date.getMonth() === month) {
      const day = date.getDay();
      if (day !== 0 && day !== 6) {
        days.push(formatDateISO(date));
      }
      date.setDate(date.getDate() + 1);
    }

    return days;
  };

  const workDaysList = getWorkDaysInMonth(
    currentDate.getFullYear(),
    currentDate.getMonth(),
  );

  const attendanceMap = new Set(
    currentMonthAttendance.map((rec) => rec.date.split("T")[0]),
  );

  const absentDays = workDaysList.filter(
    (date) => !attendanceMap.has(date),
  ).length;

  const attendanceByDate = new Map();

  currentMonthAttendance.forEach((rec) => {
    const dateKey = rec.date.split("T")[0];

    if (!attendanceByDate.has(dateKey)) {
      attendanceByDate.set(dateKey, rec.behavior);
    } else {
      const existing = attendanceByDate.get(dateKey);

      if (existing === "On-Time" && rec.behavior === "Late") {
        attendanceByDate.set(dateKey, "Late");
      }
    }
  });

  let onTimeDays = 0;
  let lateDays = 0;

  attendanceByDate.forEach((behavior) => {
    if (behavior === "On-Time") onTimeDays++;
    if (behavior === "Late") lateDays++;
  });

  const uniqueAttendanceDays = new Set(
    currentMonthAttendance.map((rec) => rec.date.split("T")[0]),
  );

  const workDays = uniqueAttendanceDays.size;

  return (
    <div className="main-content">
      <div className="user-track-container">
        <div className="user-track">
          <p>Total days worked this month</p>
          <div className="total-user-track">
            <span className="user-number">{workDays}</span>
            <span className="user-text">days</span>
          </div>
        </div>
      </div>

      <div className="user-track-container">
        <div className="user-track">
          <p>Total On-Time</p>
          <div className="total-user-track">
            <span className="user-number">{onTimeDays}</span>
          </div>
        </div>

        <div className="user-track">
          <p>Total Late</p>
          <div className="total-user-track">
            <span className="user-number">{lateDays}</span>
          </div>
        </div>

        <div className="user-track">
          <p>Total Absent</p>
          <div className="total-user-track">
            <span className="user-number">{absentDays}</span>
          </div>
        </div>
      </div>

      <div className="table-container">
        <CalendarComponent
          attendanceData={attendanceData}
          leaveRequests={leaveRequests}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
        />
      </div>
    </div>
  );
};

export default Calendar;
