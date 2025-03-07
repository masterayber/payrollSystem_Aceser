import React, { useState } from "react";
import "../styles/Calendar.css";
import CalendarComponent from "../components/CalendarComponent/CalendarComponent";

const Calendar = () => {
  return (
    <div className="main-content">
      <div className="user-track-container">
        <div className="user-track">
          <p>Total days worked this month</p>
          <div className="total-user-track">
            <span className="user-number">12</span>
            <span className="user-text">days</span>
          </div>
        </div>
      </div>

      <div className="user-track-container">
        <div className="user-track">
          <p>Total Present</p>
          <div className="total-user-track">
            <span className="user-number">12</span>
          </div>
        </div>

        <div className="user-track">
          <p>Total Late</p>
          <div className="total-user-track">
            <span className="user-number">0</span>
          </div>
        </div>

        <div className="user-track">
          <p>Total Absent</p>
          <div className="total-user-track">
            <span className="user-number">0</span>
          </div>
        </div>
      </div>

      <div className="table-container">
        <CalendarComponent />
      </div>
    </div>
  );
};

export default Calendar;
