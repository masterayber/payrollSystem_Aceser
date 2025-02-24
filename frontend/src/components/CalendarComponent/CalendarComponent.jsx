import { useState } from "react";
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
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          onClick={() => changeMonth(-1)}
          className="calendar-button"
        >
          <path
            d="M14.0832 16.6666L9.9165 12.5L14.0832 8.33329"
            stroke="black"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          {currentDate.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </span>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          onClick={() => changeMonth(1)}
          className="calendar-button"
        >
          <path
            d="M9.91683 8.33337L14.0835 12.5L9.91683 16.6667"
            stroke="black"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
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
