import React, { useState } from "react";
import { IconPlus, IconEdit } from "@tabler/icons-react";
import "../../styles/AdminCSS/Employees.css";

const Employees = () => {
  const employeeData = [
    {
      id: "AC-001",
      lastName: "DELA CRUZ",
      firstName: "JUAN",
      type: "Regular",
      department: "Admin",
      position: "Staff",
      startDate: "December 2, 2023",
    },
    {
      id: "AC-002",
      lastName: "SANTOS",
      firstName: "MARIA",
      type: "Probationary",
      department: "Accounting",
      position: "Accountant",
      startDate: "December 2, 2024",
    },
    {
      id: "AC-003",
      lastName: "REYES",
      firstName: "PEDRO",
      type: "Regular",
      department: "IT",
      position: "Developer",
      startDate: "March 4, 2024",
    },
    {
      id: "AC-003",
      lastName: "REYES",
      firstName: "PEDRO",
      type: "Regular",
      department: "IT",
      position: "Developer",
      startDate: "March 4, 2024",
    },
    {
      id: "AC-003",
      lastName: "REYES",
      firstName: "PEDRO",
      type: "Regular",
      department: "IT",
      position: "Developer",
      startDate: "March 4, 2024",
    },
    {
      id: "AC-003",
      lastName: "REYES",
      firstName: "PEDRO",
      type: "Regular",
      department: "IT",
      position: "Developer",
      startDate: "March 4, 2024",
    },
    {
      id: "AC-003",
      lastName: "REYES",
      firstName: "PEDRO",
      type: "Regular",
      department: "IT",
      position: "Developer",
      startDate: "March 4, 2024",
    },
    {
      id: "AC-003",
      lastName: "REYES",
      firstName: "PEDRO",
      type: "Regular",
      department: "IT",
      position: "Developer",
      startDate: "March 4, 2024",
    },
    {
      id: "AC-003",
      lastName: "REYES",
      firstName: "PEDRO",
      type: "Regular",
      department: "IT",
      position: "Developer",
      startDate: "March 4, 2024",
    },
    {
      id: "AC-003",
      lastName: "REYES",
      firstName: "PEDRO",
      type: "Regular",
      department: "IT",
      position: "Developer",
      startDate: "March 4, 2024",
    },
  ];

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  const totalPages = Math.ceil(employeeData.length / itemsPerPage);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentEmployees = employeeData.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  return (
    <div className="main-content">
      <div className="user-track-container">
        <div className="user-track">
          <p>Total Employees</p>
          <div className="user-number">177</div>
        </div>
        <div className="user-track">
          <p>Total Regural Employees</p>
          <div className="user-number">157</div>
        </div>
        <div className="user-track">
          <p>Total Probationary Employees</p>
          <div className="user-number">20</div>
        </div>
      </div>

      <div className="search-container"></div>
      <div className="tooltip-container">
        <button className="tooltip-button">
          <IconPlus stroke={2} />
          Add Employee
        </button>
        <button className="tooltip-button">
          <IconEdit stroke={2} />
          Edit Employee
        </button>
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
            <p>Employment Type</p>
          </article>
          <hr className="header-hr"></hr>
          <article className="table-header-container">
            <p>Department</p>
          </article>
          <hr className="header-hr"></hr>
          <article className="table-header-container">
            <p>Position</p>
          </article>
          <hr className="header-hr"></hr>
          <article className="table-header-container">
            <p>Start Date</p>
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
              <p>{employee.type}</p>
            </article>
            <article className="table-content-container">
              <p>{employee.department}</p>
            </article>
            <article className="table-content-container">
              <p>{employee.position}</p>
            </article>
            <article className="table-content-container">
              <p>{employee.startDate}</p>
            </article>
          </div>
        ))}
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

export default Employees;
