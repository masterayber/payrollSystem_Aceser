import React from "react";
import "../styles/Attendance.css";
import Dropdown from "../components/Dropdown/Dropdown";

const Attendance = () => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <div className="main-content">
      <div className="user-track-container">
        <div className="user-track">
          <p>Total Hours worked</p>
          <div className="total-user-track">
            <span className="user-number">10</span>
            <span className="user-text">hours</span>
          </div>
        </div>
        <div className="user-track">
          <p>Total Overtime Hours</p>
          <div className="total-user-track">
            <span className="user-number">10</span>
            <span className="user-text">hours</span>
          </div>
        </div>
        <div className="user-track">
          <p>Total Lates</p>
          <div className="total-user-track">
            <span className="user-number">10</span>
          </div>
        </div>
        <div className="user-track">
          <p>Total Absences</p>
          <div className="total-user-track">
            <span className="user-number">10</span>
          </div>
        </div>
      </div>

      <Dropdown options={months} placeholder="Select A Month" />

      <div className="table-container">
        <div className="table-title">
          <p>Daily Attendance Log</p>
        </div>
        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Date</p>
            </article>
            <article className="table-header-container">
              <p>Time IN</p>
            </article>
            <article className="table-header-container">
              <p>Time OUT</p>
            </article>
            <article className="table-header-container">
              <p>Overtime</p>
            </article>
            <article className="table-header-container">
              <p>Behavior</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>01/13/25</p>
            </article>
            <article className="table-content-container">
              <p>07:43:00 AM</p>
            </article>
            <article className="table-content-container">
              <p>05:12:00 PM</p>
            </article>
            <article className="table-content-container">
              <p>--:--:--</p>
            </article>
            <article className="table-content-container">
              <p>On-Time</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>01/13/25</p>
            </article>
            <article className="table-content-container">
              <p>07:43:00 AM</p>
            </article>
            <article className="table-content-container">
              <p>05:12:00 PM</p>
            </article>
            <article className="table-content-container">
              <p>--:--:--</p>
            </article>
            <article className="table-content-container">
              <p>On-Time</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>01/13/25</p>
            </article>
            <article className="table-content-container">
              <p>07:43:00 AM</p>
            </article>
            <article className="table-content-container">
              <p>05:12:00 PM</p>
            </article>
            <article className="table-content-container">
              <p>--:--:--</p>
            </article>
            <article className="table-content-container">
              <p>On-Time</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>01/13/25</p>
            </article>
            <article className="table-content-container">
              <p>07:43:00 AM</p>
            </article>
            <article className="table-content-container">
              <p>05:12:00 PM</p>
            </article>
            <article className="table-content-container">
              <p>--:--:--</p>
            </article>
            <article className="table-content-container">
              <p>On-Time</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>01/13/25</p>
            </article>
            <article className="table-content-container">
              <p>07:43:00 AM</p>
            </article>
            <article className="table-content-container">
              <p>05:12:00 PM</p>
            </article>
            <article className="table-content-container">
              <p>--:--:--</p>
            </article>
            <article className="table-content-container">
              <p>On-Time</p>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
