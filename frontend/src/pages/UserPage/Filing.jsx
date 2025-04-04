import React from "react";
import "../../styles/UserCSS/Filing.css";

const Filing = () => {
  return (
    <div className="main-content">
      <div className="user-track-container">
        <div className="user-track">
          <p>Total Leave Requests</p>
          <div className="total-user-track">
            <span className="user-number">12</span>
          </div>
        </div>

        <div className="user-track">
          <p>Total Overtime Request</p>
          <div className="total-user-track">
            <span className="user-number">1</span>
          </div>
        </div>
      </div>

      <div className="application-container">
        <div className="leave-application">
          <p>Application for Leave</p>
          <button className="apply-button">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5.5 12H19.5M12.5 5V19"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Apply
          </button>
        </div>

        <div className="overtime-application">
          <p>Application for Overtime</p>
          <button className="apply-button">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5.5 12H19.5M12.5 5V19"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Apply
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-title">
          <p>Leave Requests</p>
        </div>
        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Date Filed</p>
            </article>
            <article className="table-header-container">
              <p>Date Requested</p>
            </article>
            <article className="table-header-container">
              <p>Leave Type</p>
            </article>
            <article className="table-header-container">
              <p>Attachment</p>
            </article>
            <article className="table-header-container">
              <p>Status</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>01/13/25</p>
            </article>
            <article className="table-content-container">
              <p>01/17/25</p>
            </article>
            <article className="table-content-container">
              <p>Vacation Leave</p>
            </article>
            <article className="table-content-container">
              <p>N/A</p>
            </article>
            <article className="table-content-container">
              <p>Pending</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>01/13/25</p>
            </article>
            <article className="table-content-container">
              <p>01/17/25</p>
            </article>
            <article className="table-content-container">
              <p>Vacation Leave</p>
            </article>
            <article className="table-content-container">
              <p>N/A</p>
            </article>
            <article className="table-content-container">
              <p>Pending</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>01/13/25</p>
            </article>
            <article className="table-content-container">
              <p>01/17/25</p>
            </article>
            <article className="table-content-container">
              <p>Vacation Leave</p>
            </article>
            <article className="table-content-container">
              <p>N/A</p>
            </article>
            <article className="table-content-container">
              <p>Pending</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>01/13/25</p>
            </article>
            <article className="table-content-container">
              <p>01/17</p>
            </article>
            <article className="table-content-container">
              <p>Vacation Leave</p>
            </article>
            <article className="table-content-container">
              <p>N/A</p>
            </article>
            <article className="table-content-container">
              <p>Pending</p>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Filing;
