import { useState, useContext } from "react";
import "../../styles/UserCSS/Calendar.css";
import CalendarComponent from "../../components/CalendarComponent/CalendarComponent";
import { UserContext } from "../../context/UserContext";

const Calendar = () => {
  const { userData } = useContext(UserContext);
  const attendanceData = userData?.attendance || [];

  const [currentDate, setCurrentDate] = useState(new Date());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDateISO = (date) =>
    new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];

  const currentMonthAttendance = attendanceData.filter((record) => {
    const recordDate = new Date(record.date + "T00:00:00");
    const recordUserId = record.userId?._id || record.userId;

    return (
      String(recordUserId) === String(userData._id) &&
      recordDate.getMonth() === currentDate.getMonth() &&
      recordDate.getFullYear() === currentDate.getFullYear()
    );
  });

  const getWorkDaysInMonth = (year, month) => {
    const days = [];
    const date = new Date(year, month, 1);

    while (date.getMonth() === month) {
      const day = date.getDay();
      const dateISO = formatDateISO(date);
      if (day !== 0 && day !== 6 && new Date(date) < today) {
        days.push(dateISO);
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
  let onLeaveDays = 0;

  attendanceByDate.forEach((behavior) => {
    if (behavior === "On-Time") onTimeDays++;
    if (behavior === "Late") lateDays++;
    if (behavior === "On-Leave") onLeaveDays++;
  });

  const workDays = [
    ...new Set(currentMonthAttendance.map((rec) => rec.date.split("T")[0])),
  ].filter((date) => new Date(date + "T00:00:00") <= today).length;

  return (
    <div className="main-content">
      <div className="data-card-container">
        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Total days worked</div>
            <div className="data-value">{workDays}</div>
          </div>
        </div>

        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Total On-Time</div>
            <div className="data-value">{onTimeDays}</div>
          </div>
        </div>

        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Total Late</div>
            <div className="data-value">{lateDays}</div>
          </div>
        </div>

        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Total On-Leave</div>
            <div className="data-value">{onLeaveDays}</div>
          </div>
        </div>

        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Total Absent</div>
            <div className="data-value">{absentDays}</div>
          </div>
        </div>
      </div>

      <div className="table-container">
        <CalendarComponent
          attendanceData={attendanceData}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          userId={userData._id}
        />
      </div>
    </div>
  );
};

export default Calendar;
