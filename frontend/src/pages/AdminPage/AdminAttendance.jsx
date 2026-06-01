import { useState, useRef, useContext, useEffect } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { IconSearch, IconCalendarClock, IconEdit } from "@tabler/icons-react";
import { EmployeeContext } from "../../context/EmployeeContext";
import { AttendanceContext } from "../../context/AttendanceContext";
import EditEmployeeAttendanceModal from "../../components/Modals/EditEmployee/EditEmployeeAttendanceModal";
import "../../styles/AdminCSS/AdminAttendance.css";
import Pagination from "../../components/Pagination/Pagination";

const AdminAttendance = () => {
  const { employeeData } = useContext(EmployeeContext);
  const { attendanceData, setAttendanceData } = useContext(AttendanceContext);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const datePickerRef = useRef(null);
  const itemsPerPage = 7;

  const toggleDatePicker = (e) => {
    e.stopPropagation();
    setIsDatePickerOpen(!isDatePickerOpen);
    datePickerRef.current.setOpen(!isDatePickerOpen);
  };

  const formatDate = (date) => date.toISOString().split("T")[0];

  const isToday = (date) => formatDate(date) === formatDate(new Date());
  const isFuture = (date) => formatDate(date) > formatDate(new Date());

  const calculateBehavior = (timeIn, timeOut, isBeforeHired) => {
    const selected = formatDate(selectedDate);
    const dayOfWeek = new Date(selected).getDay();
    const shiftStart = new Date(`${selected}T08:00:00`);
    const shiftEnd = new Date(`${selected}T17:00:00`);
    const lateThreshold = new Date(shiftStart.getTime() + 1 * 60 * 1000);
    const now = new Date();

    if (isBeforeHired) return "Not Hired Yet";
    if (dayOfWeek === 0 || dayOfWeek === 6) return "Weekend";

    if (!timeIn) {
      if (isFuture(selectedDate)) return "";
      if (isToday(selectedDate)) {
        return now >= shiftEnd ? "Absent" : "";
      }
      return "Absent";
    }

    const timeInDate = new Date(`${selected}T${timeIn}`);

    if (!timeOut) {
      const inDateStr = timeInDate.toISOString().split("T")[0];
      if (inDateStr === selected) return "On-time";
      return "No Time Out";
    }

    const timeOutDate = new Date(`${selected}T${timeOut}`);
    const halfDayMorningOut = new Date(`${selected}T13:00:00`);
    if (timeInDate <= shiftStart && timeOutDate <= halfDayMorningOut) {
      return "Half-Day";
    }

    const halfDayAfternoonInStart = new Date(`${selected}T10:00:00`);
    const halfDayAfternoonInEnd = new Date(`${selected}T13:00:00`);
    if (
      timeInDate >= halfDayAfternoonInStart &&
      timeInDate <= halfDayAfternoonInEnd
    ) {
      return "Half-Day";
    }

    if (timeInDate >= lateThreshold) return "Late";
    if (timeOutDate < shiftEnd) return "Early Out";

    return "On-Time";
  };

  useEffect(() => {
    const fetchAttendanceByDate = async () => {
      try {
        const formattedDate = selectedDate.toISOString().split("T")[0];
        const res = await axios.get(
          `http://localhost:5000/api/attendance/attendance?date=${formattedDate}`,
        );
        setAttendanceData(res.data);
      } catch (error) {
        console.error("Error fetching attendance data:", error);
      }
    };

    fetchAttendanceByDate();
  }, [selectedDate, setAttendanceData]);

  const getAttendanceForEmployee = (employeeId) => {
    const selected = formatDate(selectedDate);
    return (attendanceData || []).find((record) => {
      const recordDate = formatDate(new Date(record.date));
      return record.userId === employeeId && recordDate === selected;
    });
  };

  const filteredEmployees = (employeeData || [])
    .map((employee) => {
      const selected = formatDate(selectedDate);
      const createdDate = formatDate(new Date(employee.createdAt));
      const isBeforeHired = new Date(selected) < new Date(createdDate);

      const attendanceRecord = getAttendanceForEmployee(employee._id);
      const isWeekend = [0, 6].includes(new Date(selected).getDay());
      const isFutureDate = selected > formatDate(new Date());

      const timeIn = isBeforeHired
        ? "--:--"
        : isWeekend
          ? ""
          : attendanceRecord?.timeIn || "";
      const timeOut = isBeforeHired
        ? "--:--"
        : isWeekend
          ? ""
          : attendanceRecord?.timeIn
            ? attendanceRecord?.timeOut || (isFutureDate ? "" : "No Record")
            : "";

      return {
        id: employee.employeeId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        date: employee.date,
        timeIn,
        timeOut,
        isBeforeHired,
        attendanceRecord,
      };
    })
    .filter((employee) => {
      if (!employee) return false;
      return (
        employee.employeeId
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        employee.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentEmployees = filteredEmployees.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const handleEditClick = (employeeData) => {
    setSelectedEmployee(employeeData);
    setIsEditModalOpen(true);
  };

  const handleUpdateAttendance = async () => {
    setIsEditModalOpen(false);
  };
  return (
    <div className="main-content">
      <div className="data-card-container">
        <div className="data-card">
          <div className="data-title">On-Time</div>
          <div className="data-value">
            {
              filteredEmployees.filter(
                (emp) =>
                  calculateBehavior(
                    emp.timeIn,
                    emp.timeOut,
                    emp.isBeforeHired,
                  ) === "On-Time",
              ).length
            }
          </div>
        </div>

        <div className="data-card">
          <div className="data-title">Late</div>
          <div className="data-value">
            {
              filteredEmployees.filter(
                (emp) => calculateBehavior(emp.timeIn, emp.timeOut) === "Late",
              ).length
            }
          </div>
        </div>

        <div className="data-card">
          <div className="data-title">Half-Day</div>
          <div className="data-value">
            {
              filteredEmployees.filter(
                (emp) =>
                  calculateBehavior(emp.timeIn, emp.timeOut) === "Half-Day",
              ).length
            }
          </div>
        </div>

        <div className="data-card">
          <div className="data-title">Absent</div>
          <div className="data-value">
            {
              filteredEmployees.filter(
                (emp) =>
                  calculateBehavior(emp.timeIn, emp.timeOut) === "Absent",
              ).length
            }
          </div>
        </div>

        <div className="data-card">
          <div className="data-title">On-Leave</div>
          <div className="data-value">
            {
              filteredEmployees.filter(
                (emp) =>
                  calculateBehavior(emp.timeIn, emp.timeOut) === "On-Leave",
              ).length
            }
          </div>
        </div>
      </div>
      <div className="table-tooltip">
        <div className="search-container">
          <span className="icon-container">
            <IconSearch stroke={2} className="icon" />
          </span>

          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="date-picker-container">
          <DatePicker
            selected={selectedDate}
            onChange={(date) => {
              setSelectedDate(date);
              setIsDatePickerOpen(false);
            }}
            dateFormat="MM-dd-yyyy"
            className="date-picker"
            ref={datePickerRef}
            onClickOutside={() => setIsDatePickerOpen(false)}
          />
          <IconCalendarClock
            stroke={2}
            className="calendar-icon"
            onClick={toggleDatePicker}
          />
        </div>
      </div>

      <div className="data-card">
        <div className="user-track-title">
          <p>
            Daily Attendance (
            {selectedDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            )
          </p>
        </div>

        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Employee ID</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Employee Last Name</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Employee First Name</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Time IN</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Time OUT</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Behavior</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Action</p>
            </article>
          </div>
          {currentEmployees.map((employeeData, index) => (
            <div className="table-content" key={index}>
              <article className="table-content-container">
                <p>{employeeData.id}</p>
              </article>
              <article className="table-content-container">
                <p>{employeeData?.lastName}</p>
              </article>
              <article className="table-content-container">
                <p>{employeeData.firstName}</p>
              </article>
              <article className="table-content-container">
                <p>{employeeData.timeIn}</p>
              </article>
              <article className="table-content-container">
                <p>{employeeData.timeOut}</p>
              </article>
              <article className="table-content-container">
                <p>
                  {calculateBehavior(
                    employeeData.timeIn,
                    employeeData.timeOut,
                    employeeData.isBeforeHired,
                  )}
                </p>
              </article>
              <article className="table-content-container">
                <button
                  className="btn action-button"
                  onClick={() => handleEditClick(employeeData)}
                >
                  <IconEdit stroke={2} />
                </button>
              </article>
            </div>
          ))}
        </div>

        {filteredEmployees.length === 0 && (
          <p className="no-data">
            No employees found for {formatDate(selectedDate)}.
          </p>
        )}
      </div>

      <Pagination totalPages={totalPages} currentPage={currentPage} />

      {isEditModalOpen && selectedEmployee && (
        <EditEmployeeAttendanceModal
          employee={selectedEmployee}
          onClose={() => setIsEditModalOpen(false)}
          onUpdate={handleUpdateAttendance}
        />
      )}
    </div>
  );
};

export default AdminAttendance;
