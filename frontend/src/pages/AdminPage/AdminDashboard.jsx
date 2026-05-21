import { useState, useEffect, useContext, useRef } from "react";
import { UserContext } from "../../context/UserContext";
import { EmployeeContext } from "../../context/EmployeeContext";
import "../../styles/AdminCSS/AdminDashboard.css";
import "../../components/TimeDate/TimeDate";
import TimeDate from "../../components/TimeDate/TimeDate";
import Calendar from "../../components/CalendarComponent/CalendarComponent";
import AttendanceChart from "../../components/AttendanceChart/AttendanceChart";
import { IconDotsVertical } from "@tabler/icons-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const AdminDashboard = () => {
  const { userData } = useContext(UserContext);
  const { employeeData } = useContext(EmployeeContext);
  const navigate = useNavigate();

  const [showDailyDropdown, setShowDailyDropdown] = useState(false);
  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
  const [showPendingDropdown, setShowPendingDropdown] = useState(false);
  const [timedInCount, setTimedInCount] = useState(0);
  const [timedOutCount, setTimedOutCount] = useState(0);
  const [onTimeCount, setOnTimeCount] = useState(0);
  const [lateCount, setLateCount] = useState(0);
  const [absentCount, setAbsentCount] = useState(0);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);

  const dailyDropdownRef = useRef(null);
  const dailySvgRef = useRef(null);
  const calendarDropdownRef = useRef(null);
  const calendarSvgRef = useRef(null);
  const pendingDropdownRef = useRef(null);
  const pendingSvgRef = useRef(null);

  const toggleDailyDropdown = (event) => {
    event.stopPropagation();
    setShowDailyDropdown((prev) => !prev);
  };

  const toggleCalendarDropdown = (event) => {
    event.stopPropagation();
    setShowCalendarDropdown((prev) => !prev);
  };

  const togglePendingDropdown = (event) => {
    event.stopPropagation();
    setShowPendingDropdown((prev) => !prev);
  };

  useEffect(() => {
    const fetchTodayAttendance = async () => {
      try {
        const today = new Date();
        const formattedToday = today.toISOString().split("T")[0].trim();

        const employees = employeeData;

        // Fetch today's attendance
        const attRes = await axios.get(
          `http://localhost:5000/api/attendance/attendance?date=${formattedToday}`,
        );
        const attendance = attRes.data;

        setTodayAttendance(attendance);

        if (attendance && attendance.length > 0) {
          const timedIn = attendance.filter((entry) => entry.timeIn).length;
          const timedOut = attendance.filter((entry) => entry.timeOut).length;

          setTimedInCount(timedIn);
          setTimedOutCount(timedOut);
        }

        let onTime = 0;
        let late = 0;

        const scheduledTimeIn = new Date(`${formattedToday}T08:00:00`);

        attendance.forEach((record) => {
          if (record.timeIn) {
            const [hours, minutes] = record.timeIn.split(":").map(Number);
            const timeIn = new Date(formattedToday);
            timeIn.setHours(hours, minutes, 0, 0);

            if (timeIn <= scheduledTimeIn) {
              onTime++;
            } else {
              late++;
            }
          }
        });

        const absent = employees.length - attendance.length;

        setOnTimeCount(onTime);
        setLateCount(late);
        setAbsentCount(absent);
      } catch (error) {
        console.error("Error fetching today's attendance:", error);
      }
    };

    if (employeeData.length > 0) {
      fetchTodayAttendance();
    }
  }, [employeeData]);

  useEffect(() => {
    const fetchPendingUsers = async () => {
      try {
        const response = await axios.get(
          "http://localhost:5000/api/auth/pending-users",
        );
        setPendingUsers(response.data);
      } catch (error) {
        console.error("Error fetching pending users:", error);
      }
    };

    fetchPendingUsers();

    const handleClickOutside = (event) => {
      if (
        showDailyDropdown &&
        dailyDropdownRef.current &&
        !dailyDropdownRef.current.contains(event.target) &&
        dailySvgRef.current &&
        !dailySvgRef.current.contains(event.target)
      ) {
        setShowDailyDropdown(false);
      }

      if (
        showCalendarDropdown &&
        calendarDropdownRef.current &&
        !calendarDropdownRef.current.contains(event.target) &&
        calendarSvgRef.current &&
        !calendarSvgRef.current.contains(event.target)
      ) {
        setShowCalendarDropdown(false);
      }

      if (
        showPendingDropdown &&
        pendingDropdownRef.current &&
        !pendingDropdownRef.current.contains(event.target) &&
        pendingSvgRef.current &&
        !pendingSvgRef.current.contains(event.target)
      ) {
        setShowPendingDropdown(false);
      }
    };

    if (showDailyDropdown || showCalendarDropdown || showPendingDropdown) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  });

  const todayAttendanceData = {
    onTime: onTimeCount,
    late: lateCount,
    absent: absentCount,
    leave: 0,
  };

  return (
    <div className="main-content">
      <div className="greetings-card">
        <div className="message-container">
          <div className="greetings-message">
            <span>Good Day, </span>
            <span className="user-highlight">
              {userData?.employee.firstName}
            </span>
            <span>!</span>
          </div>
          <p>{timedInCount} Employees have timed in today.</p>
        </div>

        <TimeDate />
      </div>

      <div className="user-track-container">
        <div className="metrics-card">
          <div className="metrics-title">
            <p>Total Employees</p>
          </div>
          <div className="metrics-value">{employeeData.length}</div>
        </div>
        <div className="metrics-card">
          <div className="metrics-title">
            <p>Total Employees Timed In</p>
          </div>
          <div className="metrics-value">{timedInCount}</div>
        </div>
        <div className="metrics-card">
          <div className="metrics-title">
            <p>Total Employees Timed Out</p>
          </div>
          <div className="metrics-value">{timedOutCount}</div>
        </div>
      </div>

      <div className="user-track-container">
        <div className="user-track">
          <div className="user-track-title">
            <p>Recent Transaction</p>
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
                    onClick={() => navigate("/admin-attendance")}
                  >
                    View Details
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="table">
            <div className="table-header">
              <article className="table-header-container">
                <p>Name</p>
              </article>
              <hr className="header-hr" />
              <article className="table-header-container">
                <p>Time</p>
              </article>
              <hr className="header-hr" />
              <article className="table-header-container">
                <p>Type</p>
              </article>
            </div>

            {todayAttendance.length > 0 ? (
              todayAttendance
                .flatMap((record) => {
                  const emp = employeeData.find(
                    (e) =>
                      e._id === record.userId ||
                      e.employeeId === record.employeeId,
                  );
                  const name = emp
                    ? `${emp.firstName} ${emp.lastName}`
                    : "Unknown Employee";
                  const logs = [];
                  if (record.timeIn)
                    logs.push({
                      name,
                      time: record.timeIn,
                      type: "IN",
                      timestamp: record.timeIn,
                    });
                  if (record.timeOut)
                    logs.push({
                      name,
                      time: record.timeOut,
                      type: "OUT",
                      timestamp: record.timeOut,
                    });
                  return logs;
                })
                // Sort by time descending (most recent first)
                .sort((a, b) => b.time.localeCompare(a.time))
                .map((log, idx) => (
                  <div className="table-content" key={idx}>
                    <article className="table-content-container">
                      <p>{log.name}</p>
                    </article>
                    <article className="table-content-container">
                      <p>{log.time}</p>
                    </article>
                    <article className="table-content-container">
                      <p>{log.type}</p>
                    </article>
                  </div>
                ))
            ) : (
              <p className="no-data">No attendance found this day.</p>
            )}
          </div>
        </div>
        <div className="user-track">
          <div className="user-track-title">
            <p>Today&apos;s Attendance</p>
          </div>
          <AttendanceChart attendanceData={todayAttendanceData} />
        </div>
      </div>

      <div className="user-track">
        <div className="user-track-title">
          <p>Calendar</p>
          <div className="dots-button-container">
            <IconDotsVertical
              stroke={2}
              onClick={toggleCalendarDropdown}
              ref={calendarSvgRef}
              className="dots-button"
            />
            {showCalendarDropdown && (
              <div className="dropdown-details" ref={calendarDropdownRef}>
                <button
                  className="dropdown-item-details"
                  onClick={() => navigate("/admin-calendar")}
                >
                  View Details
                </button>
              </div>
            )}
          </div>
        </div>
        <Calendar />
      </div>

      <div className="table-container">
        <div className="table-title">
          <p>Payroll Summary</p>
          <IconDotsVertical />
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

      <div className="table-container">
        <div className="table-title">
          <p>Pending Users</p>
          <div className="dots-button-container">
            <IconDotsVertical
              stroke={2}
              onClick={togglePendingDropdown}
              ref={pendingSvgRef}
              className="dots-button"
            />
            {showPendingDropdown && (
              <div className="dropdown-details" ref={pendingDropdownRef}>
                <button
                  className="dropdown-item-details"
                  onClick={() => navigate("/employees")}
                >
                  View Details
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>First Name</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Last Name</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Email</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Date Created</p>
            </article>
          </div>

          {pendingUsers.length > 0 ? (
            pendingUsers.map((user) => (
              <div className="table-content" key={user._id}>
                <article className="table-content-container">
                  <p>{user.firstName}</p>
                </article>
                <article className="table-content-container">
                  <p>{user.lastName}</p>
                </article>
                <article className="table-content-container">
                  <p>{user.email}</p>
                </article>
                <article className="table-content-container">
                  <p>
                    {user.createdAt
                      ? format(
                          new Date(user.createdAt),
                          "EEE, MMM dd, yyyy hh:mm a",
                        )
                      : "N/A"}
                  </p>
                </article>
              </div>
            ))
          ) : (
            <p className="no-data">No pending users found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
