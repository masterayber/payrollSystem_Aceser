import { useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import "./CalendarComponent.css";

const CalendarComponent = () => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const changeMonth = (offset) => {
    setCurrentDate((prevDate) => {
      const newDate = new Date(
        prevDate.getFullYear(),
        prevDate.getMonth() + offset,
        1
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

  const monthDays = getMonthDays(
    currentDate.getFullYear(),
    currentDate.getMonth()
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
              {week.map((day, idx) => (
                <td
                  key={idx}
                  className={
                    day && isCurrentMonth && day === today ? "today" : ""
                  }
                >
                  {day || ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CalendarComponent;
