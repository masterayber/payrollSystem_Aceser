import { useState, useEffect } from "react";
import "./TimeDate.css";

const TimeDate = () => {
  const [currentTimedate, setCurrentTimeDate] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeDate(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formattedDate = currentTimedate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedTime = currentTimedate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <div className="date-details">
      <div className="admin-date">
        <span>{formattedDate}</span>
      </div>
      <div className="admin-time">
        <span>{formattedTime}</span>
      </div>
    </div>
  );
};

export default TimeDate;
