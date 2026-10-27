import { useState, useContext, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { IconPlus, IconSearch, IconProgressCheck } from "@tabler/icons-react";
import { EmployeeContext } from "../../context/EmployeeContext";
import AddEmployeeModal from "../../components/Modals/AddEmployee/AddEmployeeModal";
import ApproveEmployeeModal from "../../components/Modals/Approve/ApproveEmployeeModal";
import "../../styles/AdminCSS/Employees.css";
import Pagination from "../../components/Pagination/Pagination";
import API from "../../api";
import { activeFirst } from "../../utils/employees";
import { manilaToday } from "../../utils/cutoff";

const PROBATION_MONTHS = 6;

const isDueForRegularization = (job) => {
  if (job?.employmentType !== "Probationary" || !job.startDate) return false;
  const due = new Date(job.startDate);
  due.setUTCMonth(due.getUTCMonth() + PROBATION_MONTHS);
  return due.toISOString().slice(0, 10) <= manilaToday();
};

const Employees = () => {
  const { setEmployeeData } = useContext(EmployeeContext);
  // Active and resigned employees, also shared with the other admin pages
  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);

  const navigate = useNavigate();

  // Fresh list each time the page opens, so edits made on a profile show up
  const loadEmployees = useCallback(async () => {
    try {
      const { data } = await API.get("/api/employee/employees", {
        params: { includeResigned: true },
      });
      setEmployees(data);
      setEmployeeData(activeFirst(data));
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  }, [setEmployeeData]);

  // Fresh list each time the page opens, so edits made on a profile show up
  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const itemsPerPage = 7;

  // Active employees first, resigned ones at the bottom
  const activeEmployees = employees.filter(
    (employee) => employee.status !== "Resigned",
  );
  const resignedEmployees = employees.filter(
    (employee) => employee.status === "Resigned",
  );

  const probationaryCount = activeEmployees.filter(
    (employee) => employee.jobDescription.employmentType === "Probationary",
  ).length;
  const regularCount = activeEmployees.filter(
    (employee) => employee.jobDescription.employmentType === "Regular",
  ).length;

  const filteredEmployees = [...activeEmployees, ...resignedEmployees].filter(
    (employee) =>
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

  const handleAddClick = () => {
    setIsAddModalOpen(true);
  };

  const handleApproveClick = () => {
    setIsApproveModalOpen(true);
  };

  const handleUpdateEmployee = loadEmployees;

  return (
    <div className="main-content employees-page">
      <div className="data-card-container employee-summary-grid">
        <div className="data-card employee-stat-card">
          <div className="message-container">
            <div className="data-title">Total employees</div>
            <div className="data-value">{activeEmployees.length}</div>
          </div>
        </div>

        <div className="data-card employee-stat-card">
          <div className="message-container">
            <div className="data-title">Total Regular Employees</div>
            <div className="data-value">{regularCount}</div>
          </div>
        </div>

        <div className="data-card employee-stat-card">
          <div className="message-container">
            <div className="data-title">Total Probationary Employees</div>
            <div className="data-value">{probationaryCount}</div>
          </div>
        </div>
      </div>

      <div className="employee-toolbar">
        <div className="search-container employee-search-container">
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

        <div className="buttons-container employee-actions">
          <button
            type="button"
            className="btn employee-action-button"
            onClick={() => handleAddClick()}
          >
            <IconPlus stroke={2} />
            Add Employee
          </button>

          <button
            type="button"
            className="btn employee-action-button"
            onClick={() => handleApproveClick()}
          >
            <IconProgressCheck stroke={2} />
            Approve Employees
          </button>
        </div>
      </div>

      <div className="table employee-table">
        <div className="table-header">
          <article className="table-header-container">
            <p>Employee ID</p>
          </article>
          <article className="table-header-container">
            <p>Last Name</p>
          </article>
          <article className="table-header-container">
            <p>First Name</p>
          </article>
          <article className="table-header-container">
            <p>Designation</p>
          </article>
          <article className="table-header-container">
            <p>Department</p>
          </article>
          <article className="table-header-container">
            <p>Position</p>
          </article>
          <article className="table-header-container">
            <p>Employment Type</p>
          </article>
          <article className="table-header-container">
            <p>Start Date</p>
          </article>
          {/* {editMode && (
            <article className="table-header-container">
              <p>Action</p>
            </article>
          )} */}
        </div>

        {currentEmployees.map((employee) => (
          <div
            className={`table-content employee-row ${employee.status === "Resigned" ? "resigned" : ""}`}
            key={employee._id}
            role="link"
            tabIndex={0}
            aria-label={`View ${employee.firstName} ${employee.lastName}`}
            onClick={() => navigate(`/employees/${employee._id}`)}
            onKeyDown={(event) => {
              if (event.key === "Enter") navigate(`/employees/${employee._id}`);
            }}
          >
            <article className="table-content-container">
              <p>{employee.employeeId}</p>
            </article>
            <article className="table-content-container">
              <p>{employee.lastName}</p>
            </article>
            <article className="table-content-container">
              <p>{employee.firstName}</p>
            </article>
            <article className="table-content-container">
              <p>{employee.jobDescription?.designation || ""}</p>
            </article>
            <article className="table-content-container">
              <p>{employee.jobDescription?.department || ""}</p>
            </article>
            <article className="table-content-container">
              <p>{employee.jobDescription?.position || ""}</p>
            </article>
            <article className="table-content-container">
              <p className="employee-type-cell">
                {employee.status === "Resigned" ? (
                  <span className="employee-resigned-badge">Resigned</span>
                ) : (
                  <span className="employee-type-badge">
                    {employee.jobDescription?.employmentType || ""}
                  </span>
                )}
                {employee.status !== "Resigned" &&
                  isDueForRegularization(employee.jobDescription) && (
                    <span
                      className="employee-due-badge"
                      title="Due for regularization"
                    >
                      Due for regularization
                    </span>
                  )}
              </p>
            </article>
            <article className="table-content-container">
              <p>
                {employee.jobDescription?.startDate
                  ? new Date(
                      employee.jobDescription.startDate,
                    ).toLocaleDateString("en-CA")
                  : ""}
              </p>
            </article>
          </div>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <p className="no-data">No employees found.</p>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {isAddModalOpen && (
        <AddEmployeeModal
          onClose={() => setIsAddModalOpen(false)}
          onUpdateEmployee={handleUpdateEmployee}
        />
      )}

      {isApproveModalOpen && (
        <ApproveEmployeeModal
          onClose={() => setIsApproveModalOpen(false)}
          onUpdateEmployee={handleUpdateEmployee}
        />
      )}
    </div>
  );
};

export default Employees;
