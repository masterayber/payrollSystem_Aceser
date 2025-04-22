import { useState, useRef, useContext, useEffect } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  IconSearch,
  IconDotsVertical,
  IconCalendarClock,
  IconEdit,
} from "@tabler/icons-react";
import { EmployeeContext } from "../../context/EmployeeContext";
import { AttendanceContext } from "../../context/AttendanceContext";
import EditEmployeeAttendanceModal from "../../components/Modals/EditEmployee/EditEmployeeAttendanceModal";
import "../../styles/AdminCSS/AdminAttendance.css";

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

  const calculateBehavior = (timeIn, timeOut, isBeforeHired) => {
    const today = formatDate(selectedDate);
    const dayOfWeek = new Date(today).getDay();

    if (isBeforeHired) return "Not Hired Yet";
    if (dayOfWeek === 0) return "Weekend";

    if (dayOfWeek === 6) {
      if (!timeIn && !timeOut) return "Weekend";
    }

    if (!timeIn && !timeOut) return "Absent";
    if (!timeIn) return "No Time In";

    const timeInDate = new Date(`${today}T${timeIn}`);
    const shiftStart = new Date(`${today}T08:00:00`);
    const shiftEnd = new Date(`${today}T17:00:00`);
    const lateThreshold = new Date(shiftStart.getTime() + 1 * 60 * 1000);

    if (!timeOut) {
      const inDateStr = timeInDate.toISOString().split("T")[0];
      if (inDateStr === today) return "On-time";
      else return "No Time Out";
    }

    const timeOutDate = new Date(`${today}T${timeOut}`);

    const halfDayMorningOut = new Date(`${today}T13:00:00`);
    if (timeInDate <= shiftStart && timeOutDate <= halfDayMorningOut) {
      return "Half-Day";
    }

    const halfDayAfternoonInStart = new Date(`${today}T10:00:00`);
    const halfDayAfternoonInEnd = new Date(`${today}T13:00:00`);
    if (
      timeInDate >= halfDayAfternoonInStart &&
      timeInDate <= halfDayAfternoonInEnd
    ) {
      return "Half-Day";
    }

    if (timeInDate > lateThreshold) return "Late";
    if (timeOutDate < shiftEnd) return "Early Out";

    return "On-Time";
  };

  useEffect(() => {
    const fetchAttendanceByDate = async () => {
      try {
        const formattedDate = selectedDate.toISOString().split("T")[0];
        const res = await axios.get(
          `http://localhost:5000/api/attendance/attendance?date=${formattedDate}`
        );
        setAttendanceData(res.data);
      } catch (error) {
        console.error("Error fetching attendance data:", error);
      }
    };

    fetchAttendanceByDate();
  }, [selectedDate, setAttendanceData]);

  const filteredEmployees = (employeeData || [])
    .map((employee) => {
      const selected = formatDate(selectedDate);
      const createdDate = formatDate(new Date(employee.createdAt));
      const isBeforeHired = new Date(selected) < new Date(createdDate);

      const attendanceRecord = (attendanceData || []).find((record) => {
        const recordDate = formatDate(new Date(record.date));
        return record.userId === employee._id && recordDate === selected;
      });

      return {
        id: employee._id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        date: employee.date,
        timeIn: isBeforeHired ? "--:--:--" : attendanceRecord?.timeIn || "",
        timeOut: isBeforeHired ? "--:--:--" : attendanceRecord?.timeOut || "",
        isBeforeHired,
      };
    })
    .filter((employee) => {
      if (!employee) return false;
      return (
        employee.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentEmployees = filteredEmployees.slice(
    startIndex,
    startIndex + itemsPerPage
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
      <div className="user-track-container">
        <div className="user-track">
          <p>On-time Today</p>
          <span className="user-number">
            {
              filteredEmployees.filter(
                (emp) =>
                  calculateBehavior(
                    emp.timeIn,
                    emp.timeOut,
                    emp.isBeforeHired
                  ) === "On-Time"
              ).length
            }
          </span>
        </div>
        <div className="user-track">
          <p>Late Today</p>
          <span className="user-number">
            {
              filteredEmployees.filter(
                (emp) => calculateBehavior(emp.timeIn, emp.timeOut) === "Late"
              ).length
            }
          </span>
        </div>
        <div className="user-track">
          <p>Half-Day Today</p>
          <span className="user-number">
            {
              filteredEmployees.filter(
                (emp) =>
                  calculateBehavior(emp.timeIn, emp.timeOut) === "Half-Day"
              ).length
            }
          </span>
        </div>
        <div className="user-track">
          <p>Absent Today</p>
          <span className="user-number">
            {
              filteredEmployees.filter(
                (emp) => calculateBehavior(emp.timeIn, emp.timeOut) === "Absent"
              ).length
            }
          </span>
        </div>
        <div className="user-track">
          <p>On-Leave Today</p>
          <span className="user-number">0</span>
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

      <div className="table-container">
        <div className="table-title">
          <p>
            Daily Attendance Log (
            {selectedDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            )
          </p>
          <IconDotsVertical stroke={2} />
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
                <p>{employeeData.timeIn || "No Record"}</p>
              </article>
              <article className="table-content-container">
                <p>{employeeData.timeOut || "No Record"}</p>
              </article>
              <article className="table-content-container">
                <p>
                  {calculateBehavior(
                    employeeData.timeIn,
                    employeeData.timeOut,
                    employeeData.isBeforeHired
                  )}
                </p>
              </article>
              <article className="table-content-container">
                <button
                  className="action-button"
                  onClick={() => handleEditClick(employeeData)}
                >
                  <IconEdit stroke={2} />
                </button>
              </article>
            </div>
          ))}
        </div>

        {filteredEmployees.length === 0 && (
          <p className="no-results">
            No employees found for {formatDate(selectedDate)}.
          </p>
        )}
      </div>

      <div className="pagination">
        <button
          className="pagination-button"
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <span>
          {" "}
          Page {currentPage} of {totalPages}{" "}
        </span>
        <button
          className="pagination-button"
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>

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
