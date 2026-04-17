import { useState, useContext, useEffect } from "react";
import { formatDate, formatFullMonthDate } from "../../utils/dateFormatter";
import LeaveModal from "../../components/Modals/Filing/Leave/LeaveModal";
import OvertimeModal from "../../components/Modals/Filing/Overtime/OvertimeModal";
import DeleteModal from "../../components/Modals/Delete/DeleteModal";
import { IconPlus } from "@tabler/icons-react";
import "../../styles/UserCSS/Filing.css";
import API from "../../api";
import { FilingContext } from "../../context/FilingContext";
import ConfirmedMessageModal from "../../components/Modals/Confirmed/ConfirmedMessageModal";

const Filing = () => {
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);
  const [isEditLeaveOpen, setIsEditLeaveOpen] = useState(false);
  const [isApplyOvertimeOpen, setIsApplyOvertimeOpen] = useState(false);
  const [isEditOvertimeOpen, setIsEditOvertimeOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isConfirmedModalOpen, setIsConfirmedModalOpen] = useState(false);
  const [userOvertimeLists, setUserOvertimeLists] = useState([]);
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null);
  const [selectedOvertimeRequest, setSelectedOvertimeRequest] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState({
    type: null,
    request: null,
  });
  const {
    leaveRequests: userLeaveRequests,
    overtimeRequests: userOvertimeRequests,
    refreshFilingData,
  } = useContext(FilingContext);

  const handleApplyLeave = () => {
    setIsApplyLeaveOpen(true);
  };

  const handleEditLeave = (request) => {
    setSelectedLeaveRequest(request);
    setIsEditLeaveOpen(true);
  };

  const handleApplyOvertime = async () => {
    await handleUserOvertimeLists();
    setIsApplyOvertimeOpen(true);
  };

  const handleEditOvertime = async (request) => {
    setSelectedOvertimeRequest(request);
    await handleUserOvertimeLists("edit");
    setIsEditOvertimeOpen(true);
  };

  const handleDeleteTarget = (request, type) => {
    setDeleteTarget({ type, request });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.request || !deleteTarget?.type) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("No authentication token found. Please log in again.");
        return;
      }

      const url = `http://localhost:5000/api/filing/${deleteTarget.type}/${deleteTarget.request._id}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Delete failed");
      }

      setIsDeleteModalOpen(false);
      setDeleteTarget({ type: null, request: null });
      await refreshFilingData();

      setTimeout(() => setIsConfirmedModalOpen(true), 300);
    } catch (err) {
      console.error("Failed deleting request:", err);
    }
  };

  const handleUserLeaveRequests = async () => {
    await refreshFilingData();
  };

  const handleUserOvertimeRequests = async () => {
    await refreshFilingData();
  };

  const handleUserOvertimeLists = async (mode = "add") => {
    try {
      const response = await API.get(
        `/api/filing/user-overtime-candidates?mode=${mode}`,
      );
      setUserOvertimeLists(response.data);
    } catch (error) {
      console.error("Error fetching overtime candidates:", error);
    }
  };

  const closeConfirmed = () => {
    setIsConfirmedModalOpen(false);
  };

  useEffect(() => {
    refreshFilingData();
  }, [refreshFilingData]);

  const leavePendingCount = userLeaveRequests.filter(
    (request) => request.status === "Pending",
  ).length;

  const overtimePendingCount = userOvertimeRequests.filter(
    (request) => request.status === "Pending",
  ).length;

  return (
    <div className="main-content">
      <div className="user-track-container">
        <div className="user-track">
          <p>Total Leave Requests</p>
          <div className="total-user-track">
            <span className="user-number">{leavePendingCount}</span>
          </div>
        </div>

        <div className="user-track">
          <p>Total Overtime Request</p>
          <div className="total-user-track">
            <span className="user-number">{overtimePendingCount}</span>
          </div>
        </div>
      </div>

      <div className="application-container">
        <div className="leave-application">
          <p>Application for Leave</p>
          <button className="apply-button" onClick={() => handleApplyLeave()}>
            <IconPlus stroke={2} />
            Apply
          </button>
        </div>

        <div className="overtime-application">
          <p>Application for Overtime</p>
          <button
            className="apply-button"
            onClick={() => handleApplyOvertime()}
          >
            <IconPlus stroke={2} />
            Apply
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-title">
          <p>Leave Requests</p>
        </div>
        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Date Filed</p>
            </article>
            <article className="table-header-container">
              <p>Date Requested</p>
            </article>
            <article className="table-header-container">
              <p>Leave Type</p>
            </article>
            <article className="table-header-container">
              <p>Details</p>
            </article>
            <article className="table-header-container">
              <p>Status</p>
            </article>
            <article className="table-header-container">
              <p>Action</p>
            </article>
          </div>
          {userLeaveRequests.length === 0 ? (
            <div className="table-content">
              <article className="table-content-container">
                <h6 className="no-data">No leave requests found.</h6>
              </article>
            </div>
          ) : (
            userLeaveRequests.map((user) => (
              <div key={user._id} className="table-content">
                <article className="table-content-container">
                  <p>{formatDate(user.appliedAt)}</p>
                </article>
                <article className="table-content-container">
                  <p>{formatDate(user.startDate, user.endDate)}</p>
                </article>
                <article className="table-content-container">
                  <p>{user.leaveType}</p>
                </article>
                <article className="table-content-container">
                  <p>{user.leaveDetails}</p>
                </article>
                <article className="table-content-container">
                  <p>{user.status}</p>
                </article>
                <article className="table-content-container">
                  <button
                    className="action-button"
                    onClick={() => handleEditLeave(user)}
                  >
                    Edit
                  </button>
                  <button
                    className="action-button"
                    onClick={() => handleDeleteTarget(user, "leave")}
                  >
                    Delete
                  </button>
                </article>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="table-container">
        <div className="table-title">
          <p>Overtime Application</p>
        </div>
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
            <article className="table-header-container">
              <p>Details</p>
            </article>
            <article className="table-header-container">
              <p>Status</p>
            </article>
            <article className="table-header-container">
              <p>Action</p>
            </article>
          </div>

          {userOvertimeRequests.length === 0 ? (
            <div className="table-content">
              <article className="table-content-container">
                <h6 className="no-data">No Overtime Requests</h6>
              </article>
            </div>
          ) : (
            userOvertimeRequests.map((overtime) => (
              <div key={overtime._id} className="table-content">
                <article className="table-content-container">
                  <p>{formatDate(overtime.selectedOvertime)}</p>
                </article>
                <article className="table-content-container">
                  <p>{overtime.start}</p>
                </article>
                <article className="table-content-container">
                  <p>{overtime.end}</p>
                </article>
                <article className="table-content-container">
                  <p>{overtime.overtimeDetails}</p>
                </article>
                <article className="table-content-container">
                  <p>{overtime.status}</p>
                </article>
                <article className="table-content-container">
                  <button
                    className="action-button"
                    onClick={() => handleEditOvertime(overtime)}
                  >
                    Edit
                  </button>
                  <button
                    className="action-button"
                    onClick={() => handleDeleteTarget(overtime, "overtime")}
                  >
                    Delete
                  </button>
                </article>
              </div>
            ))
          )}
        </div>
      </div>

      {isApplyLeaveOpen && (
        <LeaveModal
          mode="add"
          onClose={() => setIsApplyLeaveOpen(false)}
          onUpdateLeaveRequests={handleUserLeaveRequests}
        />
      )}

      {isEditLeaveOpen && selectedLeaveRequest && (
        <LeaveModal
          mode="edit"
          request={selectedLeaveRequest}
          onClose={() => {
            setIsEditLeaveOpen(false);
            setSelectedLeaveRequest(null);
          }}
          onUpdateLeaveRequests={handleUserLeaveRequests}
        />
      )}

      {isApplyOvertimeOpen && (
        <OvertimeModal
          mode="add"
          overtimeList={userOvertimeLists}
          onClose={() => setIsApplyOvertimeOpen(false)}
          onUpdateOvertimeRequests={handleUserOvertimeRequests}
        />
      )}

      {isEditOvertimeOpen && selectedOvertimeRequest && (
        <OvertimeModal
          mode="edit"
          request={selectedOvertimeRequest}
          overtimeList={userOvertimeLists}
          onClose={() => {
            setIsEditOvertimeOpen(false);
            setSelectedOvertimeRequest(null);
          }}
          onUpdateOvertimeRequests={handleUserOvertimeRequests}
        />
      )}

      {isDeleteModalOpen && (
        <DeleteModal
          title={
            deleteTarget.type === "leave"
              ? "Delete Leave Application"
              : "Delete Overtime Application"
          }
          message={
            deleteTarget.type === "leave"
              ? `Are you sure you want to delete this leave request from ${deleteTarget.request?.leaveType || "this request"}? This action cannot be undone.`
              : `Are you sure you want to delete this overtime request for ${formatFullMonthDate(deleteTarget.request?.selectedOvertime) || "this requst"}? This action cannot be undone.`
          }
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          confirmText="Yes"
          cancelText="No"
        />
      )}

      {isConfirmedModalOpen && (
        <ConfirmedMessageModal
          message="Request deleted successfully."
          onClose={closeConfirmed}
        />
      )}
    </div>
  );
};

export default Filing;
