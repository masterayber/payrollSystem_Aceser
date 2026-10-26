import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import "../Modal.css";
import Dropdown from "../../Dropdown/Dropdown";
import PropTypes from "prop-types";
import ConfirmModal from "../Confirm/ConfirmModal";
import CancelModal from "../Cancel/CancelModal";
import ConfirmedMessageModal from "../Confirmed/ConfirmedMessageModal";
import { IconAlertTriangle, IconCancel, IconCheck } from "@tabler/icons-react";
import DeleteModal from "../Delete/DeleteModal";
import API from "../../../api";
import { manilaToday, toManilaDate } from "../../../utils/cutoff";

const EditEmployeeModal = ({ employee, onClose, onUpdateEmployee }) => {
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedModalOpen, setIsConfirmedModalOpen] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
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
      regularizationDate: employee.jobDescription.regularizationDate
        ? toManilaDate(employee.jobDescription.regularizationDate)
        : "",
      basicPay: employee.jobDescription.basicPay ?? "",
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
    API.get("/api/dropdownOption")
      .then((response) => setDropdownOptions(response.data))
      .catch((err) => console.error("Failed to fetch dropdowns", err));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (["startDate", "regularizationDate", "basicPay"].includes(name)) {
      setEditEmployee((prev) => ({
        ...prev,
        jobDescription: {
          ...prev.jobDescription,
          [name]: value,
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
    } else if (field === "employmentType") {
      // A regular employee needs a date of regularization; start with today
      setEditEmployee((prev) => ({
        ...prev,
        jobDescription: {
          ...prev.jobDescription,
          employmentType: value,
          regularizationDate:
            value === "Regular" && !prev.jobDescription.regularizationDate
              ? manilaToday()
              : prev.jobDescription.regularizationDate,
        },
      }));
    } else if (["designation", "position"].includes(field)) {
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

  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
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
      const response = await API.post("/api/employee/check-user-exists", {
        email: editEmployee.email,
        username: editEmployee.username,
        employeeId: editEmployee.employeeId,
        excludeId: editEmployee._id,
      });
      const data = response.data;
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

  const handleDeleteEmployee = async () => {
    setIsDeleteModalOpen(false);

    try {
      await API.delete(
        `/api/employee/delete-employee/${encodeURIComponent(employee.employeeId)}`,
      );

      // Refresh when the message is closed; the profile page leaves on refresh
      setIsDeleted(true);
      setTimeout(() => setIsConfirmedModalOpen(true), 300);
    } catch (error) {
      console.error("Error deleting employee", error);
    }
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
      regularizationDate: editEmployee.jobDescription.regularizationDate,
      basicPay: editEmployee.jobDescription.basicPay,
      timeIn: editEmployee.jobDescription.schedule.timeIn,
      timeOut: editEmployee.jobDescription.schedule.timeOut,
    };
    delete payload.jobDescription;

    try {
      await API.put(
        `/api/employee/edit-employee-via-admin/${employee._id}`,
        payload,
      );

      setIsConfirmModalOpen(false);
      setTimeout(() => setIsConfirmedModalOpen(true), 300);
    } catch (error) {
      console.error("Error updating employee:", error);
      setIsConfirmModalOpen(false);
      alert(error.response?.data?.message || "Could not update the employee.");
    }
  };

  return ReactDOM.createPortal(
    <div className="modal">
      <div className="modal-content employee-modal-content">
        <h3>Edit Employee</h3>
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
                  value={editEmployee.firstName}
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
                <label>Employee ID</label> <span className="required">*</span>
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
              <div className="label-container">
                <label>Gender</label> <span className="required">*</span>
              </div>
              <Dropdown
                options={[...dropdownOptions.gender]}
                value={editEmployee.gender}
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
                <label>Username</label> <span className="required">*</span>
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
                <label>Password</label> <span className="required">*</span>
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
                      className="btn reset-password"
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
                      className="btn reset-password"
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
                    className="btn reset-password"
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
                <label>Designation</label> <span className="required">*</span>
              </div>
              <Dropdown
                options={[...dropdownOptions.designations]}
                value={editEmployee.jobDescription.designation}
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
                value={editEmployee.jobDescription.department}
                onSelect={(value) => handleDropdownChange("department", value)}
              />
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Position</label> <span className="required">*</span>
              </div>
              <Dropdown
                options={
                  editEmployee.jobDescription.department
                    ? [
                        ...(dropdownOptions.positions[
                          editEmployee.jobDescription.department
                        ] || []),
                      ]
                    : ["--Select Position--"]
                }
                value={editEmployee.jobDescription.position}
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
                value={editEmployee.jobDescription.employmentType}
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
                  value={editEmployee.jobDescription.startDate}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Date of Regularization </label>
                {editEmployee.jobDescription.employmentType === "Regular" && (
                  <span className="required">*</span>
                )}
              </div>
              <div className="input-group-signup">
                <input
                  type="date"
                  name="regularizationDate"
                  value={editEmployee.jobDescription.regularizationDate}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Basic Pay (monthly, PHP)</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="number"
                  name="basicPay"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={editEmployee.jobDescription.basicPay}
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
                  placeholder="HH:HH"
                  value={editEmployee.jobDescription.schedule.timeIn}
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
              className="btn modal-button"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDeleteClick}
              className="btn modal-button"
            >
              Delete Employee
            </button>

            <button
              type="button"
              onClick={handleConfirmClick}
              className={`btn modal-button ${!hasChanges ? "disabled" : ""}`}
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

      {isDeleteModalOpen && (
        <DeleteModal
          title="Delete Employee"
          message={
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
                  {editEmployee.firstName} {editEmployee.lastName}
                </b>{" "}
                as an employee? This action cannot be undone.
              </p>
            </div>
          }
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDeleteEmployee}
          cancelText="No"
          confirmText="Yes, Delete"
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
          message={
            isDeleted
              ? "Employee deleted successfully"
              : "Employee details updated successfully"
          }
          onClose={() => {
            setIsConfirmedModalOpen(false);
            if (onUpdateEmployee) onUpdateEmployee();
            onClose();
          }}
        />
      )}
    </div>,
    document.body,
  );
};

export default EditEmployeeModal;

EditEmployeeModal.propTypes = {
  employee: PropTypes.shape().isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdateEmployee: PropTypes.func.isRequired,
};
