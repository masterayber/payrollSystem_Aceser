import React, { useState } from "react";
import { IconPlus, IconEdit, IconSearch } from "@tabler/icons-react";
import "../../styles/AdminCSS/Employees.css";
import { useEmployee } from "../../context/EmployeeContext";

const Employees = () => {
  const { employeeData } = useEmployee();

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  const filteredEmployees = employeeData.filter((employee) =>
    Object.values(employee).some((value) =>
      value.toString().toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

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
          <p>Total Employees</p>
          <span className="user-number">177</span>
        </div>
        <div className="user-track">
          <p>Total Regural Employees</p>
          <span className="user-number">157</span>
        </div>
        <div className="user-track">
          <p>Total Probationary Employees</p>
          <span className="user-number">20</span>
        </div>
      </div>

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

      {filteredEmployees.length === 0 && (
        <p className="no-results">No employees found.</p>
      )}

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
