import { useState, useContext } from "react";
import {
  IconPlus,
  IconEdit,
  IconSearch,
  IconCancel,
  IconProgressCheck,
} from "@tabler/icons-react";
import { EmployeeContext } from "../../context/EmployeeContext";
import AddEmployeeModal from "../../components/Modals/AddEmployee/AddEmployeeModal";
import EditEmployeeModal from "../../components/Modals/EditEmployee/EditEmployeeModal";
import ApproveEmployeeModal from "../../components/Modals/Approve/ApproveEmployeeModal";
import "../../styles/AdminCSS/Employees.css";
import Pagination from "../../components/Pagination/Pagination";

const Employees = () => {
  const { employeeData, setEmployeeData } = useContext(EmployeeContext);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);

  const itemsPerPage = 7;

  const probationaryCount = employeeData.filter(
    (employee) => employee.jobDescription.employmentType === "Probationary",
  ).length;
  const regularCount = employeeData.filter(
    (employee) => employee.jobDescription.employmentType === "Regular",
  ).length;

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

  const handleAddClick = () => {
    setIsAddModalOpen(true);
  };

  const handleEditClick = (employee) => {
    setSelectedEmployee(employee);
    setIsEditModalOpen(true);
  };

  const handleApproveClick = () => {
    setIsApproveModalOpen(true);
  };

  const handleUpdateEmployee = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/auth/employees");
      const data = await response.json();

      if (!response.ok) {
        throw new Error("Failed to delete employee");
      }

      setEmployeeData(data);
    } catch (error) {
      console.error("Error refreshing employees after update:", error);
    }
  };

  return (
    <div className="main-content">
      <div className="data-card-container">
        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Total employees</div>
            <div className="data-value">{employeeData.length}</div>
          </div>
        </div>

        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Total Regural Employees</div>
            <div className="data-value">{regularCount}</div>
          </div>
        </div>

        <dic className="data-card">
          <div className="message-container">
            <div className="data-title">Total Probationary Employees</div>
            <div className="data-value">{probationaryCount}</div>
          </div>
        </dic>
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

      <div className="buttons-container">
        <button type="button" className="btn" onClick={() => handleAddClick()}>
          <IconPlus stroke={2} />
          Add Employee
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => setEditMode(!editMode)}
        >
          {editMode ? <IconCancel stroke={2} /> : <IconEdit stroke={2} />}
          {editMode ? "Cancel" : "Edit Employee"}
        </button>

        <button
          type="button"
          className="btn"
          onClick={() => handleApproveClick()}
        >
          <IconProgressCheck stroke={2} />
          Approve Employees
        </button>
      </div>

      <div className="table">
        <div className="table-header">
          <article className="table-header-container">
            <p>Employee ID</p>
          </article>
          <hr className="header-hr"></hr>
          <article className="table-header-container">
            <p>Last Name</p>
          </article>
          <hr className="header-hr"></hr>
          <article className="table-header-container">
            <p>First Name</p>
          </article>
          <hr className="header-hr"></hr>
          <article className="table-header-container">
            <p>Designation</p>
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
            <p>Employment Type</p>
          </article>
          <hr className="header-hr"></hr>
          <article className="table-header-container">
            <p>Start Date</p>
          </article>
          {editMode && (
            <>
              <hr className="header-hr"></hr>
              <article className="table-header-container">
                <p>Action</p>
              </article>
            </>
          )}
        </div>

        {currentEmployees.map((employee, index) => (
          <div className="table-content" key={index}>
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
              <p>{employee.jobDescription?.employmentType || ""}</p>
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
            {editMode && (
              <article className="table-content-container">
                <button
                  className="btn action-button"
                  onClick={() => handleEditClick(employee)}
                >
                  <IconEdit stroke={2} />
                </button>
              </article>
            )}
          </div>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <p className="no-data">No employees found.</p>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} />

      {isAddModalOpen && (
        <AddEmployeeModal
          onClose={() => setIsAddModalOpen(false)}
          onUpdateEmployee={handleUpdateEmployee}
        />
      )}

      {isEditModalOpen && selectedEmployee && (
        <EditEmployeeModal
          employee={selectedEmployee}
          onClose={() => setIsEditModalOpen(false)}
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
