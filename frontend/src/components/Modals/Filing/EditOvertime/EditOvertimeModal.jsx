import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import CancelModal from "../../Cancel/CancelModal";
import ConfirmModal from "../../Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Confirmed/ConfirmedMessageModal";
import "../../Modal.css";

const EditOvertimeModal = ({ request, onClose, onUpdateOvertimeRequests }) => {
  const [selectedDate, setSelectedDate] = useState(
    request.selectedOvertime
      ? new Date(request.selectedOvertime).toISOString().slice(0, 10)
      : "",
  );
  const [start, setStart] = useState(request.start || "");
  const [end, setEnd] = useState(request.end || "");
  const [overtimeDetails, setOvertimeDetails] = useState(
    request.overtimeDetails || "",
  );
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedModalOpen, setIsConfirmedModalOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  const handleChange = (setter) => (e) => {
    setter(e.target.value);
    setHasChanges(true);
  };

  const isFormValid = () => {
    return (
      selectedDate &&
      start.trim() &&
      end.trim() &&
      overtimeDetails.trim() &&
      new Date(selectedDate) >= new Date("1970-01-01")
    );
  };

  const handleSubmit = async (e) => {
    if (e?.preventDefault) {
      e.preventDefault();
    }
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("No authentication token found. Please log in.");
        return;
      }

      const res = await fetch(
        `http://localhost:5000/api/filing/overtime/${request._id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            selectedOvertime: selectedDate,
            start,
            end,
            overtimeDetails,
          }),
        },
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Update failed");
      }

      setIsConfirmModalOpen(false);
      if (onUpdateOvertimeRequests) onUpdateOvertimeRequests();
      setTimeout(() => {
        setIsConfirmedModalOpen(true);
      }, 300);
    } catch (err) {
      console.error("Failed updating overtime request:", err);
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
    <div className="modal">
      <div className="modal-content">
        <h3>Edit Overtime Request</h3>
        <form onSubmit={handleSubmit} className="form-container">
          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Date</label> <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="date"
                  name="selectedDate"
                  value={selectedDate}
                  onChange={handleChange(setSelectedDate)}
                  required
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Time In</label> <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  value={start}
                  onChange={handleChange(setStart)}
                  placeholder="Start time"
                  required
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Time Out</label> <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  value={end}
                  onChange={handleChange(setEnd)}
                  placeholder="End time"
                  required
                />
              </div>
            </div>
          </div>

          <div className="input-container">
            <div className="label-container">
              <label>Details</label> <span className="required">*</span>
            </div>
            <div className="input-group-signup">
              <input
                type="text"
                value={overtimeDetails}
                placeholder="Details of Overtime"
                onChange={handleChange(setOvertimeDetails)}
                required
              />
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
              disabled={!hasChanges || !isFormValid()}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {isCancelModalOpen && (
        <CancelModal
          title="Cancel Changes"
          message="You have unsaved changes. Do you want to discard them?"
          onClose={() => setIsCancelModalOpen(false)}
          onConfirm={handleCancel}
          cancelText="No"
          confirmText="Yes"
        />
      )}

      {isConfirmModalOpen && (
        <ConfirmModal
          title="Update Overtime Request"
          message="Save changes to this overtime request?"
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={handleSubmit}
          confirmText="Save"
          cancelText="Cancel"
        />
      )}

      {isConfirmedModalOpen && (
        <ConfirmedMessageModal
          message="Overtime request successfully updated."
          onClose={closeConfirmed}
        />
      )}
    </div>,
    document.body,
  );
};

EditOvertimeModal.propTypes = {
  request: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onUpdateOvertimeRequests: PropTypes.func,
};

export default EditOvertimeModal;
