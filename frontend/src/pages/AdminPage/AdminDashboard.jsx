import React, { useContext } from "react";
import { UserContext } from "../../context/UserContext";
import { EmployeeContext } from "../../context/EmployeeContext";
import "../../styles/AdminCSS/AdminDashboard.css";
import "../../components/TimeDate/TimeDate";
import TimeDate from "../../components/TimeDate/TimeDate";
import Calendar from "../../components/CalendarComponent/CalendarComponent";
import AttendanceChart from "../../components/AttendanceChart/AttendanceChart";

const AdminDashboard = () => {
  const { userData } = useContext(UserContext);
  const { employeeData } = useContext(EmployeeContext);

  const attendanceData = {
    onTime: 150,
    late: 17,
    absent: 7,
    leave: 3,
  };

  return (
    <div className="main-content">
      <div className="user-greetings-container">
        <div className="message-container">
          <div className="user-message">
            <span>Good Day, </span>
            <span className="user-highlight">{userData?.firstName}</span>
            <span>!</span>
          </div>
          <p>{employeeData.length} Employees have timed in today!</p>
        </div>

        <TimeDate />
      </div>

      <div className="user-track-container">
        <div className="user-track">
          <p>Total Employees</p>
          <div className="user-number">{employeeData.length}</div>
        </div>
        <div className="user-track">
          <p>Total Employees Timed In</p>
          <div className="user-number">{employeeData.length}</div>
        </div>
        <div className="user-track">
          <p>Total Employees Timed Out</p>
          <div className="user-number">{employeeData.length}</div>
        </div>
      </div>

      <div className="user-track-container">
        <div className="user-track">
          <div className="user-track-title">
            <p>Calendar</p>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10.7998 18.3C10.7998 17.9022 10.9578 17.5206 11.2391 17.2393C11.5204 16.958 11.902 16.8 12.2998 16.8C12.6976 16.8 13.0792 16.958 13.3605 17.2393C13.6418 17.5206 13.7998 17.9022 13.7998 18.3C13.7998 18.6978 13.6418 19.0794 13.3605 19.3607C13.0792 19.642 12.6976 19.8 12.2998 19.8C11.902 19.8 11.5204 19.642 11.2391 19.3607C10.9578 19.0794 10.7998 18.6978 10.7998 18.3ZM10.7998 12.3C10.7998 11.9022 10.9578 11.5206 11.2391 11.2393C11.5204 10.958 11.902 10.8 12.2998 10.8C12.6976 10.8 13.0792 10.958 13.3605 11.2393C13.6418 11.5206 13.7998 11.9022 13.7998 12.3C13.7998 12.6978 13.6418 13.0794 13.3605 13.3607C13.0792 13.642 12.6976 13.8 12.2998 13.8C11.902 13.8 11.5204 13.642 11.2391 13.3607C10.9578 13.0794 10.7998 12.6978 10.7998 12.3ZM10.7998 6.3C10.7998 5.90218 10.9578 5.52065 11.2391 5.23934C11.5204 4.95804 11.902 4.8 12.2998 4.8C12.6976 4.8 13.0792 4.95804 13.3605 5.23934C13.6418 5.52065 13.7998 5.90218 13.7998 6.3C13.7998 6.69783 13.6418 7.07936 13.3605 7.36066C13.0792 7.64197 12.6976 7.8 12.2998 7.8C11.902 7.8 11.5204 7.64197 11.2391 7.36066C10.9578 7.07936 10.7998 6.69783 10.7998 6.3Z"
                fill="#0A0A0A"
              />
            </svg>
          </div>
          <Calendar />
        </div>
        <div className="user-track">
          <div className="user-track-title">
            <p>Today&apos;s Attendance</p>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10.7998 18.3C10.7998 17.9022 10.9578 17.5206 11.2391 17.2393C11.5204 16.958 11.902 16.8 12.2998 16.8C12.6976 16.8 13.0792 16.958 13.3605 17.2393C13.6418 17.5206 13.7998 17.9022 13.7998 18.3C13.7998 18.6978 13.6418 19.0794 13.3605 19.3607C13.0792 19.642 12.6976 19.8 12.2998 19.8C11.902 19.8 11.5204 19.642 11.2391 19.3607C10.9578 19.0794 10.7998 18.6978 10.7998 18.3ZM10.7998 12.3C10.7998 11.9022 10.9578 11.5206 11.2391 11.2393C11.5204 10.958 11.902 10.8 12.2998 10.8C12.6976 10.8 13.0792 10.958 13.3605 11.2393C13.6418 11.5206 13.7998 11.9022 13.7998 12.3C13.7998 12.6978 13.6418 13.0794 13.3605 13.3607C13.0792 13.642 12.6976 13.8 12.2998 13.8C11.902 13.8 11.5204 13.642 11.2391 13.3607C10.9578 13.0794 10.7998 12.6978 10.7998 12.3ZM10.7998 6.3C10.7998 5.90218 10.9578 5.52065 11.2391 5.23934C11.5204 4.95804 11.902 4.8 12.2998 4.8C12.6976 4.8 13.0792 4.95804 13.3605 5.23934C13.6418 5.52065 13.7998 5.90218 13.7998 6.3C13.7998 6.69783 13.6418 7.07936 13.3605 7.36066C13.0792 7.64197 12.6976 7.8 12.2998 7.8C11.902 7.8 11.5204 7.64197 11.2391 7.36066C10.9578 7.07936 10.7998 6.69783 10.7998 6.3Z"
                fill="#0A0A0A"
              />
            </svg>
          </div>
          <AttendanceChart attendanceData={attendanceData} />
        </div>
      </div>

      <div className="table-container">
        <div className="table-title">
          <p>Payroll Summary</p>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10.7998 18.3C10.7998 17.9022 10.9578 17.5206 11.2391 17.2393C11.5204 16.958 11.902 16.8 12.2998 16.8C12.6976 16.8 13.0792 16.958 13.3605 17.2393C13.6418 17.5206 13.7998 17.9022 13.7998 18.3C13.7998 18.6978 13.6418 19.0794 13.3605 19.3607C13.0792 19.642 12.6976 19.8 12.2998 19.8C11.902 19.8 11.5204 19.642 11.2391 19.3607C10.9578 19.0794 10.7998 18.6978 10.7998 18.3ZM10.7998 12.3C10.7998 11.9022 10.9578 11.5206 11.2391 11.2393C11.5204 10.958 11.902 10.8 12.2998 10.8C12.6976 10.8 13.0792 10.958 13.3605 11.2393C13.6418 11.5206 13.7998 11.9022 13.7998 12.3C13.7998 12.6978 13.6418 13.0794 13.3605 13.3607C13.0792 13.642 12.6976 13.8 12.2998 13.8C11.902 13.8 11.5204 13.642 11.2391 13.3607C10.9578 13.0794 10.7998 12.6978 10.7998 12.3ZM10.7998 6.3C10.7998 5.90218 10.9578 5.52065 11.2391 5.23934C11.5204 4.95804 11.902 4.8 12.2998 4.8C12.6976 4.8 13.0792 4.95804 13.3605 5.23934C13.6418 5.52065 13.7998 5.90218 13.7998 6.3C13.7998 6.69783 13.6418 7.07936 13.3605 7.36066C13.0792 7.64197 12.6976 7.8 12.2998 7.8C11.902 7.8 11.5204 7.64197 11.2391 7.36066C10.9578 7.07936 10.7998 6.69783 10.7998 6.3Z"
              fill="#0A0A0A"
            />
          </svg>
        </div>
        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Pay Period</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Gross Pay</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Deduction</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Net Pay</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>02/11/25 - 02/25/25</p>
            </article>
            <article className="table-content-container">
              <p>0000000.00</p>
            </article>
            <article className="table-content-container">
              <p>0000000.00</p>
            </article>
            <article className="table-content-container">
              <p>0000000.00</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>01/26/25 - 02/10/25</p>
            </article>
            <article className="table-content-container">
              <p>0000000.00</p>
            </article>
            <article className="table-content-container">
              <p>0000000.00</p>
            </article>
            <article className="table-content-container">
              <p>0000000.00</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>01/11/25 - 01/25/25</p>
            </article>
            <article className="table-content-container">
              <p>0000000.00</p>
            </article>
            <article className="table-content-container">
              <p>0000000.00</p>
            </article>
            <article className="table-content-container">
              <p>0000000.00</p>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
