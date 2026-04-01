import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import CancelModal from "../../Cancel/CancelModal";
import ConfirmModal from "../../Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Confirmed/ConfirmedMessageModal";
import Dropdown from "../../../Dropdown/Dropdown";
import Pagination from "../../../Pagination/Pagination";
import "../../Modal.css";

const ApplyOvertimeModal = ({
  overtimeList,
  onClose,
  onUpdateOvertimeLists,
}) => {
  const [details, setDetails] = useState(false);
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

  const handleChange = () => {};

  const handleCancelClick = (e) => {
    e.preventDefault();
    if (hasChanges) {
      setIsCancelModalOpen(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClick = async () => {
    // if (!isFormValid()) {
    //   alert("Inputs cannot be empty");
    //   return;
    // }
    setIsConfirmModalOpen(true);
  };

  const handleCancel = () => {
    setIsCancelModalOpen(false);
    onClose();
  };

  const handleSubmit = () => {};

  return ReactDOM.createPortal(
    <div className="modal">
      <div className="modal-content">
        <h3>Apply for Overtime</h3>
        <form onSubmit={handleSubmit} className="form-container">
          <div className="table">
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
            </div>

            {overtimeList
              ?.slice(
                (currentPage - 1) * itemsPerPage,
                currentPage * itemsPerPage,
              )
              .map((att) => (
                <div key={att._id} className="table-content">
                  <article className="table-content-container">
                    <p>{att.date}</p>
                  </article>
                  <article className="table-content-container">
                    <p>{att.timeIn}</p>
                  </article>
                  <article className="table-content-container">
                    <p>{att.timeOut}</p>
                  </article>
                </div>
              ))}

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>

          <div className="input-container">
            <div className="label-container">
              <label>Details</label> <span className="required">*</span>
            </div>
            <div className="input-group-signup">
              <input
                type="text"
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
              className={`modal-button ${!hasChanges ? "disabled" : ""}`}
              // disabled={!isFormValid()}
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
  onClose: PropTypes.func,
};
