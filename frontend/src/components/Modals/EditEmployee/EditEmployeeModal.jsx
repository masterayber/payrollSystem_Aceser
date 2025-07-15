import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import "../Modal.css";
import Dropdown from "../../Dropdown/Dropdown";
import PropTypes from "prop-types";
import ConfirmModal from "../Confirm/ConfirmModal";
import CancelModal from "../Cancel/CancelModal";
import ConfirmedMessageModal from "../Confirmed/ConfirmedMessageModal";
import { IconCancel, IconCheck } from "@tabler/icons-react";

const EditEmployeeModal = ({ employee, onClose, onUpdateEmployee }) => {
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedModalOpen, setIsConfirmedModalOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [editEmployee, setEditEmployee] = useState({
    ...employee,
    gender: employee.gender || "",
    jobDescription: {
      designation: employee.jobDescription.designation || "",
      department: employee.jobDescription.department || "",
      position: employee.jobDescription.position || "",
      employmentType: employee.jobDescription.employmentType || "",
      startDate: employee.jobDescription.startDate
        ? new Date(employee.jobDescription.startDate)
            .toISOString()
            .split("T")[0]
        : "",
      schedule: {
        timeIn: employee.jobDescription.schedule.timeIn || "",
        timeOut: employee.jobDescription.schedule.timeOut || "",
      },
    },
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
    const { name, value } = e.target;
    if (name === "startDate") {
      setEditEmployee((prev) => ({
        ...prev,
        jobDescription: {
          ...prev.jobDescription,
          startDate: value,
        },
      }));
    } else if (name === "timeIn" || name === "timeOut") {
      setEditEmployee((prev) => ({
        ...prev,
        jobDescription: {
          ...prev.jobDescription,
          schedule: {
            ...prev.jobDescription.schedule,
            [name]: value,
          },
        },
      }));
    } else {
      setEditEmployee((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
    setHasChanges(true);
  };

  const handleDropdownChange = (field, value) => {
    if (field === "department") {
      setEditEmployee((prev) => ({
        ...prev,
        jobDescription: {
          ...prev.jobDescription,
          department: value,
          position: "",
        },
      }));
    } else if (["designation", "position", "employmentType"].includes(field)) {
      setEditEmployee((prev) => ({
        ...prev,
        jobDescription: {
          ...prev.jobDescription,
          [field]: value,
        },
      }));
    } else if (field === "gender") {
      setEditEmployee((prev) => ({
        ...prev,
        gender: value,
      }));
    } else {
      setEditEmployee((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
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
            excludeId: editEmployee._id,
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

    const payload = {
      ...editEmployee,
      designation: editEmployee.jobDescription.designation,
      department: editEmployee.jobDescription.department,
      position: editEmployee.jobDescription.position,
      employmentType: editEmployee.jobDescription.employmentType,
      startDate: editEmployee.jobDescription.startDate,
      timeIn: editEmployee.jobDescription.schedule.timeIn,
      timeOut: editEmployee.jobDescription.schedule.timeOut,
    };
    delete payload.jobDescription;

    try {
      const response = await fetch(
        `http://localhost:5000/api/employee/edit-employee-via-admin/${employee._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update employee data");
      }

      setIsConfirmModalOpen(false);
      setTimeout(() => setIsConfirmedModalOpen(true), 300);
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
                  disabled
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">Gender</div>
              <Dropdown
                options={["--Select Gender--", ...dropdownOptions.gender]}
                value={editEmployee.gender}
                placeholder="--Select Gender--"
                onSelect={(value) => handleDropdownChange("gender", value)}
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
              <div className="password-container">
                <div className="input-group-signup">
                  <input
                    type="password"
                    name="password"
                    value={editEmployee.password}
                    onChange={handleChange}
                    disabled={!isPasswordResetOpen}
                    placeholder={
                      isPasswordResetOpen ? "Enter new password" : ""
                    }
                  />
                </div>
                {isPasswordResetOpen ? (
                  <>
                    <button
                      type="button"
                      className="reset-password"
                      style={{ padding: "10px" }}
                      onClick={() => {
                        setIsPasswordResetOpen(false);
                        setEditEmployee({ ...editEmployee, password: "" });
                      }}
                    >
                      <IconCancel stroke={2} size={20} />
                    </button>
                    <button
                      type="button"
                      className="reset-password"
                      style={{ padding: "10px" }}
                      onClick={() => {
                        setIsPasswordResetOpen(false);
                      }}
                    >
                      <IconCheck stroke={2} size={20} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="reset-password"
                    onClick={() => setIsPasswordResetOpen(true)}
                  >
                    Reset Password
                  </button>
                )}
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
                value={editEmployee.jobDescription.designation}
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
                value={editEmployee.jobDescription.department}
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
                  editEmployee.jobDescription.department
                    ? [
                        "--Select Position--",
                        ...(dropdownOptions.positions[
                          editEmployee.jobDescription.department
                        ] || []),
                      ]
                    : ["--Select Position--"]
                }
                value={editEmployee.jobDescription.position}
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
                value={editEmployee.jobDescription.employmentType}
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
                  value={editEmployee.jobDescription.startDate}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Scheduled Time In</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="timeIn"
                  placeholder="HH:HH"
                  value={editEmployee.jobDescription.schedule.timeIn}
                  onChange={handleChange}
                  maxLength={5}
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Scheduled Time Out</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="timeOut"
                  placeholder="HH:MM"
                  value={editEmployee.jobDescription.schedule.timeOut}
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
              className="modal-button"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClick}
              className={`modal-button ${!hasChanges ? "disabled" : ""}`}
              disabled={!hasChanges}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {isCancelModalOpen && (
        <CancelModal
          title="Cancel Changes"
          message="Are you sure you want to cancel editing this employee?"
          onClose={() => setIsCancelModalOpen(false)}
          onConfirm={handleCancel}
          cancelText="No"
          confirmText="Yes, Cancel"
        />
      )}

      {isConfirmModalOpen && (
        <ConfirmModal
          title="Confirm Changes"
          message={`Are you sure you want to edit ${editEmployee.firstName} ${editEmployee.lastName}?`}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={handleSubmit}
          cancelText="No"
          confirmText="Yes, Edit"
        />
      )}

      {isConfirmedModalOpen && (
        <ConfirmedMessageModal
          message="Employee details updated successfully"
          onClose={() => {
            setIsConfirmedModalOpen(false);
            if (onUpdateEmployee) onUpdateEmployee();
            onClose();
          }}
        />
      )}
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
