import React from "react";
import "../styles/Dashboard.css";

const Dashboard = () => {
  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  return (
    <div>
      <div className="sidebar">
        <div className="company-container">
          <div className="aceser-logo">
            <img
              src="/assets/aceser-logo.jpg"
              alt="Company Logo"
              className="logo"
            />
          </div>
          <div className="aceser-text">
            <p>ACESER</p>
          </div>
        </div>

        <div className="sidebar-toolkit">
          <div className="sidebar-toolkit-icon">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M13 9V3H21V9H13ZM3 13V3H11V13H3ZM13 21V11H21V21H13ZM3 21V15H11V21H3Z"
                fill="#404040"
              />
            </svg>
          </div>
          <div className="sidebar-toolkit-text">
            <p>Dashboard</p>
          </div>
        </div>
        <div className="sidebar-toolkit">
          <div className="sidebar-toolkit-icon">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M13 9V3H21V9H13ZM3 13V3H11V13H3ZM13 21V11H21V21H13ZM3 21V15H11V21H3Z"
                fill="#404040"
              />
            </svg>
          </div>
          <div className="sidebar-toolkit-text">
            <p>Payroll</p>
          </div>
        </div>
        <div className="sidebar-toolkit">
          <div className="sidebar-toolkit-icon">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M13 9V3H21V9H13ZM3 13V3H11V13H3ZM13 21V11H21V21H13ZM3 21V15H11V21H3Z"
                fill="#404040"
              />
            </svg>
          </div>
          <div className="sidebar-toolkit-text">
            <p>Pay Slips</p>
          </div>
        </div>
        <div className="sidebar-toolkit">
          <div className="sidebar-toolkit-icon">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M13 9V3H21V9H13ZM3 13V3H11V13H3ZM13 21V11H21V21H13ZM3 21V15H11V21H3Z"
                fill="#404040"
              />
            </svg>
          </div>
          <div className="sidebar-toolkit-text">
            <p>Attendance</p>
          </div>
        </div>
        <div className="sidebar-toolkit">
          <div className="sidebar-toolkit-icon">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M13 9V3H21V9H13ZM3 13V3H11V13H3ZM13 21V11H21V21H13ZM3 21V15H11V21H3Z"
                fill="#404040"
              />
            </svg>
          </div>
          <div className="sidebar-toolkit-text">
            <p>Calendar</p>
          </div>
        </div>
        <div className="sidebar-toolkit">
          <div className="sidebar-toolkit-icon">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M13 9V3H21V9H13ZM3 13V3H11V13H3ZM13 21V11H21V21H13ZM3 21V15H11V21H3Z"
                fill="#404040"
              />
            </svg>
          </div>
          <div className="sidebar-toolkit-text">
            <p>Filing</p>
          </div>
        </div>
      </div>
      <div>
        <div className="header"></div>
      </div>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default Dashboard;
