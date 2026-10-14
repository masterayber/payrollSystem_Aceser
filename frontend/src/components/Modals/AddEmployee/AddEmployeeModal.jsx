import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import "../Modal.css";
import Dropdown from "../../Dropdown/Dropdown";
import PropTypes from "prop-types";
import ConfirmModal from "../Confirm/ConfirmModal";
import CancelModal from "../Cancel/CancelModal";
import ConfirmedMessageModal from "../Confirmed/ConfirmedMessageModal";
import API from "../../../api";

const AddEmployeeModal = ({ onClose, onUpdateEmployee }) => {
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedModalOpen, setIsConfirmedModalOpen] = useState(false);
  const [addEmployee, setAddEmployee] = useState({
    firstName: "",
    lastName: "",
    employeeId: "",
    gender: "",
    email: "",
    username: "",
    password: "",
    designation: "",
    department: "",
    position: "",
    employmentType: "",
    startDate: "",
    timeIn: "",
    timeOut: "",
  });
  const [hasChanges, setHasChanges] = useState(false);

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
    API.get("/api/dropdownOption")
      .then((response) => setDropdownOptions(response.data))
      .catch((err) => console.error("Failed to fetch dropdowns", err));
  }, []);

  useEffect(() => {
    API.get("/api/employee/latest-employeeId")
      .then((response) => {
        setAddEmployee((prev) => ({
          ...prev,
          employeeId: response.data.newEmployeeId || "",
        }));
      })
      .catch((err) => console.error("Failed to fetch Employee ID", err));
  }, []);

  const handleChange = (e) => {
    setAddEmployee({
      ...addEmployee,
      [e.target.name]: e.target.value,
    });
    setHasChanges(true);
  };

  const handleDropdownChange = (field, value) => {
    setAddEmployee({
      ...addEmployee,
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
      !addEmployee.firstName.trim() ||
      !addEmployee.lastName.trim() ||
      !addEmployee.employeeId.trim()
    ) {
      alert("Inputs cannot be empty");
      return;
    }

    try {
      const response = await API.post("/api/employee/check-user-exists", {
        email: addEmployee.email,
        username: addEmployee.username,
        employeeId: addEmployee.employeeId,
      });
      const data = response.data;
      let errorMsg = "";
      if (data.email) errorMsg += "Email already exists.\n";
      if (data.username) errorMsg += "Username already exists.\n";
      if (data.employeeId) errorMsg += "Employee ID already exists.\n";
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
      await API.post("/api/employee/add-employee-via-admin", addEmployee);

      setIsConfirmModalOpen(false);

      if (onUpdateEmployee) await onUpdateEmployee();

      setTimeout(() => setIsConfirmedModalOpen(true), 300);
    } catch (error) {
      console.error("Failed adding employee:", error);
    }
  };

  return ReactDOM.createPortal(
    <div className="modal">
      <div className="modal-content employee-modal-content">
        <h3>Add Employee</h3>
        <form onSubmit={handleSubmit} className="form-container">
          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>First Name</label> <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="firstName"
                  placeholder="Enter First Name"
                  value={addEmployee.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Last Name</label> <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="lastName"
                  placeholder="Enter Last Name"
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
                <label>Employee ID</label> <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="employeeId"
                  value={addEmployee.employeeId}
                  disabled
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Gender</label> <span className="required">*</span>
              </div>
              <Dropdown
                options={[...dropdownOptions.gender]}
                placeholder="Select Gender"
                value={addEmployee.gender}
                onSelect={(value) => handleDropdownChange("gender", value)}
              />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Email</label> <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="email"
                  placeholder="Enter Email"
                  value={addEmployee.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Username</label> <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="username"
                  placeholder="Enter Username"
                  value={addEmployee.username}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Password</label> <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="password"
                  placeholder="Enter Password"
                  value={addEmployee.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Designation</label> <span className="required">*</span>
              </div>
              <Dropdown
                options={[...dropdownOptions.designations]}
                placeholder="Select Designation"
                value={addEmployee.designation}
                onSelect={(value) => handleDropdownChange("designation", value)}
              />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Department</label> <span className="required">*</span>
              </div>
              <Dropdown
                options={[...dropdownOptions.departments]}
                placeholder="Select Department"
                value={addEmployee.department}
                onSelect={(value) => handleDropdownChange("department", value)}
              />
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Position</label> <span className="required">*</span>
              </div>
              <Dropdown
                options={
                  addEmployee.department
                    ? [
                        "Select Position",
                        ...(dropdownOptions.positions[addEmployee.department] ||
                          []),
                      ]
                    : ["Select Position"]
                }
                placeholder="Select Position"
                value={addEmployee.position}
                onSelect={(value) => handleDropdownChange("position", value)}
              />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Employment Type</label>{" "}
                <span className="required">*</span>
              </div>
              <Dropdown
                options={[...dropdownOptions.employmentTypes]}
                placeholder="Select Employment Type"
                value={addEmployee.employmentType}
                onSelect={(value) =>
                  handleDropdownChange("employmentType", value)
                }
              />
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Start Date</label> <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="date"
                  name="startDate"
                  value={addEmployee.startDate}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Scheduled Time In</label>{" "}
                <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="timeIn"
                  placeholder="HH:MM"
                  value={addEmployee.timeIn}
                  onChange={handleChange}
                  maxLength={5}
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Scheduled Time Out</label>{" "}
                <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="timeOut"
                  placeholder="HH:MM"
                  value={addEmployee.timeOut}
                  onChange={handleChange}
                  maxLength={5}
                />
              </div>
            </div>
          </div>

          <div className="modal-buttons">
            <button
              type="button"
              onClick={handleCancelClick}
              className="btn modal-button"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClick}
              className={`btn modal-button ${!hasChanges ? "disabled" : ""}`}
              disabled={!hasChanges}
            >
              Add Employee
            </button>
          </div>
        </form>
      </div>

      {isCancelModalOpen && (
        <CancelModal
          title="Cancel Changes"
          message="Are you sure you want to cancel changes?"
          onClose={() => setIsCancelModalOpen(false)}
          onConfirm={handleCancel}
          cancelText="No"
          confirmText="Yes"
        />
      )}

      {isConfirmModalOpen && (
        <ConfirmModal
          title="Confirm Add"
          message={`Are you sure you want to add ${addEmployee.firstName} ${addEmployee.lastName} as an employee?`}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={handleSubmit}
          cancelText="No"
          confirmText="Yes"
        />
      )}

      {isConfirmedModalOpen && (
        <ConfirmedMessageModal
          message="Added Successfully!"
          onClose={() => {
            setIsConfirmedModalOpen(false);
            onClose();
          }}
        />
      )}
    </div>,
    document.body,
  );
};

export default AddEmployeeModal;

AddEmployeeModal.propTypes = {
  onClose: PropTypes.func,
  onUpdateEmployee: PropTypes.func,
};
