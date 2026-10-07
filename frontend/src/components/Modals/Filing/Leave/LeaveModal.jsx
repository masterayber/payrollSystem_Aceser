import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import CancelModal from "../../Cancel/CancelModal";
import ConfirmModal from "../../Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Confirmed/ConfirmedMessageModal";
import "../../Modal.css";
import Dropdown from "../../../Dropdown/Dropdown";

const LeaveModal = ({ mode, request, onClose, onUpdateLeaveRequests }) => {
  const leaveTypeOptions = [
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

  const isEdit = mode === "edit";
  const initialFormData =
    isEdit && request
      ? {
          leaveType: request.leaveType || "",
          leaveDetails: request.leaveDetails || "",
          startDate: request.startDate
            ? new Date(request.startDate).toISOString().slice(0, 10)
            : "",
          endDate: request.endDate
            ? new Date(request.endDate).toISOString().slice(0, 10)
            : "",
        }
      : {
          leaveType: "",
          leaveDetails: "",
          startDate: "",
          endDate: "",
        };

  const [formData, setFormData] = useState(initialFormData);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedModalOpen, setIsConfirmedModalOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSingleDayLeave, setIsSingleDayLeave] = useState(
    isEdit ? formData.startDate === formData.endDate : false,
  );

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setHasChanges(true);
  };

  const handleLeaveTypeChange = (selectedType) => {
    setFormData((prev) => ({ ...prev, leaveType: selectedType }));
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
    setFormData((prev) => ({ ...prev, endDate: value }));
    setHasChanges(true);
  };

  const handleSingleDayToggle = (e) => {
    const checked = e.target.checked;
    setIsSingleDayLeave(checked);
    if (checked && formData.startDate) {
      setFormData((prev) => ({ ...prev, endDate: prev.startDate }));
    }
    setHasChanges(true);
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

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("No authentication token found. Pleave log in again.");
        return;
      }

      const url = isEdit
        ? `http://localhost:5000/api/filing/edit-leave/${request._id}`
        : "http://localhost:5000/api/filing/apply-leave";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || `${isEdit ? "Update" : "Submission"} failed`,
        );
      }

      setIsConfirmModalOpen(false);
      if (onUpdateLeaveRequests) onUpdateLeaveRequests();
      setTimeout(() => setIsConfirmedModalOpen(true), 300);
    } catch (err) {
      console.error(
        `Failed ${isEdit ? "updating" : "applying for"} leave:`,
        err,
      );
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

  const handleConfirmClick = () => {
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

  const closeConfirmed = () => {
    setIsConfirmedModalOpen(false);
    onClose();
  };

  return ReactDOM.createPortal(
    <div className="modal filing-modal filing-leave-modal">
      <div className="modal-content filing-modal-content">
        <h3 className="filing-modal-title">
          {isEdit ? "Edit Leave Request" : "Apply for Leave"}
        </h3>
        <form
          onSubmit={handleSubmit}
          className="form-container filing-modal-form"
        >
          <div className="input-container">
            <div className="label-container">
              <span className="field-label">Leave Type</span>{" "}
              <span className="required">*</span>
            </div>
            <Dropdown
              options={leaveTypeOptions}
              value={formData.leaveType}
              onSelect={handleLeaveTypeChange}
              placeholder="Select Leave Type"
            />
          </div>

          <div className="input-container">
            <div className="label-container">
              <label htmlFor="filing-leave-details">Details of Leave</label>{" "}
              <span className="required">*</span>
            </div>
            <div className="input-group-signup">
              <input
                type="text"
                id="filing-leave-details"
                name="leaveDetails"
                value={formData.leaveDetails}
                onChange={handleInputChange}
                placeholder="Enter text here"
              />
            </div>
          </div>

          <div className="input-row filing-single-day-row">
            <label htmlFor="filing-single-day">Single Day Leave</label>
            <input
              type="checkbox"
              id="filing-single-day"
              className="modal-checkbox"
              checked={isSingleDayLeave}
              onChange={handleSingleDayToggle}
            />
          </div>

          <div className="input-row filing-date-row">
            <div className="input-container">
              <div className="label-container">
                <label htmlFor="filing-leave-start">Start Date</label>{" "}
                <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="date"
                  id="filing-leave-start"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleStartDateChange}
                  required
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label htmlFor="filing-leave-end">End Date</label>{" "}
                <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="date"
                  id="filing-leave-end"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleEndDateChange}
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
              className="btn modal-button"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClick}
              className={`btn modal-button ${!hasChanges ? "disabled" : ""}`}
              disabled={!hasChanges || !isFormValid()}
            >
              {isEdit ? "Save Changes" : "Apply"}
            </button>
          </div>
        </form>
      </div>

      {isCancelModalOpen && (
        <CancelModal
          title="Cancel Changes"
          message={`You have unsaved changes. Do you want to discard them?`}
          onClose={() => setIsCancelModalOpen(false)}
          onConfirm={handleCancel}
          cancelText="No"
          confirmText="Yes"
        />
      )}

      {isConfirmModalOpen && (
        <ConfirmModal
          title={isEdit ? "Update Leave Request" : "Confirm Application"}
          message={
            isEdit
              ? "Save changes to this leave request?"
              : `Are you sure you want to confirm application for ${formData.leaveType}?`
          }
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={handleSubmit}
          confirmtext={isEdit ? "Save" : "Yes"}
          cancelText={isEdit ? "Cancel" : "No"}
        />
      )}

      {isConfirmedModalOpen && (
        <ConfirmedMessageModal
          message={
            isEdit
              ? "Leave request successfully updated."
              : "Application submitted successfully."
          }
          onClose={closeConfirmed}
        />
      )}
    </div>,
    document.body,
  );
};

LeaveModal.propTypes = {
  mode: PropTypes.oneOf(["add", "edit"]).isRequired,
  request: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onUpdateLeaveRequests: PropTypes.func,
};

export default LeaveModal;
