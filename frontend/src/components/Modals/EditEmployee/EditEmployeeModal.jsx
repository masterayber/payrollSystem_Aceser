import { useState } from "react";
import "../Modal.css";
import Dropdown from "../../Dropdown/Dropdown";
import PropTypes from "prop-types";

const EditEmployeeModal = ({ employee, onClose, onUpdateEmployee }) => {
  const [editedEmployee, setEditedEmployee] = useState({ ...employee });

  const handleChange = (e) => {
    setEditedEmployee({
      ...editedEmployee,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`api/auth/employees/${employee._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editedEmployee),
      });

      if (response.ok) {
        onUpdateEmployee();
      } else {
        console.error("Failed to update employee data. Please try again later");
      }
    } catch (error) {
      console.error("Error updating employee:", error);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Edit Employee</h3>
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
                  value={editedEmployee.firstName}
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
                  value={editedEmployee.lastName}
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
                  value={editedEmployee.id}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Designation</label>
              </div>
              <Dropdown />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Employment Type</label>
              </div>
              <Dropdown />
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Department</label>
              </div>
              <Dropdown />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Position</label>
              </div>
              <Dropdown />
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
            <button className="modal-button">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEmployeeModal;

EditEmployeeModal.propTypes = {
  employee: PropTypes.shape().isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdateEmployee: PropTypes.func.isRequired,
};
