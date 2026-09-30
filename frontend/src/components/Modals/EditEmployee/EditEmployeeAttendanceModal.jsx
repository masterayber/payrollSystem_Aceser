import { useState } from "react";
import "../Modal.css";
import PropTypes from "prop-types";
import CancelModal from "../Cancel/CancelModal";
import ConfirmModal from "../Confirm/ConfirmModal";
import ConfirmedMessageModal from "../Confirmed/ConfirmedMessageModal";

const EditEmployeeAttendanceModal = ({
  employee,
  onClose,
  onUpdateAttendance,
}) => {
  const toHHMMSS = (value) => {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(11, 19);
  };

  const initialAttendance = {
    timeIn: toHHMMSS(employee.timeIn),
    timeOut: toHHMMSS(employee.timeOut),
  };

  const [editedAttendance, setEditedAttendance] = useState(initialAttendance);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedModalOpen, setIsConfirmedModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState(false);

  const hasChanges =
    editedAttendance.timeIn !== initialAttendance.timeIn ||
    editedAttendance.timeOut !== initialAttendance.timeOut;

  const handleChange = (e) => {
    const { name, value } = e.target;

    const digitsOnly = value.replace(/\D/g, "").slice(0, 6);
    const prevValue = editedAttendance[name].replace(":", "");
    const isDeleting = digitsOnly.length < prevValue.length;

    let formattedValue = "";

    if (digitsOnly.length === 0) {
      formattedValue = "";
    } else if (digitsOnly.length <= 2) {
      formattedValue =
        digitsOnly.length === 2 && !isDeleting ? `${digitsOnly}:` : digitsOnly;
    } else if (digitsOnly.length <= 4) {
      const hh = digitsOnly.slice(0, 2);
      const mm = digitsOnly.slice(2);
      formattedValue =
        mm.length === 2 && !isDeleting ? `${hh}:${mm}:` : `${hh}:${mm}`;
    } else {
      const hh = digitsOnly.slice(0, 2);
      const mm = digitsOnly.slice(2, 4);
      const ss = digitsOnly.slice(4);
      formattedValue = `${hh}:${mm}:${ss}`;
    }

    setEditedAttendance((prev) => ({
      ...prev,
      [name]: formattedValue,
    }));
  };

  const isValidTime = (value) => {
    const match = value.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return false;
    const [, h, m, s] = match;
    return Number(h) <= 23 && Number(m) <= 59 && Number(s) <= 59;
  };

  const handleCancelClick = (e) => {
    e.preventDefault();
    if (hasChanges) {
      setIsCancelModalOpen(true);
    } else {
      onClose();
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleConfirmClick();
  };

  const handleConfirmClick = async () => {
    if (
      !isValidTime(editedAttendance.timeIn) ||
      !isValidTime(editedAttendance.timeOut)
    ) {
      setErrorMessage("Please enter valid times in HH:MM format.");
      return;
    }
    setErrorMessage("");
    setIsConfirmModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/attendance/edit-attendance/${employee._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employeeId: employee._id,
            date: employee.date,
            timeIn: editedAttendance.timeIn,
            timeOut: editedAttendance.timeOut,
          }),
        },
      );

      if (response.ok) {
        setIsConfirmModalOpen(false);
        if (onUpdateAttendance) await onUpdateAttendance();
        setTimeout(() => setIsConfirmedModalOpen(true), 300);
      } else {
        console.error("Failed to update attendance. Please try again later");
        setErrorMessage("Failed to updated attendance. Please try again.");
        setIsConfirmModalOpen(false);
      }
    } catch (error) {
      console.error("Error updating attendance:", error);
      setErrorMessage("Something went wrong. Please try again.");
      setIsConfirmModalOpen(false);
    }
  };

  const handleCancel = () => {
    setIsCancelModalOpen(false);
    onClose();
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Edit Attendance</h3>
        <form onSubmit={handleFormSubmit} className="form-container">
          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>First Name</label>
              </div>
              <div className="input-group-signup">
                <input type="text" value={employee.firstName} disabled />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Last Name</label>
              </div>
              <div className="input-group-signup">
                <input type="text" value={employee.lastName} disabled />
              </div>
            </div>
          </div>

          <div className="input-container">
            <div className="label-container">
              <label>Date</label>
            </div>
            <div className="input-group-signup">
              <input type="date" value={employee.date} disabled />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Time In</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="timeIn"
                  placeholder="HH:MM:SS"
                  value={editedAttendance.timeIn}
                  onChange={handleChange}
                  maxLength={8}
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Time Out</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="timeOut"
                  placeholder="HH:MM:SS"
                  value={editedAttendance.timeOut}
                  onChange={handleChange}
                  maxLength={8}
                />
              </div>
            </div>
          </div>

          {errorMessage && <p className="error-message">{errorMessage}</p>}

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
              Save
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
          title="Confirm Edit"
          message={`Are you sure you want to save changes?`}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={handleSubmit}
          cancelText="No"
          confirmText="Yes"
        />
      )}

      {isConfirmedModalOpen && (
        <ConfirmedMessageModal
          message="Edit successfully saved!"
          onClose={() => {
            setIsConfirmedModalOpen(false);
            onClose();
          }}
        />
      )}
    </div>
  );
};

export default EditEmployeeAttendanceModal;

EditEmployeeAttendanceModal.propTypes = {
  employee: PropTypes.shape({
    id: PropTypes.string,
    _id: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    date: PropTypes.string,
    timeIn: PropTypes.string,
    timeOut: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onUpdateAttendance: PropTypes.func.isRequired,
};
