import React, { useState, useContext } from "react";
import { IconSearch } from "@tabler/icons-react";
import { EmployeeContext } from "../../context/EmployeeContext";

const Deductions = () => {
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
      <div className="table-container">
        <div className="table-title">
          <p>Government-Mandated Deductions</p>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10.7998 18.3C10.7998 17.9022 10.9578 17.5206 11.2391 17.2393C11.5204 16.958 11.902 16.8 12.2998 16.8C12.6976 16.8 13.0792 16.958 13.3605 17.2393C13.6418 17.5206 13.7998 17.9022 13.7998 18.3C13.7998 18.6978 13.6418 19.0794 13.3605 19.3607C13.0792 19.642 12.6976 19.8 12.2998 19.8C11.902 19.8 11.5204 19.642 11.2391 19.3607C10.9578 19.0794 10.7998 18.6978 10.7998 18.3ZM10.7998 12.3C10.7998 11.9022 10.9578 11.5206 11.2391 11.2393C11.5204 10.958 11.902 10.8 12.2998 10.8C12.6976 10.8 13.0792 10.958 13.3605 11.2393C13.6418 11.5206 13.7998 11.9022 13.7998 12.3C13.7998 12.6978 13.6418 13.0794 13.3605 13.3607C13.0792 13.642 12.6976 13.8 12.2998 13.8C11.902 13.8 11.5204 13.642 11.2391 13.3607C10.9578 13.0794 10.7998 12.6978 10.7998 12.3ZM10.7998 6.3C10.7998 5.90218 10.9578 5.52065 11.2391 5.23934C11.5204 4.95804 11.902 4.8 12.2998 4.8C12.6976 4.8 13.0792 4.95804 13.3605 5.23934C13.6418 5.52065 13.7998 5.90218 13.7998 6.3C13.7998 6.69783 13.6418 7.07936 13.3605 7.36066C13.0792 7.64197 12.6976 7.8 12.2998 7.8C11.902 7.8 11.5204 7.64197 11.2391 7.36066C10.9578 7.07936 10.7998 6.69783 10.7998 6.3Z"
              fill="#0A0A0A"
            />
          </svg>
        </div>
        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Description</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Amount</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Manage</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>Philheath</p>
            </article>
            <article className="table-content-container">
              <p>000.00</p>
            </article>
            <article className="table-content-container">
              <button className="action-button">Edit</button>
              <button className="action-button">Delete</button>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>SSS</p>
            </article>
            <article className="table-content-container">
              <p>000.00</p>
            </article>
            <article className="table-content-container">
              <button className="action-button">Edit</button>
              <button className="action-button">Delete</button>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>Pag-ibig</p>
            </article>
            <article className="table-content-container">
              <p>000.00</p>
            </article>
            <article className="table-content-container">
              <button className="action-button">Edit</button>
              <button className="action-button">Delete</button>
            </article>
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
          <p>Employee Deduction Log</p>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10.7998 18.3C10.7998 17.9022 10.9578 17.5206 11.2391 17.2393C11.5204 16.958 11.902 16.8 12.2998 16.8C12.6976 16.8 13.0792 16.958 13.3605 17.2393C13.6418 17.5206 13.7998 17.9022 13.7998 18.3C13.7998 18.6978 13.6418 19.0794 13.3605 19.3607C13.0792 19.642 12.6976 19.8 12.2998 19.8C11.902 19.8 11.5204 19.642 11.2391 19.3607C10.9578 19.0794 10.7998 18.6978 10.7998 18.3ZM10.7998 12.3C10.7998 11.9022 10.9578 11.5206 11.2391 11.2393C11.5204 10.958 11.902 10.8 12.2998 10.8C12.6976 10.8 13.0792 10.958 13.3605 11.2393C13.6418 11.5206 13.7998 11.9022 13.7998 12.3C13.7998 12.6978 13.6418 13.0794 13.3605 13.3607C13.0792 13.642 12.6976 13.8 12.2998 13.8C11.902 13.8 11.5204 13.642 11.2391 13.3607C10.9578 13.0794 10.7998 12.6978 10.7998 12.3ZM10.7998 6.3C10.7998 5.90218 10.9578 5.52065 11.2391 5.23934C11.5204 4.95804 11.902 4.8 12.2998 4.8C12.6976 4.8 13.0792 4.95804 13.3605 5.23934C13.6418 5.52065 13.7998 5.90218 13.7998 6.3C13.7998 6.69783 13.6418 7.07936 13.3605 7.36066C13.0792 7.64197 12.6976 7.8 12.2998 7.8C11.902 7.8 11.5204 7.64197 11.2391 7.36066C10.9578 7.07936 10.7998 6.69783 10.7998 6.3Z"
              fill="#0A0A0A"
            />
          </svg>
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
              <p>Withholding Tax</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Deductions</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Loans</p>
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
                <p>{employee.withholdingTax}</p>
              </article>
              <article className="table-content-container">
                <p>{employee.deductions}</p>
              </article>
              <article className="table-content-container">
                <p>{employee.loans}</p>
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

export default Deductions;
