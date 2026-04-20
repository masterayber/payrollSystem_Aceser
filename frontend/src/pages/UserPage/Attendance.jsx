import { useState, useContext, useEffect } from "react";
import { UserContext } from "../../context/UserContext";
import { formatDate, formatFullMonthDate } from "../../utils/dateFormatter";
import "../../styles/UserCSS/Attendance.css";
import Dropdown from "../../components/Dropdown/Dropdown";
import API from "../../api";
import Pagination from "../../components/Pagination/Pagination";

const Attendance = () => {
  const { userData } = useContext(UserContext);
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

  const [userAttendance, setUserAttendance] = useState([]);

  const handleUserAttendance = async () => {
    try {
      const response = await API.get(`/api/attendance/${userData._id}`);
      setUserAttendance(response.data.data);
    } catch (error) {
      console.error("Error fetching user attendance:", error);
    }
  };

  useEffect(() => {
    handleUserAttendance();
  });

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

      <Dropdown options={months} value="" placeholder="Select A Month" />

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
          {userAttendance.length === 0 ? (
            <div className="table-content">
              <article className="table-content-container">
                <h6 className="no-data">No Attendance Available</h6>
              </article>
            </div>
          ) : (
            userAttendance.slice(0, 7).map((att) => (
              <div key={att._id} className="table-content">
                <article className="table-content-container">
                  <p>{formatFullMonthDate(att.date)}</p>
                </article>
                <article className="table-content-container">
                  <p>{att.timeIn}</p>
                </article>
                <article className="table-content-container">
                  <p>{att.timeOut}</p>
                </article>
                <article className="table-content-container">
                  <p>zzz</p>
                </article>
                <article className="table-content-container">
                  <p>{att.behavior}</p>
                </article>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Attendance;
