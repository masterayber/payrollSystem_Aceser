import { useState, useEffect } from "react";
import {
  formatDate,
  formatFullMonthDate,
} from "../../../../utils/dateFormatter";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import CancelModal from "../../Cancel/CancelModal";
import ConfirmModal from "../../Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Confirmed/ConfirmedMessageModal";
import Pagination from "../../../Pagination/Pagination";
import "../../Modal.css";

const OvertimeModal = ({
  mode,
  request,
  overtimeList = [],
  onClose,
  onUpdateOvertimeRequests,
}) => {
  const isEdit = mode === "edit";

  const [selectedOvertime, setSelectedOvertime] = useState(() => {
    if (!isEdit || !request) return null;

    return {
      _id: request.attendanceId || null,
      date: request.selectedOvertime,
      overtime: {
        start: request.start || "",
        end: request.end || "",
      },
    };
  });
  const [isTableMinimized, setIsTableMinimized] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil((overtimeList?.length || 0) / itemsPerPage);

  const [overtimeDetails, setOvertimeDetails] = useState(
    isEdit ? request?.overtimeDetails || "" : "",
  );
  const [selectedDate, setSelectedDate] = useState(
    isEdit
      ? request?.selectedOvertime
        ? new Date(request.selectedOvertime).toISOString().slice(0, 10)
        : ""
      : "",
  );
  const [start, setStart] = useState(isEdit ? request?.start || "" : "");
  const [end, setEnd] = useState(isEdit ? request?.end || "" : "");

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

  useEffect(() => {
    if (!isEdit && currentPage > totalPages) {
      setCurrentPage(totalPages || 1);
    }
  }, [overtimeList, totalPages, isEdit, currentPage]);

  useEffect(() => {
    if (!isEdit || !request) return;

    const matchingRecord = overtimeList?.find(
      (att) =>
        att._id === request.attendanceId ||
        new Date(att.date).toISOString().slice(0, 10) ===
          new Date(request.selectedOvertime).toISOString().slice(0, 10),
    );

    if (matchingRecord) {
      setSelectedOvertime(matchingRecord);
      setStart(matchingRecord.overtime?.start || request.start || "");
      setEnd(matchingRecord.overtime?.end || request.end || "");
      setSelectedDate(
        new Date(matchingRecord.date || request.selectedOvertime)
          .toISOString()
          .slice(0, 10),
      );
    }
  }, [isEdit, request, overtimeList]);

  const handleSelectedOvertime = (att) => {
    setSelectedOvertime(att);
    setIsTableMinimized(true);
    setStart(att.overtime?.start || "");
    setEnd(att.overtime?.end || "");
    setSelectedDate(new Date(att.date).toISOString().slice(0, 10));
    setHasChanges(true);
  };

  const handleDetailsChange = (e) => {
    setOvertimeDetails(e.target.value);
    setHasChanges(true);
  };

  const isFormValid = () => {
    if (isEdit) {
      return (
        selectedDate && start.trim() && end.trim() && overtimeDetails.trim()
      );
    } else {
      return selectedOvertime && overtimeDetails.trim() !== "";
    }
  };

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("No authentication token found. Please log in again.");
        return;
      }

      let url, method, body;

      if (isEdit) {
        url = `http://localhost:5000/api/filing/edit-overtime/${request._id}`;
        method = "PATCH";
        body = JSON.stringify({
          attendanceId: selectedOvertime?._id,
          selectedOvertime: selectedOvertime?.date,
          start,
          end,
          overtimeDetails: overtimeDetails.trim(),
        });
      } else {
        url = "http://localhost:5000/api/filing/apply-overtime";
        method = "POST";
        body = JSON.stringify({
          attendanceId: selectedOvertime?._id,
          selectedOvertime: selectedOvertime?.date,
          start: selectedOvertime?.overtime?.start,
          end: selectedOvertime?.overtime?.end,
          overtimeDetails: overtimeDetails.trim(),
        });
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || `${isEdit ? "Update" : "Submission"} failed`,
        );
      }

      setIsConfirmModalOpen(false);
      if (onUpdateOvertimeRequests) onUpdateOvertimeRequests();
      setTimeout(() => setIsConfirmedModalOpen(true), 300);
    } catch (err) {
      console.error(
        `Failed ${isEdit ? "updating" : "applying for"} overtime:`,
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
    <div className="modal">
      <div className="modal-content">
        <h3>{isEdit ? "Edit Overtime Request:" : "Apply for Overtime"}</h3>
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

                {overtimeList.length === 0 ? (
                  <div className="table-content">
                    <article className="table-content-container">
                      <h6 className="no-data">No leave requests found</h6>
                    </article>
                  </div>
                ) : (
                  (() => {
                    const sortedList = [...overtimeList].sort(
                      (a, b) => new Date(b.date) - new Date(a.date),
                    );

                    const selectedIndex = sortedList.findIndex(
                      (att) => att._id === selectedOvertime?._id,
                    );

                    if (selectedIndex > 0) {
                      const [selected] = sortedList.splice(selectedIndex, 1);
                      sortedList.unshift(selected);
                    }

                    return sortedList
                      ?.slice(
                        (currentPage - 1) * itemsPerPage,
                        currentPage * itemsPerPage,
                      )
                      .map((att) => (
                        <div
                          key={att._id}
                          className={`table-content ${
                            selectedOvertime?._id === att._id
                              ? "selected-row"
                              : ""
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
                              onClick={() => handleSelectedOvertime(att)}
                            >
                              Select
                            </button>
                          </article>
                        </div>
                      ));
                  })()
                )}

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
                {formatFullMonthDate(selectedOvertime.date)} |{" "}
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
                onChange={handleDetailsChange}
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
          title={isEdit ? "Update Overtime Request" : "Confirm Application"}
          message={
            isEdit
              ? "Save changes to this overtime request?"
              : "Are you sure you want to confirm application?"
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
              ? "Overtime request successfully updated."
              : "Appication sumitted successfully!"
          }
          onClose={closeConfirmed}
        />
      )}
    </div>,
    document.body,
  );
};

OvertimeModal.propTypes = {
  mode: PropTypes.oneOf(["add", "edit"]).isRequired,
  request: PropTypes.object,
  overtimeList: PropTypes.array,
  onClose: PropTypes.func.isRequired,
  onUpdateOvertimeRequests: PropTypes.func,
};

export default OvertimeModal;
