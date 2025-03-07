import React, { useState, useContext } from "react";
import {
  IconSearch,
  IconEye,
  IconDownload,
  IconDotsVertical,
} from "@tabler/icons-react";
import { EmployeeContext } from "../../context/EmployeeContext";

const AdminPayslips = () => {
  const { employeeData } = useContext(EmployeeContext);

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
          <p>Next Pay Date</p>
          <div className="total-user-track">
            <span className="user-number">5</span>
            <span className="user-text">days</span>
          </div>
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

      <div className="table-container">
        <div className="table-title">
          <p>Pay History</p>
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
              <p>Gross Pay</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Deductions</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Net Pay</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Action</p>
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
                <p>{employee.grossPay}</p>
              </article>
              <article className="table-content-container">
                <p>{employee.deductions}</p>
              </article>
              <article className="table-content-container">
                <p>{employee.netPay}</p>
              </article>
              <article className="table-content-container">
                <button className="action-button">
                  <IconEye stroke={2} />
                </button>
                <button className="action-button">
                  <IconDownload stroke={2} />
                </button>
              </article>
            </div>
          ))}
        </div>

        {filteredEmployees.length === 0 && (
          <p className="no-results">No employees found.</p>
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

export default AdminPayslips;
