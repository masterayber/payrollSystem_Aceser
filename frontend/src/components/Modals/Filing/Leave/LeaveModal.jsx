import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import CancelModal from "../../Cancel/CancelModal";
import ConfirmModal from "../../Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Confirmed/ConfirmedMessageModal";
import "../../Modal.css";
import Dropdown from "../../../Dropdown/Dropdown";
import API from "../../../../api";

import {
  CREDIT_LEAVE_TYPES,
  countWeekdays,
  daysText,
  monthName,
} from "../../../../utils/leaveCredits";
import { LEAVE_TYPE_NAMES } from "../../../../utils/leaveTypes";
import { refusalText } from "../../../../utils/feedback";

const LeaveModal = ({
  mode,
  request,
  credits,
  onClose,
  onUpdateLeaveRequests,
}) => {
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
  const [errorMessage, setErrorMessage] = useState("");
  const [isSingleDayLeave, setIsSingleDayLeave] = useState(
    isEdit ? formData.startDate === formData.endDate : false,
  );

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  // Any input change: the form now differs, and an earlier refusal no longer applies
  const markChanged = () => {
    setHasChanges(true);
    setErrorMessage("");
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    markChanged();
  };

  const handleLeaveTypeChange = (selectedType) => {
    setFormData((prev) => ({ ...prev, leaveType: selectedType }));
    markChanged();
  };

  const handleStartDateChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      startDate: value,
      endDate: isSingleDayLeave ? value : prev.endDate,
    }));
    markChanged();
  };

  const handleEndDateChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, endDate: value }));
    markChanged();
  };

  const handleSingleDayToggle = (e) => {
    const checked = e.target.checked;
    setIsSingleDayLeave(checked);
    if (checked && formData.startDate) {
      setFormData((prev) => ({ ...prev, endDate: prev.startDate }));
    }
    markChanged();
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
        alert("No authentication token found. Please log in again.");
        return;
      }

      // API adds the Authorization header and sends formData as JSON
      if (isEdit) {
        await API.patch(`/api/filing/edit-leave/${request._id}`, formData);
      } else {
        await API.post("/api/filing/apply-leave", formData);
      }

      setIsConfirmModalOpen(false);
      setErrorMessage("");
      if (onUpdateLeaveRequests) onUpdateLeaveRequests();
      setTimeout(() => setIsConfirmedModalOpen(true), 300);
    } catch (err) {
      console.error(
        `Failed ${isEdit ? "updating" : "applying for"} leave:`,
        err,
      );
      setIsConfirmModalOpen(false);
      // Server refusal: its own text; a server fault or no reply: a plain message
      setErrorMessage(
        refusalText(err, `${isEdit ? "Update" : "Submission"} failed`),
      );
      // A refused edit (4xx, e.g. already decided): reload the list behind the
      // modal so the request loses its buttons; the modal stays open
      const status = err.response?.status;
      if (isEdit && status >= 400 && status < 500 && onUpdateLeaveRequests) {
        onUpdateLeaveRequests();
      }
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

  const getCreditNote = () => {
    if (!credits || !CREDIT_LEAVE_TYPES.includes(formData.leaveType)) {
      return "";
    }
    const balance =
      formData.leaveType === "Vacation Leave"
        ? `Vacation Leave left: ${daysText(credits.vacation.available)}.`
        : `Sick Leave left in ${monthName(credits.sick.month)}: ${daysText(credits.sick.available)}.`;
    const requested =
      formData.startDate && formData.endDate >= formData.startDate
        ? ` This request: ${daysText(countWeekdays(formData.startDate, formData.endDate))} (Monday to Friday).`
        : "";
    return balance + requested;
  };

  const creditNote = getCreditNote();

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
              options={LEAVE_TYPE_NAMES}
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

          {creditNote && <p className="feedback-message">{creditNote}</p>}
          {errorMessage && (
            <p className="feedback-message error">{errorMessage}</p>
          )}

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
          confirmText={isEdit ? "Save" : "Yes"}
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
  credits: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onUpdateLeaveRequests: PropTypes.func,
};

export default LeaveModal;
