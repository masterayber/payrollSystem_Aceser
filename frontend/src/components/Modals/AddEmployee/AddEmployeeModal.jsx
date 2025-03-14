import React, { useState } from "react";
import "../Modal.css";
import Dropdown from "../../Dropdown/Dropdown";

const AddEmployeeModal = ({ onClose, onUpdateEmployee }) => {
  const [addEmployee, setAddEmployee] = useState({
    firstName: "",
    lastName: "",
    id: "",
    designation: "",
    employmentType: "",
    department: "",
    position: "",
    startDate: "",
  });

  const handleChange = (e) => {
    setAddEmployee({
      ...addEmployee,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("http://localhost:5000/api/auth/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newEmployee),
      });

      if (response.ok) {
        onAddEmployee();
        onClose();
      } else {
        console.error("Failed to add employee. Please try again later");
      }
    } catch (error) {
      console.error("Failed adding employee:", error);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Add Employee</h3>
        <form onSubmit={handleSubmit}>
          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>First Name</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="firstName"
                  value={addEmployee.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Last Name</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="lastName"
                  value={addEmployee.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Employee ID</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="employeeId"
                  value={addEmployee.id}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Designation</label>
              </div>
              <Dropdown category="designation" />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Employment Type</label>
              </div>
              <Dropdown category="employmentType" />
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Department</label>
              </div>
              <Dropdown category="department" />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Position</label>
              </div>
              <Dropdown category="position" />
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Start Date</label>
              </div>
              <Dropdown />
            </div>
          </div>

          <div className="modal-buttons">
            <button onClick={onClose} className="modal-button">
              Cancel
            </button>
            <button className="modal-button">Add Employee</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEmployeeModal;
