import { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import "./CalendarComponent.css";

const CalendarComponent = ({
  attendanceData = [],
  leaveRequests = [],
  currentDate,
  setCurrentDate,
  userId,
}) => {
  const [selectedDay, setSelectedDay] = useState(null);

  const changeMonth = (offset) => {
    setCurrentDate((prevDate) => {
      const newDate = new Date(
        prevDate.getFullYear(),
        prevDate.getMonth() + offset,
        1,
      );
      return newDate;
    });
  };

  const getMonthDays = (year, month) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let daysArray = [];
    let week = Array(firstDay).fill(null);

    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day);
      if (week.length === 7 || day === daysInMonth) {
        daysArray.push(week);
        week = [];
      }
    }

    return daysArray;
  };

  const getAttendanceStatus = (day) => {
    const dateStr = `${currentDate.getFullYear()}-${String(
      currentDate.getMonth() + 1,
    ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const dateObj = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day,
    );
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    if (dateObj >= todayObj) return null;

    const attendance = attendanceData.find((record) => {
      const recordDate = record.date.split("T")[0];
      const [y, m] = recordDate.split("-").map(Number);
      const recordUserId = record.userId?._id || record.userId;
      return (
        String(recordUserId) === String(userId) &&
        y === currentDate.getFullYear() &&
        m === currentDate.getMonth() + 1 &&
        recordDate === dateStr
      );
    });

    if (attendance) return attendance.behavior;

    if (dateObj.getDay() !== 0 && dateObj.getDay() !== 6) return "Absent";

    return null;
  };

  const getLeaveStatus = useMemo(() => {
    return (day) => {
      const currentDateObj = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day,
      );

      const leave = leaveRequests.find((req) => {
        const startDate = new Date(req.startDate);
        const endDate = new Date(req.endDate);

        return (
          currentDateObj >= startDate &&
          currentDateObj <= endDate &&
          req.status === "Approved"
        );
      });

      return leave ? leave.status : null;
    };
  }, [leaveRequests, currentDate]);

  const getDayBadge = (day) => {
    const leaveStatus = getLeaveStatus(day);
    if (leaveStatus === "Approved") {
      return "leave";
    }

    const attendanceStatus = getAttendanceStatus(day);
    if (attendanceStatus === "On-Time") return "present";
    if (attendanceStatus === "Late") return "late";
    if (attendanceStatus === "Absent") return "absent";
    if (attendanceStatus === "Early-Out") return "early-out";
    if (attendanceStatus === "Half-Day") return "half-day";
    if (attendanceStatus === "On-Leave") return "leave";

    return null;
  };

  const monthDays = getMonthDays(
    currentDate.getFullYear(),
    currentDate.getMonth(),
  );
  const today = new Date().getDate();
  const isCurrentMonth =
    currentDate.getFullYear() === new Date().getFullYear() &&
    currentDate.getMonth() === new Date().getMonth();

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <span>
          {currentDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </span>
        <div className="calendar-navigate">
          <IconChevronLeft
            stroke={3}
            onClick={() => changeMonth(-1)}
            className="calendar-button"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <IconChevronRight
            stroke={3}
            onClick={() => changeMonth(1)}
            className="calendar-button"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </div>
      </div>
      <table className="calendar-table">
        <thead>
          <tr>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <th key={day}>{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthDays.map((week, index) => (
            <tr key={index}>
              {week.map((day, idx) => {
                const dayBadge = day ? getDayBadge(day) : null;

                return (
                  <td
                    key={idx}
                    onClick={() => day && setSelectedDay(day)}
                    className={[
                      day && isCurrentMonth && day === today ? "today" : "",
                      day && day === selectedDay ? "selected" : "",
                      day && dayBadge ? `attendance-${dayBadge}` : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="day-content">
                      {day || ""}
                      {day && dayBadge && (
                        <div className={`day-badge badge-${dayBadge}`}></div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="calendar-legend">
        <div className="legend-item">
          <div className="legend-badge present"></div>
          <span>Present</span>
        </div>
        <div className="legend-item">
          <div className="legend-badge late"></div>
          <span>Late</span>
        </div>
        <div className="legend-item">
          <div className="legend-badge absent"></div>
          <span>Absent</span>
        </div>
        <div className="legend-item">
          <div className="legend-badge leave"></div>
          <span>Leave</span>
        </div>
        <div className="legend-item">
          <div className="legend-badge half-day"></div>
          <span>Half-Day</span>
        </div>
      </div>
    </div>
  );
};

export default CalendarComponent;

CalendarComponent.propTypes = {
  attendanceData: PropTypes.array,
  leaveRequests: PropTypes.array,
  currentDate: PropTypes.instanceOf(Date),
  setCurrentDate: PropTypes.func,
  userId: PropTypes.string,
};
