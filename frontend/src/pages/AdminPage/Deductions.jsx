import { useState, useContext } from "react";
import { IconSearch, IconDotsVertical } from "@tabler/icons-react";
import { EmployeeContext } from "../../context/EmployeeContext";
import { activeOnly } from "../../utils/employees";
import GovernmentDeductionsCard from "../../components/Deductions/GovernmentDeductionsCard";
import Pagination from "../../components/Pagination/Pagination";
import "../../styles/AdminCSS/Deductions.css";

const Deductions = () => {
  const { employeeData: allEmployees } = useContext(EmployeeContext);
  // Resigned employees are left out until final pay is part of the payroll design
  const employeeData = activeOnly(allEmployees);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  const filteredEmployees = employeeData.filter((employee) =>
    Object.values(employee).some((value) =>
      value.toString().toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  );

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentEmployees = filteredEmployees.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  return (
    <div className="main-content admin-deductions-page">
      <GovernmentDeductionsCard />

      <div className="deduction-toolbar">
        <div className="search-container deduction-search">
          <span className="icon-container">
            <IconSearch stroke={2} className="icon" />
          </span>

          <input
            type="text"
            aria-label="Search employees"
            placeholder="Search employees"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <div className="table-container employee-deduction-log">
        <div className="table-title">
          <p>Employee Deduction Log</p>
          <IconDotsVertical stroke={2} />
        </div>
        <div className="table employee-deduction-table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Employee ID</p>
            </article>
            <article className="table-header-container">
              <p>Employee Last Name</p>
            </article>
            <article className="table-header-container">
              <p>Employee First Name</p>
            </article>
            <article className="table-header-container">
              <p>Withholding Tax</p>
            </article>
            <article className="table-header-container">
              <p>Deductions</p>
            </article>
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

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};

export default Deductions;
