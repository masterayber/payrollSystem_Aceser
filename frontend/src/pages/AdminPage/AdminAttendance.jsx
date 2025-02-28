import React, { useState, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  IconSearch,
  IconDotsVertical,
  IconCalendarClock,
} from "@tabler/icons-react";
import { useEmployee } from "../../context/EmployeeContext";
import "../../styles/AdminCSS/AdminAttendance.css";

const AdminAttendance = () => {
  const { employeeData } = useEmployee();

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef(null);
  const itemsPerPage = 7;

  const toggleDatePicker = (e) => {
    e.stopPropagation();
    setIsDatePickerOpen(!isDatePickerOpen);
    datePickerRef.current.setOpen(!isDatePickerOpen);
  };

  const formatDate = (date) => date.toISOString().split("T")[0];

  const calculateBehavior = (timeIn, timeOut) => {
    if (!timeIn && !timeOut) return "Absent";
    if (!timeIn) return "No Time In";
    if (!timeOut) return "No Time Out";

    const today = formatDate(selectedDate);

    const shiftStart = new Date(`${today}T08:00:00`);
    const shiftEnd = new Date(`${today}T17:00:00`);

    const halfDayMorningOut = new Date(`${today}T13:00:00`);
    const halfDayAfternoonInStart = new Date(`${today}T10:00:00`);
    const halfDayAfternoonInEnd = new Date(`${today}T13:00:00`);

    const employeeTimeIn = new Date(`${today}T${timeIn}`);
    const employeeTimeOut = new Date(`${today}T${timeOut}`);

    const lateThreshold = new Date(shiftStart.getTime() + 1 * 60 * 1000);

    if (employeeTimeIn <= shiftStart && employeeTimeOut <= halfDayMorningOut) {
      return "Half-Day";
    }

    if (
      employeeTimeIn >= halfDayAfternoonInStart &&
      employeeTimeIn <= halfDayAfternoonInEnd
    ) {
      return "Half-Day";
    }

    if (employeeTimeIn >= lateThreshold) return "Late";
    if (employeeTimeOut < shiftEnd) return "Early Out";
    return "On-Time";
  };

  const filteredEmployees = employeeData
    .map((employee) => {
      const attendanceRecord = employee.attendance.find(
        (record) => record.date === formatDate(selectedDate)
      );
      return attendanceRecord
        ? {
            ...employee,
            timeIn: attendanceRecord.timeIn,
            timeOut: attendanceRecord.timeOut,
          }
        : { ...employee, timeIn: "", timeOut: "" };
    })
    .filter((employee) => {
      return (
        employee.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.lastName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentEmployees = filteredEmployees.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  return (
    <div className="main-content">
      <div className="user-track-container">
        <div className="user-track">
          <p>On-time Today</p>
          <span className="user-number">
            {
              filteredEmployees.filter(
                (emp) =>
                  calculateBehavior(emp.timeIn, emp.timeOut) === "On-Time"
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
            dateFormat="dd-MM-yyyy"
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
          </div>
          {currentEmployees.map((employee, index) => (
            <div className="table-content" key={index}>
              <article className="table-content-container">
                <p>{employee.id}</p>
              </article>
              <article className="table-content-container">
                <p>{employee.lastName}</p>
              </article>
              <article className="table-content-container">
                <p>{employee.firstName}</p>
              </article>
              <article className="table-content-container">
                <p>{employee.timeIn || "No Record"}</p>
              </article>
              <article className="table-content-container">
                <p>{employee.timeOut || "No Record"}</p>
              </article>
              <article className="table-content-container">
                <p>{calculateBehavior(employee.timeIn, employee.timeOut)}</p>
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
    </div>
  );
};

export default AdminAttendance;
