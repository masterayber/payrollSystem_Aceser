import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import CancelModal from "../Cancel/CancelModal";
import ConfirmModal from "../Confirm/ConfirmModal";
import ConfirmedMessageModal from "../Confirmed/ConfirmedMessageModal";
import Dropdown from "../../Dropdown/Dropdown";
import "../Modal.css";

const ApplyLeaveModal = ({ onClose }) => {
  const leaveType = [
    "Vacation Leave",
    "Sick Leave",
    "Maternity Leave",
    "Paternity Leave",
    "Solo Parent Leave",
    "Study Leave",
    "10-Day VAWC Leave",
    "Special Leave Benefits for Women",
    "Adoption Leave",
    "Leave Without Pay (LWOP)",
  ];
  const [formData, setFormData] = useState({
    leaveType: "",
    leaveDetails: "",
    startDate: "",
    endDate: "",
  });
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedModalOpen, setIsConfirmedModalOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSingleDayLeave, setIsSingleDayLeave] = useState(false);

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setHasChanges(true);
  };

  const handleLeaveTypeChange = (selectedType) => {
    setFormData((prev) => ({
      ...prev,
      leaveType: selectedType,
    }));
    setHasChanges(true);
  };

  const handleStartDateChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      startDate: value,
      endDate: isSingleDayLeave ? value : prev.endDate,
    }));
    setHasChanges(true);
  };

  const handleEndDateChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      endDate: value,
    }));
    setHasChanges(true);
  };

  const handleSingleDayToggle = (e) => {
    const checked = e.target.checked;
    setIsSingleDayLeave(checked);
    if (checked && formData.startDate) {
      setFormData((prev) => ({
        ...prev,
        endDate: prev.startDate,
      }));
    }
  };

  const isFormValid = () => {
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);

    return (
      formData.leaveType &&
      formData.leaveDetails.trim() &&
      formData.startDate &&
      formData.endDate &&
      end >= start
    );
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("No authentication token found. Please log in.");
        return;
      }

      const res = await fetch("http://localhost:5000/api/filing/apply-leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Submission failed");
      }

      setIsConfirmModalOpen(false);

      setTimeout(() => setIsConfirmedModalOpen(true), 300);
    } catch (err) {
      console.error("Failed applying for leave:", err);
    }
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
    if (!isFormValid()) {
      alert("Inputs cannot be empty");
      return;
    }
    setIsConfirmModalOpen(true);
  };

  const handleCancel = () => {
    setIsCancelModalOpen(false);
    onClose();
  };

  return ReactDOM.createPortal(
    <div className="modal">
      <div className="modal-content">
        <h3>Apply for Leave</h3>
        <form onSubmit={handleSubmit} className="form-container">
          <Dropdown
            options={leaveType}
            value={formData.leaveType}
            onSelect={handleLeaveTypeChange}
            placeholder="Select Leave Type"
          />

          <div className="input-container">
            <div className="label-container">
              <label>Details of Leave</label>{" "}
              <span className="required">*</span>
            </div>
            <div className="input-group-signup">
              <input
                type="text"
                name="leaveDetails"
                value={formData.leaveDetails}
                onChange={handleInputChange}
                placeholder="Enter text here"
                required
              />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Single Day Leave</label>
              </div>
            </div>

            <div className="input-container">
              <input
                type="checkbox"
                className="modal-checkbox"
                checked={isSingleDayLeave}
                onChange={handleSingleDayToggle}
              />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Start Date</label> <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleStartDateChange}
                  placeholder=""
                  required
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>End Date</label> <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleEndDateChange}
                  placeholder=""
                  required
                  disabled={isSingleDayLeave}
                  style={{ opacity: isSingleDayLeave ? 0.5 : 1 }}
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
              disabled={!isFormValid()}
            >
              Apply
            </button>
          </div>
        </form>
      </div>

      {isCancelModalOpen && (
        <CancelModal
          title="Cancel Changes"
          message="Are you sure you want to cancel your leave application?"
          onClose={() => setIsCancelModalOpen(false)}
          onConfirm={handleCancel}
          cancelText="No"
          confirmText="Yes"
        />
      )}

      {isConfirmModalOpen && (
        <ConfirmModal
          title="Confirm Application"
          message={`Are you sure you want to confirm application for ${formData.leaveType}?`}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={handleSubmit}
          cancelText="No"
          confirmText="Yes"
        />
      )}

      {isConfirmedModalOpen && (
        <ConfirmedMessageModal
          message="Application submitted successfully!"
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

export default ApplyLeaveModal;

ApplyLeaveModal.propTypes = {
  onClose: PropTypes.func,
};
