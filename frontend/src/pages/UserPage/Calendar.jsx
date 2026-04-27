import { useContext } from "react";
import "../../styles/UserCSS/Calendar.css";
import CalendarComponent from "../../components/CalendarComponent/CalendarComponent";
import { AttendanceContext } from "../../context/AttendanceContext";
import { FilingContext } from "../../context/FilingContext";

const Calendar = () => {
  const { attendanceData } = useContext(AttendanceContext);
  const { leaveRequests } = useContext(FilingContext);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthAttendance = attendanceData.filter((record) => {
    const recordDate = new Date(record.date);
    return (
      recordDate.getMonth() === currentMonth &&
      recordDate.getFullYear() === currentYear
    );
  });

  const presentDays = currentMonthAttendance.filter(
    (record) => record.behavior === "On-Time",
  ).length;
  const lateDays = currentMonthAttendance.filter(
    (record) => record.behavior === "Late",
  ).length;
  const absentDays = currentMonthAttendance.filter(
    (record) => record.behavior === "Absent",
  ).length;
  const workDays = presentDays + lateDays;

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
          <p>Total Present</p>
          <div className="total-user-track">
            <span className="user-number">{presentDays}</span>
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
        />
      </div>
    </div>
  );
};

export default Calendar;
