import { useState } from "react";
import PropTypes from "prop-types";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import "./CalendarComponent.css";

const CalendarComponent = ({
  attendanceData = [],
  currentDate: currentDateProp,
  setCurrentDate: setCurrentDateProp,
  userId,
  isAdmin = false,
}) => {
  const [selectedDay, setSelectedDay] = useState(null);
  const [internalDate, setInternalDate] = useState(new Date());

  const currentDate = currentDateProp || internalDate;
  const setCurrentDate = setCurrentDateProp || setInternalDate;

  const changeMonth = (offset) => {
    setCurrentDate((prevDate) => {
      const dateToUse = prevDate || new Date();
      const newDate = new Date(
        dateToUse.getFullYear(),
        dateToUse.getMonth() + offset,
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
    if (!userId || isAdmin) return null;

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

    if (
      dateObj < todayObj &&
      dateObj.getDay() !== 0 &&
      dateObj.getDay() !== 6
    ) {
      return "Absent";
    }

    return null;
  };

  const getDayBadge = (day) => {
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
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="calendar-button"
            aria-label="Previous month"
          >
            <IconChevronLeft
              stroke={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </button>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="calendar-button"
            aria-label="Next month"
          >
            <IconChevronRight
              stroke={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </button>
        </div>
      </div>
      <table className="calendar-table" aria-label="Attendance calendar">
        <thead>
          <tr>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <th key={day} scope="col">
                {day}
              </th>
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
                    className={[
                      day && isCurrentMonth && day === today ? "today" : "",
                      day && day === selectedDay ? "selected" : "",
                      day && dayBadge ? `attendance-${dayBadge}` : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <button
                      type="button"
                      className="calendar-day-button"
                      onClick={() => day && setSelectedDay(day)}
                      disabled={!day}
                      aria-pressed={day ? day === selectedDay : undefined}
                      aria-label={
                        day
                          ? new Date(
                              currentDate.getFullYear(),
                              currentDate.getMonth(),
                              day,
                            ).toLocaleDateString("en-US", {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })
                          : undefined
                      }
                    >
                      <span className="day-content">
                        {day || ""}
                        {day && dayBadge && (
                          <span
                            className={`day-badge badge-${dayBadge}`}
                            aria-hidden="true"
                          ></span>
                        )}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {!isAdmin && (
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
      )}
    </div>
  );
};

export default CalendarComponent;

CalendarComponent.propTypes = {
  attendanceData: PropTypes.array,
  currentDate: PropTypes.instanceOf(Date),
  setCurrentDate: PropTypes.func,
  userId: PropTypes.string,
  isAdmin: PropTypes.bool,
};
