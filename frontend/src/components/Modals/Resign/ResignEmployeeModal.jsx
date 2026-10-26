import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import "../Modal.css";
import API from "../../../api";
import { manilaToday } from "../../../utils/cutoff";

// Asks for the last working day and an optional reason, then marks the employee as
// resigned. They can no longer log in; their records are kept.
const ResignEmployeeModal = ({ userId, name, onClose, onResigned }) => {
  const [resignationDate, setResignationDate] = useState(manilaToday());
  const [resignationReason, setResignationReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await API.patch(`/api/employee/employees/${userId}/resign`, {
        resignationDate,
        resignationReason,
      });
      onResigned();
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Could not mark as resigned.",
      );
      setIsSaving(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="modal">
      <div className="modal-content employee-modal-content resign-modal">
        <h3>Mark as Resigned</h3>
        <p className="message">
          <b>{name}</b> will no longer be able to log in. Their attendance,
          filings and pay records are kept.
        </p>

        <div className="form-container">
          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label htmlFor="resignation-date">Last Working Day </label>
                <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="date"
                  id="resignation-date"
                  value={resignationDate}
                  onChange={(e) => setResignationDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label htmlFor="resignation-reason">Reason (optional)</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  id="resignation-reason"
                  maxLength={500}
                  placeholder="Enter text here"
                  value={resignationReason}
                  onChange={(e) => setResignationReason(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {errorMessage && (
          <p className="feedback-message error">{errorMessage}</p>
        )}

        <div className="modal-buttons">
          <button type="button" className="btn modal-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn modal-button ${!resignationDate || isSaving ? "disabled" : ""}`}
            disabled={!resignationDate || isSaving}
            onClick={handleSubmit}
          >
            Mark as Resigned
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

ResignEmployeeModal.propTypes = {
  userId: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onResigned: PropTypes.func.isRequired,
};

export default ResignEmployeeModal;
