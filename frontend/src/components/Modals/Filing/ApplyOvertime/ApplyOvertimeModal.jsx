import { useState, useEffect } from "react";
import { formatDate } from "../../../../utils/dateFormatter";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import CancelModal from "../../Cancel/CancelModal";
import ConfirmModal from "../../Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Confirmed/ConfirmedMessageModal";
import Pagination from "../../../Pagination/Pagination";
import "../../Modal.css";

const ApplyOvertimeModal = ({
  overtimeList = [],
  onClose,
  onUpdateOvertimeRequests,
}) => {
  const [selectedOvertime, setSelectedOvertime] = useState(null);
  const [isTableMinimized, setIsTableMinimized] = useState(false);
  const [overtimeDetails, setOvertimeDetails] = useState("");

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedModalOpen, setIsConfirmedModalOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil((overtimeList?.length || 0) / itemsPerPage);

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages || 1);
    }
  }, [overtimeList, totalPages]);

  const handleSelect = (att) => {
    setSelectedOvertime(att);
    setIsTableMinimized(true);
    setHasChanges(true);
  };

  const handleChange = (e) => {
    setOvertimeDetails(e.target.value);
    setHasChanges(true);
  };

  const isFormValid = () => {
    return selectedOvertime && overtimeDetails.trim() !== "";
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

  const handleSubmit = async () => {
    if (!isFormValid()) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("No authentication token found. Please retry logging in.");
        return;
      }

      const formData = {
        overtimeId: selectedOvertime._id,
        selectedOvertime: selectedOvertime.date,
        start: selectedOvertime.overtime?.start,
        end: selectedOvertime.overtime?.end,
        overtimeDetails: overtimeDetails.trim(),
      };

      const res = await fetch(
        "http://localhost:5000/api/filing/apply-overtime",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        },
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Submission failed");
      }

      setIsConfirmModalOpen(false);

      if (onUpdateOvertimeRequests) onUpdateOvertimeRequests();

      setTimeout(() => setIsConfirmedModalOpen(true), 300);
    } catch (err) {
      console.error("Failed applying for overtime:", err);
    }
  };

  return ReactDOM.createPortal(
    <div className="modal">
      <div className="modal-content">
        <h3>Apply for Overtime</h3>
        <form onSubmit={handleSubmit} className="form-container">
          <div className="table">
            <div className="table-toggler">
              <p>Overtime Records</p>
              <button
                type="button"
                onClick={() => setIsTableMinimized(!isTableMinimized)}
                className="toggle-btn"
              >
                {isTableMinimized ? "[Show]" : "[Hide]"}
              </button>
            </div>
            {!isTableMinimized && (
              <>
                <div className="table-header">
                  <article className="table-header-container">
                    <p>Date</p>
                  </article>
                  <article className="table-header-container">
                    <p>Time In</p>
                  </article>
                  <article className="table-header-container">
                    <p>Time Out</p>
                  </article>
                  <article className="table-header-container">
                    <p>Action</p>
                  </article>
                </div>

                {overtimeList
                  ?.slice(
                    (currentPage - 1) * itemsPerPage,
                    currentPage * itemsPerPage,
                  )
                  .map((att) => (
                    <div
                      key={att._id}
                      className={`table-content ${
                        selectedOvertime?._id === att._id ? "selected-row" : ""
                      }`}
                    >
                      <article className="table-content-container">
                        <p>{formatDate(att.date)}</p>
                      </article>
                      <article className="table-content-container">
                        <p>{att.overtime?.start}</p>
                      </article>
                      <article className="table-content-container">
                        <p>{att.overtime?.end}</p>
                      </article>
                      <article className="table-content-container">
                        <button
                          type="button"
                          className="action-button"
                          onClick={() => handleSelect(att)}
                        >
                          Select
                        </button>
                      </article>
                    </div>
                  ))}

                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </div>

          {isTableMinimized && selectedOvertime && (
            <div className="selected-summary">
              <p>
                <strong>Selected: </strong>
                {formatDate(selectedOvertime.date)} |{" "}
                {selectedOvertime.overtime?.start} -{" "}
                {selectedOvertime.overtime?.end}
              </p>
              <button
                type="button"
                className="modal-button"
                onClick={() => setIsTableMinimized(false)}
              >
                Change
              </button>
            </div>
          )}

          <div className="input-container">
            <div className="label-container">
              <label>Details</label> <span className="required">*</span>
            </div>
            <div className="input-group-signup">
              <input
                type="text"
                value={overtimeDetails}
                placeholder="Details of Overtime"
                onChange={handleChange}
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
              className={`modal-button ${!isFormValid() ? "disabled" : ""}`}
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
          message="Are you sure you want to cancel overtime application?"
          onClose={() => setIsCancelModalOpen(false)}
          onConfirm={handleCancel}
          cancelText="No"
          confirmText="Yes"
        />
      )}

      {isConfirmModalOpen && (
        <ConfirmModal
          title="Confirm Application"
          message={`Are you sure you want to confirm application?`}
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

export default ApplyOvertimeModal;

ApplyOvertimeModal.propTypes = {
  overtimeList: PropTypes.array,
  onClose: PropTypes.func,
  onUpdateOvertimeLists: PropTypes.func,
};
