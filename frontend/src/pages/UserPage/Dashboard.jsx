import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconDotsVertical, IconLogin2, IconLogout2 } from "@tabler/icons-react";
import { UserContext } from "../../context/UserContext";
import "../../styles/UserCSS/Dashboard.css";
import TimeDate from "../../components/TimeDate/TimeDate";
import API from "../../api";

const Dashboard = () => {
  const { userData } = useContext(UserContext);
  const [attendance, setAttendance] = useState(null);
  const navigate = useNavigate();

  const [showLeaveDropdown, setShowLeaveDropdown] = useState(false);
  const [userLeaveRequests, setUserLeaveRequests] = useState([]);
  const [showDailyDropdown, setShowDailyDropdown] = useState(false);
  const [timingMessage, setTimingMessage] = useState("");
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [summary, setSummary] = useState({
    daysWorked: "",
    hoursWorked: "",
    overtimeHours: "",
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
          `http://localhost:5000/api/attendance/${userData?.employee?._id}/records`,
        );

        if (res.ok) {
          const data = await res.json();
          setAttendance(data);

          let totalDaysWorked = 0;
          let totalHoursWorked = 0;
          let totalOvertimeHours = 0;

          const todayDate = new Date().toISOString().slice(0, 10);

          const todayRecord = data.find((record) => record.date === todayDate);
          setTodayAttendance(todayRecord);

          let foundToday = false;

          data.forEach((record) => {
            if (record.timeIn && record.timeOut) {
              totalDaysWorked++;

              const timeIn = new Date(`${record.date}T${record.timeIn}`);
              const timeOut = new Date(`${record.date}T${record.timeOut}`);

              const breakStart = new Date(`${record.date}T12:00:00`);
              const breakEnd = new Date(`${record.date}T12:00:00`);

              let workedHours =
                (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60);

              if (timeIn < breakEnd && timeOut > breakStart) {
                workedHours -= 1;
              }

              totalHoursWorked += workedHours;

              if (record.date === todayDate) {
                foundToday = true;

                if (!record.timeIn) {
                  setTimingMessage(
                    `You have no time in yet today! You forget, don't you?`,
                  );
                } else {
                  const scheduledTimeIn = new Date(`${record.date}T08:00:00`);
                  const actualTimeIn = new Date(
                    `${record.date}T${record.timeIn}`,
                  );
                  const diffInMinutes = Math.floor(
                    (actualTimeIn - scheduledTimeIn) / (1000 * 60),
                  );

                  if (diffInMinutes < 0) {
                    setTimingMessage(
                      `You timed in ${Math.abs(
                        diffInMinutes,
                      )} minutes early today. Keep it up!`,
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
            }
          });

          if (!foundToday) {
            setTimingMessage(
              `You have no time in yet today! You forget, don't you?`,
            );
          }

          setSummary({
            daysWorked: totalDaysWorked,
            hoursWorked: totalHoursWorked.toFixed(2),
            overtimeHours: totalOvertimeHours.toFixed(2),
          });
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
    } catch (error) {
      console.error("Error fetching leave requests:", error);
    }
  };

  useEffect(() => {
    handleUserLeaveRequests();
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
                    ? formatTime(todayAttendance.timeIn)
                    : "--:--"}
                </div>
                <p>Time IN</p>
              </div>
            </div>

            <div className="time-out-container">
              <IconLogout2 strokeWidth={1.5} width={40} height={40} />
              <div className="time-out-details">
                <div className="time-timer">
                  {attendance?.timeOut
                    ? formatTime(attendance.timeOut)
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
          <p>Attendance Summary</p>
          <div className="total-user-track">
            <span className="user-number">17</span>
            <span className="user-text">days</span>
          </div>
          <div className="data-user-track">
            <div className="user-data-container">
              <div className="user-data">
                <p>Total Hours</p>
              </div>
              <div className="user-data-number">136 hrs</div>
            </div>
            <div className="user-data-container">
              <div className="user-data">
                <p>Overtime</p>
              </div>
              <div className="user-data-number">8 hrs</div>
            </div>
          </div>
        </div>

        <div className="user-track">
          <p>Leaves Taken</p>
          <div className="total-user-track">
            <span className="user-number">3</span>
            <span className="user-text">days</span>
          </div>
          <div className="data-user-track">
            <div className="user-data-container">
              <div className="user-data">
                <p>Sick Leave</p>
              </div>
              <div className="user-data-number">2</div>
            </div>
            <div className="user-data-container">
              <div className="user-data">
                <p>Vacation Leave</p>
              </div>
              <div className="user-data-number">1</div>
            </div>
          </div>
        </div>

        <div className="user-track">
          <p>Work Performance</p>
          <div className="total-user-track">
            <span className="user-number">95%</span>
            <span className="user-text">efficiency</span>
          </div>
          <div className="data-user-track">
            <div className="user-data-container">
              <div className="user-data">
                <p>Tasks Completed</p>
              </div>
              <div className="user-data-number">42</div>
            </div>
            <div className="user-data-container">
              <div className="user-data">
                <p>Pending Tasks</p>
              </div>
              <div className="user-data-number">5</div>
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
                  <p>{new Date(leave.appliedAt).toLocaleDateString()}</p>
                </article>
                <article className="table-content-container">
                  <p>
                    {new Date(leave.startDate).toLocaleDateString()} -{" "}
                    {new Date(leave.endDate).toLocaleDateString()}
                  </p>
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
          <div className="table-content">
            <article className="table-content-container">
              <p>02/03/25</p>
            </article>
            <article className="table-content-container">
              <p>7:38 AM</p>
            </article>
            <article className="table-content-container">
              <p>5:09 PM</p>
            </article>
            <article className="table-content-container">
              <p>On-Time</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>02/04/25</p>
            </article>
            <article className="table-content-container">
              <p>7:40 AM</p>
            </article>
            <article className="table-content-container">
              <p>5:16 PM</p>
            </article>
            <article className="table-content-container">
              <p>On-Time</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>02/05/25</p>
            </article>
            <article className="table-content-container">
              <p>8:05 AM</p>
            </article>
            <article className="table-content-container">
              <p>5:19 PM</p>
            </article>
            <article className="table-content-container">
              <p>Late</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>02/06/25</p>
            </article>
            <article className="table-content-container">
              <p>--:-- AM</p>
            </article>
            <article className="table-content-container">
              <p>--:-- PM</p>
            </article>
            <article className="table-content-container">
              <p>Absent</p>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
