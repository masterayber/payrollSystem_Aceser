import { useState, useContext } from "react";
import {
  IconSearch,
  IconEye,
  IconDownload,
  IconDotsVertical,
} from "@tabler/icons-react";
import { EmployeeContext } from "../../context/EmployeeContext";
import Pagination from "../../components/Pagination/Pagination";
import "../../styles/AdminCSS/AdminPayslips.css";

const AdminPayslips = () => {
  const { employeeData } = useContext(EmployeeContext);

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
    <div className="main-content admin-payslips-page">
      <div className="data-card-container admin-payslips-summary">
        <div className="data-card finance-metric-card">
          <div className="message-container">
            <div className="data-title">Total Employees</div>
            <div className="data-value">{employeeData.length}</div>
          </div>
        </div>

        <div className="data-card finance-metric-card">
          <div className="message-container">
            <div className="data-title">Next Payroll Date</div>
            <div className="data-value">5 days</div>
          </div>
        </div>
      </div>

      <div className="search-container admin-payslips-search">
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

      <div className="table-container admin-pay-history-card">
        <div className="table-title">
          <p>Pay History</p>
          <IconDotsVertical stroke={2} />
        </div>
        <div className="table admin-pay-history-table">
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
              <p>Gross Pay</p>
            </article>
            <article className="table-header-container">
              <p>Deductions</p>
            </article>
            <article className="table-header-container">
              <p>Net Pay</p>
            </article>
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
                <button
                  type="button"
                  className="btn action-button"
                  aria-label={`View payslip for ${employee.firstName} ${employee.lastName}`}
                >
                  <IconEye stroke={2} />
                </button>
                <button
                  type="button"
                  className="btn action-button"
                  aria-label={`Download payslip for ${employee.firstName} ${employee.lastName}`}
                >
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

      <Pagination totalPages={totalPages} currentPage={currentPage} />
    </div>
  );
};

export default AdminPayslips;
