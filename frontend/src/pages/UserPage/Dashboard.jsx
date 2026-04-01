import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconDotsVertical, IconLogin2, IconLogout2 } from "@tabler/icons-react";
import { UserContext } from "../../context/UserContext";
import { formatDate } from "../../utils/dateFormatter";
import { calculateMonthlySummary } from "../../../../backend/utils/attendance/summary";
import { calculateLeaveSummary } from "../../utils/leave/summary";
import { calculateWeeklySummary } from "../../../../backend/utils/attendance/weeklySummary";
import "../../styles/UserCSS/Dashboard.css";
import TimeDate from "../../components/TimeDate/TimeDate";
import API from "../../api";

const Dashboard = () => {
  const { userData } = useContext(UserContext);
  const [attendance, setAttendance] = useState(null);
  const navigate = useNavigate();

  const [showLeaveDropdown, setShowLeaveDropdown] = useState(false);
  const [userLeaveRequests, setUserLeaveRequests] = useState([]);
  const [userDailyAttendance, setUserDailyAttendance] = useState([]);
  const [showDailyDropdown, setShowDailyDropdown] = useState(false);
  const [timingMessage, setTimingMessage] = useState("");
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState({
    daysWorked: "",
    hoursWorked: "",
    overtimeHours: "",
  });
  const [leaveSummary, setLeaveSummary] = useState({
    total: 0,
    approved: 0,
    pending: 0,
  });
  const [weeklySummary, setWeeklySummary] = useState({
    onTime: 0,
    late: 0,
    absent: 0,
  });

  const leaveDropdownRef = useRef(null);
  const leaveSvgRef = useRef(null);

  const dailyDropdownRef = useRef(null);
  const dailySvgRef = useRef(null);

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

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/attendance/${userData?._id}/records`,
        );

        if (res.ok) {
          const data = await res.json();

          setAttendance(data);

          const summaryData = calculateMonthlySummary(data);
          setAttendanceSummary(summaryData);

          const weeklySummaryData = calculateWeeklySummary(data);
          setWeeklySummary(weeklySummaryData);

          const todayDate = new Date().toISOString().slice(0, 10);

          const todayRecord = data.find((record) => record.date === todayDate);

          setTodayAttendance(todayRecord);

          if (!todayRecord || !todayRecord.timeIn) {
            setTimingMessage(
              `You have no time in yet today! You forget, don't you?`,
            );
          } else {
            const scheduledTimeIn = new Date(`${todayDate}T08:00:00`);
            const actualTimeIn = new Date(`${todayDate}T${todayRecord.timeIn}`);

            const diffInMinutes = Math.floor(
              (actualTimeIn - scheduledTimeIn) / (1000 * 60),
            );

            if (diffInMinutes < 0) {
              setTimingMessage(
                `You timed in ${Math.abs(diffInMinutes)} minutes early today. Keep it up!`,
              );
            } else if (diffInMinutes === 0) {
              setTimingMessage(`You timed in exactly on time today.`);
            } else {
              setTimingMessage(
                `You timed in ${diffInMinutes} minutes late today`,
              );
            }
          }
        }
      } catch (error) {
        console.error("Error fetching attedance:", error);
      }
    };

    if (userData?.employee?._id) {
      fetchAttendance();
    }
  }, [userData]);

  const formatTime = (time) => {
    if (!time) return "--:--";
    const [hour, minute] = time.split(":");
    const h = parseInt(hour);
    const ampm = h >= 12 ? "PM" : "AM";
    const formattedHour = h % 12 || 12;
    return `${formattedHour}:${minute} ${ampm}`;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showLeaveDropdown &&
        leaveDropdownRef.current &&
        !leaveDropdownRef.current.contains(event.target) &&
        leaveSvgRef.current &&
        !leaveSvgRef.current.contains(event.target)
      ) {
        setShowLeaveDropdown(false);
      }

      if (
        showDailyDropdown &&
        dailyDropdownRef.current &&
        !dailyDropdownRef.current.contains(event.target) &&
        dailySvgRef.current &&
        !dailySvgRef.current.contains(event.target)
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

  const handleUserLeaveRequests = async () => {
    try {
      const response = await API.get("/api/filing/user-leave-requests");
      setUserLeaveRequests(response.data);

      const summary = calculateLeaveSummary(response.data);
      setLeaveSummary(summary);
    } catch (error) {
      console.error("Error fetching leave requests:", error);
    }
  };

  const handleUserDailyAttendance = async () => {
    try {
      const response = await API.get(`/api/attendance/${userData._id}`);
      setUserDailyAttendance(response.data.data);
    } catch (error) {
      console.error("Error fetching user attendance:", error);
    }
  };

  useEffect(() => {
    handleUserLeaveRequests();
  }, []);

  useEffect(() => {
    handleUserDailyAttendance();
  }, []);

  const getLeaveDuration = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays === 1 ? "1 day" : `${diffDays} days`;
  };

  return (
    <div className="main-content">
      <div className="user-greetings-container">
        <div className="message-container">
          <div className="user-message">
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

      <div className="user-track-container">
        <div className="user-track">
          <p>Attendance This Month</p>
          <div className="total-user-track">
            <span className="user-number">{attendanceSummary.daysWorked}</span>
            <span className="user-text">days</span>
          </div>
          <div className="data-user-track">
            <div className="user-data-container">
              <div className="user-data">
                <p>Total Hours</p>
              </div>
              <div className="user-data-number">
                {attendanceSummary.hoursWorked} hrs
              </div>
            </div>
            <div className="user-data-container">
              <div className="user-data">
                <p>Overtime</p>
              </div>
              <div className="user-data-number">
                {attendanceSummary.overtimeHours} hrs
              </div>
            </div>
          </div>
        </div>

        <div className="user-track">
          <p>Leaves Taken</p>
          <div className="total-user-track">
            <span className="user-number">{leaveSummary.total}</span>
            <span className="user-text">days</span>
          </div>
          <div className="data-user-track">
            <div className="user-data-container">
              <div className="user-data">
                <p>Approved</p>
              </div>
              <div className="user-data-number">{leaveSummary.approved}</div>
            </div>
            <div className="user-data-container">
              <div className="user-data">
                <p>Pending</p>
              </div>
              <div className="user-data-number">{leaveSummary.pending}</div>
            </div>
          </div>
        </div>

        <div className="user-track">
          <p>This Week</p>
          <div className="total-user-track">
            <span className="user-number">
              {weeklySummary.onTime + weeklySummary.late + weeklySummary.absent}
            </span>
            <span className="user-text">days tracked</span>
          </div>
          <div className="data-user-track">
            <div className="user-data-container">
              <div className="user-data">
                <p>On-Time</p>
              </div>
              <div className="user-data-number">{weeklySummary.onTime}</div>
            </div>
            <div className="user-data-container">
              <div className="user-data">
                <p>Late</p>
              </div>
              <div className="user-data-number">{weeklySummary.late}</div>
            </div>
            <div className="user-data-container">
              <div className="user-data">
                <p>Absent</p>
              </div>
              <div className="user-data-number">{weeklySummary.absent}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-title">
          <p>Leave Requests</p>
          <div className="dots-button-container">
            <IconDotsVertical
              stroke={2}
              onClick={toggleLeaveDropdown}
              ref={leaveSvgRef}
              className="dots-button"
            />
            {showLeaveDropdown && (
              <div className="dropdown-details" ref={leaveDropdownRef}>
                <button
                  className="dropdown-item-details"
                  onClick={() => navigate("/filing")}
                >
                  View details
                </button>
              </div>
            )}
          </div>
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
              <p>Leave Duration</p>
            </article>
            <article className="table-header-container">
              <p>Leave Type</p>
            </article>
            <article className="table-header-container">
              <p>Status</p>
            </article>
          </div>
          {userLeaveRequests.length === 0 ? (
            <div className="table-content">
              <article className="table-content-container">
                <h6 className="no-data">No pending requests available</h6>
              </article>
            </div>
          ) : (
            userLeaveRequests.slice(0, 3).map((leave) => (
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

      <div className="table-container">
        <div className="table-title">
          <p>Daily Attendance Log</p>
          <div className="dots-button-container">
            <IconDotsVertical
              stroke={2}
              onClick={toggleDailyDropdown}
              ref={dailySvgRef}
              className="dots-button"
            />
            {showDailyDropdown && (
              <div className="dropdown-details" ref={dailyDropdownRef}>
                <button
                  className="dropdown-item-details"
                  onClick={() => navigate("/attendance")}
                >
                  View details
                </button>
              </div>
            )}
          </div>
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
              <p>Behavior</p>
            </article>
          </div>
          {userDailyAttendance.length === 0 ? (
            <div className="table-content">
              <article className="table-content-container">
                <h6 className="no-data">No Attendance Available</h6>
              </article>
            </div>
          ) : (
            userDailyAttendance.slice(0, 3).map((att) => (
              <div key={att._id} className="table-content">
                <article className="table-content-container">
                  <p>{formatDate(att.date)}</p>
                </article>
                <article className="table-content-container">
                  <p>{att.timeIn}</p>
                </article>
                <article className="table-content-container">
                  <p>{att.timeOut}</p>
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
