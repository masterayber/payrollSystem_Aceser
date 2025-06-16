import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import "../Modal.css";
import Dropdown from "../../Dropdown/Dropdown";
import PropTypes from "prop-types";
import ConfirmModal from "../../Dropdown/Dropdown";
import CancelModal from "../Cancel/CancelModal";
import ConfirmedMessageModal from "../Confirmed/ConfirmedMessageModal";

const EditEmployeeModal = ({ employee, onClose, onUpdateEmployee }) => {
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isConfirmMOdalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedModalOpen, setISConfirmedModalOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editEmployee, setEditEmployee] = useState({
    ...employee,
    gender: employee.gender || "",
  });

  const [dropdownOptions, setDropdownOptions] = useState({
    gender: [],
    designations: [],
    departments: [],
    positions: [],
    employmentTypes: [],
  });

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    fetch("http://localhost:5000/api/dropdownOption")
      .then((res) => res.json())
      .then((data) => setDropdownOptions(data))
      .catch((err) => console.error("Failed to fetch dropdowns", err));
  }, []);

  const handleChange = (e) => {
    setEditEmployee({
      ...editEmployee,
      [e.target.name]: e.target.value,
    });
    setHasChanges(true);
  };

  const handleDropdownChange = (field, value) => {
    setEditEmployee({
      ...editEmployee,
      [field]: value,
    });
    setHasChanges(true);
  };

  const handleCancelClick = (e) => {
    e.preventDefault();
    if (hasChanges) {
      setIsCancelModalOpen(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClick = async () => {
    if (
      !editEmployee.firstName.trim() ||
      !editEmployee.lastName.trim() ||
      !editEmployee.employeeId.trim()
    ) {
      alert("Inputs cannot be empty");
      return;
    }

    try {
      const res = await fetch(
        "http://localhost:5000/api/auth/check-user-exists",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: editEmployee.email,
            username: editEmployee.username,
            employeeId: editEmployee.employeeId,
          }),
        }
      );
      const data = await res.json();
      let errorMsg = "";
      if (data.email) errorMsg += "Email already exists. \n";
      if (data.username) errorMsg += "Username already exists. \n";
      if (data.employeeId) errorMsg += "Employee ID already exists. \n";
      if (errorMsg) {
        alert(errorMsg.trim());
        return;
      }
    } catch (err) {
      console.error("Failed to check user:", err);
      return;
    }
    setIsConfirmModalOpen(true);
  };

  const handleCancel = () => {
    setIsCancelModalOpen(false);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`api/auth/employees/${employee._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editEmployee),
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

  return ReactDOM.createPortal(
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
                  value={editEmployee.firstName}
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
                  value={editEmployee.lastName}
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
                  value={editEmployee.employeeId}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">Gender</div>
              <Dropdown
                options={["--Select Gender--", ...dropdownOptions.gender]}
                value={editEmployee.gender}
                placeholder="--Select Gender--"
                onSelect={(value) =>
                  setEditEmployee({ ...editEmployee, gender: value })
                }
              />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Email</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="email"
                  name="email"
                  value={editEmployee.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Username</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="username"
                  value={editEmployee.username}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Password</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="password"
                  value={editEmployee.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Designation</label>
              </div>
              <Dropdown
                options={[
                  "--Select Designation--",
                  ...dropdownOptions.designations,
                ]}
                placeholder="--Select Designation--"
                onSelect={(value) => handleDropdownChange("designation", value)}
              />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Department</label>
              </div>
              <Dropdown
                options={[
                  "--Select Department--",
                  ...dropdownOptions.departments,
                ]}
                placeholder="--Select Department--"
                onSelect={(value) => handleDropdownChange("department", value)}
              />
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Position</label>
              </div>
              <Dropdown
                options={
                  editEmployee.department
                    ? [
                        "--Select Position--",
                        ...(dropdownOptions.positions[
                          editEmployee.department
                        ] || []),
                      ]
                    : ["--Select Position--"]
                }
                placeholder="--Select Position--"
                onSelect={(value) => handleDropdownChange("position", value)}
              />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Employment Type</label>
              </div>
              <Dropdown
                options={[
                  "--Select EmploymentType--",
                  ...dropdownOptions.employmentTypes,
                ]}
                placeholder="--Select Employment Type--"
                onSelect={(value) =>
                  handleDropdownChange("employmentType", value)
                }
              />
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Start Date</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="date"
                  name="startDate"
                  value={editEmployee.startDate}
                  onChange={handleChange}
                />
              </div>
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
    </div>,
    document.body
  );
};

export default EditEmployeeModal;

EditEmployeeModal.propTypes = {
  employee: PropTypes.shape().isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdateEmployee: PropTypes.func.isRequired,
};
