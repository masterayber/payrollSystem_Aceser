import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconDotsVertical, IconLogin2, IconLogout2 } from "@tabler/icons-react";
import { UserContext } from "../../context/UserContext";
import { formatDate, formatTime } from "../../utils/dateFormatter";
import { calculateMonthlySummary } from "../../../../backend/utils/attendance/summary";
import { calculateLeaveSummary } from "../../utils/leave/summary";
import { calculateWeeklySummary } from "../../../../backend/utils/attendance/weeklySummary";
import "../../styles/UserCSS/Dashboard.css";
import TimeDate from "../../components/TimeDate/TimeDate";

const Dashboard = () => {
  const { userData, loading } = useContext(UserContext);
  const [showLeaveDropdown, setShowLeaveDropdown] = useState(false);
  const [showDailyDropdown, setShowDailyDropdown] = useState(false);

  const navigate = useNavigate();

  const leaveDropdownRef = useRef(null);
  const leaveMenuButtonRef = useRef(null);

  const dailyDropdownRef = useRef(null);
  const dailyMenuButtonRef = useRef(null);

  const toggleLeaveDropdown = (event) => {
    event.stopPropagation();
    setShowLeaveDropdown((prev) => !prev);
    setShowDailyDropdown(false);
  };

  const toggleDailyDropdown = (event) => {
    event.stopPropagation();
    setShowDailyDropdown((prev) => !prev);
    setShowLeaveDropdown(false);
  };

  const todayDate = new Date().toISOString().slice(0, 10);

  const attendanceData = [...(userData?.attendance || [])]
    .filter((att) => att.date <= todayDate)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const leaveRequestsData = userData?.leaveRequests || [];

  const attendanceSummary = calculateMonthlySummary(attendanceData);
  const weeklySummary = calculateWeeklySummary(attendanceData);
  const leaveSummary = calculateLeaveSummary(leaveRequestsData);

  const todayAttendance = attendanceData.find(
    (record) => record.date === todayDate,
  );

  const getTimingMessage = () => {
    if (!todayAttendance || !todayAttendance.timeIn) {
      return `You have no time in yet today.`;
    }
    const scheduledTimeIn = new Date(`${todayDate}T08:00:00`);
    const actualTimeIn = new Date(`${todayDate}T${todayAttendance.timeIn}`);
    const diffInMinutes = Math.floor(
      (actualTimeIn - scheduledTimeIn) / (1000 * 60),
    );

    if (diffInMinutes < 0) {
      return `You timed in ${Math.abs(diffInMinutes)} minutes early today.`;
    } else if (diffInMinutes === 0) {
      return `You timed in exactly on time today.`;
    } else {
      return `You timed in ${diffInMinutes} minutes late today.`;
    }
  };

  const timingMessage = getTimingMessage();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showLeaveDropdown &&
        leaveDropdownRef.current &&
        !leaveDropdownRef.current.contains(event.target) &&
        leaveMenuButtonRef.current &&
        !leaveMenuButtonRef.current.contains(event.target)
      ) {
        setShowLeaveDropdown(false);
      }

      if (
        showDailyDropdown &&
        dailyDropdownRef.current &&
        !dailyDropdownRef.current.contains(event.target) &&
        dailyMenuButtonRef.current &&
        !dailyMenuButtonRef.current.contains(event.target)
      ) {
        setShowDailyDropdown(false);
      }
    };

    if (showLeaveDropdown || showDailyDropdown) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showLeaveDropdown, showDailyDropdown]);

  const getLeaveDuration = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays === 1 ? "1 day" : `${diffDays} days`;
  };

  if (loading || !userData) {
    return (
      <div
        className="main-content employee-dashboard-page dashboard-loading-state"
        role="status"
      >
        Loading...
      </div>
    );
  }

  return (
    <div className="main-content employee-dashboard-page">
      <div className="data-card greetings-card dashboard-greeting-card">
        <div className="message-container">
          <div className="greetings-message">
            <span>Good Day, </span>
            <span className="user-highlight">
              {userData?.employee?.firstName}
            </span>
            <span>!</span>
          </div>
          <p>{timingMessage}</p>
        </div>

        <div className="time-details">
          <TimeDate />
          <div className="time-in-out">
            <div className="time-in-container">
              <IconLogin2 strokeWidth={1.5} width={40} height={40} />
              <div className="time-in-details">
                <div className="time-timer">
                  {todayAttendance?.timeIn
                    ? formatTime(todayAttendance?.timeIn)
                    : "--:--"}
                </div>
                <p>Time IN</p>
              </div>
            </div>

            <div className="time-out-container">
              <IconLogout2 strokeWidth={1.5} width={40} height={40} />
              <div className="time-out-details">
                <div className="time-timer">
                  {todayAttendance?.timeOut
                    ? formatTime(todayAttendance?.timeOut)
                    : "--:--"}
                </div>
                <p>Time OUT</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="data-card-container dashboard-summary-grid">
        <div className="data-card dashboard-summary-card">
          <div className="message-container">
            <div className="data-title">Attendance This Month</div>
            <div className="data-value">
              {attendanceSummary.daysWorked} days
            </div>
          </div>
        </div>

        <div className="data-card dashboard-summary-card">
          <div className="message-container">
            <div className="data-title">Leaves Taken</div>
            <div className="data-value">{leaveSummary.total} days</div>
          </div>
        </div>

        <div className="data-card dashboard-summary-card">
          <div className="message-container">
            <div className="data-title">Attendance This Week</div>
            <div className="data-value">
              {weeklySummary.onTime + weeklySummary.late + weeklySummary.absent}{" "}
              days
            </div>
          </div>
        </div>
      </div>

      <div className="data-card dashboard-table-card">
        <div className="user-track-title">
          <p>Leave Requests</p>
          <div className="dots-button-container">
            <button
              type="button"
              className="dots-button dashboard-menu-button"
              aria-label="Leave request options"
              aria-expanded={showLeaveDropdown}
              onClick={toggleLeaveDropdown}
              ref={leaveMenuButtonRef}
            >
              <IconDotsVertical stroke={2} />
            </button>
            {showLeaveDropdown && (
              <div className="dropdown-details" ref={leaveDropdownRef}>
                <button
                  className="dropdown-item-details"
                  type="button"
                  onClick={() => navigate("/filing")}
                >
                  View Details
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="table dashboard-table dashboard-leave-table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Date Filed</p>
            </article>
            <article className="table-header-container">
              <p>Date Requested</p>
            </article>
            <article className="table-header-container">
              <p>Leave Duration</p>
            </article>
            <article className="table-header-container">
              <p>Leave Type</p>
            </article>
            <article className="table-header-container">
              <p>Status</p>
            </article>
          </div>
          {leaveRequestsData.length === 0 ? (
            <p className="no-data dashboard-empty-state">
              No pending requests available.
            </p>
          ) : (
            leaveRequestsData.slice(0, 3).map((leave) => (
              <div key={leave._id} className="table-content">
                <article className="table-content-container">
                  <p>{formatDate(leave.appliedAt)}</p>
                </article>
                <article className="table-content-container">
                  <p>{formatDate(leave.startDate, leave.endDate)}</p>
                </article>
                <article className="table-content-container">
                  <p>{getLeaveDuration(leave.startDate, leave.endDate)}</p>
                </article>
                <article className="table-content-container">
                  <p>{leave.leaveType}</p>
                </article>
                <article className="table-content-container">
                  <p>{leave.status}</p>
                </article>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="data-card dashboard-table-card">
        <div className="user-track-title">
          <p>Daily Attendance Log</p>
          <div className="dots-button-container">
            <button
              type="button"
              className="dots-button dashboard-menu-button"
              aria-label="Daily attendance options"
              aria-expanded={showDailyDropdown}
              onClick={toggleDailyDropdown}
              ref={dailyMenuButtonRef}
            >
              <IconDotsVertical stroke={2} />
            </button>
            {showDailyDropdown && (
              <div className="dropdown-details" ref={dailyDropdownRef}>
                <button
                  className="dropdown-item-details"
                  type="button"
                  onClick={() => navigate("/attendance")}
                >
                  View Details
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="table dashboard-table dashboard-attendance-table">
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
              <p>Behavior</p>
            </article>
          </div>
          {attendanceData.length === 0 ? (
            <p className="no-data dashboard-empty-state">
              No attendance data available.
            </p>
          ) : (
            attendanceData.slice(0, 3).map((att) => (
              <div key={att._id} className="table-content">
                <article className="table-content-container">
                  <p>{formatDate(att.date)}</p>
                </article>
                <article className="table-content-container">
                  <p>{formatTime(att.timeIn)}</p>
                </article>
                <article className="table-content-container">
                  <p>{formatTime(att.timeOut)}</p>
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

export default Dashboard;
