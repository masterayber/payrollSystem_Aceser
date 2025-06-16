import { useState, useContext, useEffect } from "react";
import {
  IconPlus,
  IconEdit,
  IconSearch,
  IconCancel,
  IconProgressCheck,
  IconTrash,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { EmployeeContext } from "../../context/EmployeeContext";
import AddEmployeeModal from "../../components/Modals/AddEmployee/AddEmployeeModal";
import EditEmployeeModal from "../../components/Modals/EditEmployee/EditEmployeeModal";
import ApproveEmployeeModal from "../../components/Modals/Approve/ApproveEmployeeModal";
import io from "socket.io-client";
import "../../styles/AdminCSS/Employees.css";
import ConfirmModal from "../../components/Modals/Confirm/ConfirmModal";

const socket = io("http://localhost:5000");

const Employees = () => {
  const { employeeData, setEmployeeData } = useContext(EmployeeContext);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedModalOpen, setIsConfirmedModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);

  const itemsPerPage = 7;

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/auth/employees"
        );
        const data = await response.json();
        console.log("Employee Data:", data);
        setEmployeeData(data);
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
    };

    fetchEmployees();

    socket.on("userApproved", (updatedUser) => {
      console.log("User approved:", updatedUser);

      fetchEmployees();
    });

    return () => {
      socket.off("userApproved");
    };
  }, [setEmployeeData]);

  const probationaryCount = employeeData.filter(
    (employee) => employee.type === "Probationary"
  ).length;
  const regularCount = employeeData.filter(
    (employee) => employee.type === "Regular"
  ).length;

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

  const handleAddClick = () => {
    setIsAddModalOpen(true);
  };

  const handleEditClick = (employee) => {
    setSelectedEmployee(employee);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (employee) => {
    setSelectedEmployee(employee);
    setIsConfirmModalOpen(true);
  };

  const handleApproveClick = () => {
    setIsApproveModalOpen(true);
  };

  const handleUpdateEmployee = async () => {
    setIsEditModalOpen(false);

    try {
      const response = await fetch("http://localhost:5000/api/auth/employees");
      const data = await response.json();

      setEmployeeData(data);
    } catch (error) {
      console.error("Error refreshing employees after update:", error);
    }
  };

  const handleDeleteEmployee = async () => {
    setIsConfirmModalOpen(false);

    try {
      const response = await fetch(
        `http://localhost:5000/api/auth/delete-employee/${selectedEmployee.employeeId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) throw new Error("Failed to delete employee");

      await handleUpdateEmployee();

      setTimeout(() => setIsConfirmedModalOpen(true), 300);
    } catch (error) {
      console.error("Error deleting employee", error);
    }
  };

  return (
    <div className="main-content">
      <div className="user-track-container">
        <div className="user-track">
          <p>Total Employees</p>
          <span className="user-number">{employeeData.length}</span>
        </div>
        <div className="user-track">
          <p>Total Regural Employees</p>
          <span className="user-number">{regularCount}</span>
        </div>
        <div className="user-track">
          <p>Total Probationary Employees</p>
          <span className="user-number">{probationaryCount}</span>
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
        <button className="tooltip-button" onClick={() => handleAddClick()}>
          <IconPlus stroke={2} />
          Add Employee
        </button>
        <button
          className="tooltip-button"
          onClick={() => setEditMode(!editMode)}
        >
          {editMode ? <IconCancel stroke={2} /> : <IconEdit stroke={2} />}
          {editMode ? "Cancel" : "Edit Employee"}
        </button>
        <button className="tooltip-button" onClick={() => handleApproveClick()}>
          <IconProgressCheck stroke={2} />
          Approve Employee
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
                      employee.jobDescription.startDate
                    ).toLocaleDateString("en-CA")
                  : ""}
              </p>
            </article>
            {editMode && (
              <article className="table-content-container">
                <button
                  className="action-button"
                  onClick={() => handleEditClick(employee)}
                >
                  <IconEdit stroke={2} />
                </button>
                <button
                  className="action-button"
                  onClick={() => handleDeleteClick(employee)}
                >
                  <IconTrash stroke={2} />
                </button>
              </article>
            )}
          </div>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <p className="no-data">No employees found.</p>
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

      {isConfirmModalOpen && (
        <ConfirmModal
          title="Delete Employee"
          message={
            selectedEmployee ? (
              <div className="alert-icon">
                <IconAlertTriangle
                  strokeWidth={2}
                  width={75}
                  height={75}
                  color="Red"
                />
                <p>
                  Are you sure you want to delete
                  <b>
                    {" "}
                    {selectedEmployee.firstName} {selectedEmployee.lastName}
                  </b>{" "}
                  as an employee? This action cannot be undone.
                </p>
              </div>
            ) : (
              "Are you sure you want to delete? This action cannot be undone."
            )
          }
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={handleDeleteEmployee}
          confirmText="Yes, Delete"
        />
      )}

      {isConfirmedModalOpen}

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
