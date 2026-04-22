import { useState, useContext, useEffect } from "react";
import { UserContext } from "../../context/UserContext";
import { formatFullMonthDate } from "../../utils/dateFormatter";
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
  const [selectedMonth, setSelectedMonth] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;
  const filteredAttendance = selectedMonth
    ? userAttendance.filter((att) => {
        const attendanceMonth = new Date(att.date).getMonth();
        const selectedMonthIndex = months.indexOf(selectedMonth);
        return attendanceMonth === selectedMonthIndex;
      })
    : userAttendance;

  const totalPages = Math.ceil(filteredAttendance.length / itemsPerPage);

  const calculateMetrics = () => {
    let totalHours = 0;
    let totalOvertimeHours = 0;
    let totalLates = 0;
    let totalAbsences = 0;

    filteredAttendance.forEach((att) => {
      if (att.timeIn && att.timeOut) {
        const [inHour, inMin] = att.timeIn.split(":").map(Number);
        const [outHour, outMin] = att.timeOut.split(":").map(Number);
        const inMinutes = inHour * 60 + inMin;
        const outMinutes = outHour * 60 + outMin;
        const workedMinutes = outMinutes - inMinutes;
        totalHours += workedMinutes / 60;
      }

      if (att.overtime?.isEligible && att.overtime?.hours) {
        totalOvertimeHours += att.overtime.hours;
      }

      if (att.behavior === "Late") totalLates++;
      if (att.behavior === "Absent") totalAbsences;
    });

    return {
      totalHours: totalHours.toFixed(2),
      totalOvertimeHours: totalOvertimeHours.toFixed(2),
      totalLates,
      totalAbsences,
    };
  };

  const metrics = calculateMetrics();

  const handleMonthChange = (month) => {
    setSelectedMonth(month);
    setCurrentPage(1);
  };

  useEffect(() => {
    const handleUserAttendance = async () => {
      try {
        const response = await API.get(`/api/attendance/${userData._id}`);
        setUserAttendance(response.data.data);
        setCurrentPage(1);
        setSelectedMonth("");
      } catch (error) {
        console.error("Error fetching user attendance:", error);
      }
    };

    if (userData._id) {
      handleUserAttendance();
    }
  }, [userData._id]);

  return (
    <div className="main-content">
      <div className="user-track-container">
        <div className="user-track">
          <p>Total Hours worked</p>
          <div className="total-user-track">
            <span className="user-number">{metrics.totalHours}</span>
            <span className="user-text">hours</span>
          </div>
        </div>
        <div className="user-track">
          <p>Total Overtime Hours</p>
          <div className="total-user-track">
            <span className="user-number">{metrics.totalOvertimeHours}</span>
            <span className="user-text">hours</span>
          </div>
        </div>
        <div className="user-track">
          <p>Total Lates</p>
          <div className="total-user-track">
            <span className="user-number">{metrics.totalLates}</span>
          </div>
        </div>
        <div className="user-track">
          <p>Total Absences</p>
          <div className="total-user-track">
            <span className="user-number">{metrics.totalAbsences}</span>
          </div>
        </div>
      </div>

      <Dropdown
        options={months}
        value={selectedMonth}
        placeholder="Select A Month"
        onSelect={handleMonthChange}
      />

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
          {filteredAttendance.length === 0 ? (
            <div className="table-content">
              <article className="table-content-container">
                <h6 className="no-data">No Attendance Available</h6>
              </article>
            </div>
          ) : (
            filteredAttendance
              .slice(
                (currentPage - 1) * itemsPerPage,
                currentPage * itemsPerPage,
              )
              .map((att) => (
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
                    <p>
                      {att.overtime?.isEligible
                        ? `${att.overtime.hours.toFixed(2)} hrs`
                        : "-"}
                    </p>
                  </article>
                  <article className="table-content-container">
                    <p>{att.behavior}</p>
                  </article>
                </div>
              ))
          )}
        </div>

        {filteredAttendance.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  );
};

export default Attendance;
