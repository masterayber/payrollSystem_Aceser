import { useState, useEffect } from "react";
import { formatDate, formatFullMonthDate } from "../../utils/dateFormatter";
import API from "../../api";
import { IconCircleX, IconCircleCheck } from "@tabler/icons-react";
import ConfirmModal from "../../components/Modals/Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../components/Modals/Confirmed/ConfirmedMessageModal";
import "../../styles/UserCSS/Filing.css";
import "../../styles/AdminCSS/AdminFiling.css";

const AdminFiling = () => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [overtimeRequests, setOvertimeRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedRequestType, setSelectedRequestType] = useState(null);
  const [selectedAction, setSelectedAction] = useState("");
  const [completedAction, setCompletedAction] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedModalOpen, setIsConfirmedModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeaveRequests = async () => {
    try {
      setError(null);
      const response = await API.get("/api/filing");
      setLeaveRequests(response.data || []);
    } catch (err) {
      console.error("Failed to fetch leave requests:", err);
      setError("Unable to load leave requests.");
    }
  };

  const fetchOvertimeRequests = async () => {
    try {
      setError(null);
      const response = await API.get("/api/filing/overtime");
      setOvertimeRequests(response.data || []);
    } catch (err) {
      console.error("Failed to fetch overtime requests:", err);
      setError("Unable to load overtime requests.");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        await Promise.all([fetchLeaveRequests(), fetchOvertimeRequests()]);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const getEmployeeName = (request) => {
    if (request.employeeFirstName || request.employeeLastName) {
      return `${request.employeeFirstName || ""} ${request.employeeLastName || ""}`.trim();
    }
    return request.employeeEmail || "Unknown Employee";
  };

  const handleActionClick = (request, action, type = "leave") => {
    setSelectedRequest(request);
    setSelectedRequestType(type);
    setSelectedAction(action);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedRequest || !selectedAction) return;

    try {
      const endpoint =
        selectedRequestType === "overtime"
          ? `/api/filing/overtime/${selectedRequest._id}/status`
          : `/api/filing/leave/${selectedRequest._id}/status`;

      await API.patch(endpoint, {
        status: selectedAction,
      });
      setIsConfirmModalOpen(false);
      setSelectedRequest(null);
      setCompletedAction(selectedAction);

      await Promise.all([fetchLeaveRequests(), fetchOvertimeRequests()]);

      setTimeout(() => setIsConfirmedModalOpen(true), 300);

      setSelectedAction("");
    } catch (err) {
      console.error("Failed to update request status:", err);
      setError("Unable to update request status.");
      setIsConfirmModalOpen(false);
      setSelectedRequest(null);
      setSelectedAction("");
      setSelectedRequestType(null);
    }
  };

  const STATUS_ORDER = { Pending: 0, Approved: 1, Disapproved: 2 };
  const sortedLeaveRequests = [...leaveRequests].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
  );

  const sortedOvertimeRequests = [...overtimeRequests].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
  );

  const pendingLeaveCount = leaveRequests.filter(
    (req) => req.status === "Pending",
  ).length;
  const pendingOvertimeCount = overtimeRequests.filter(
    (req) => req.status === "Pending",
  ).length;

  const closeConfirmed = () => {
    setIsConfirmedModalOpen(false);
  };

  return (
    <div className="main-content admin-filing-page">
      <div className="data-card-container filing-summary-grid">
        <div className="data-card filing-metric-card">
          <div className="message-container">
            <div className="data-title">Pending Leave Requests</div>
            <div className="data-value">{pendingLeaveCount}</div>
          </div>
        </div>

        <div className="data-card filing-metric-card">
          <div className="message-container">
            <div className="data-title">Pending Overtime Requests</div>
            <div className="data-value">{pendingOvertimeCount}</div>
          </div>
        </div>
      </div>

      <div className="data-card filing-review-card">
        <div className="user-track-title">
          <p>Leave Requests</p>
        </div>
        <div className="table filing-review-table filing-review-leave-table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Employee Name</p>
            </article>
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
          {isLoading ? (
            <p className="no-data filing-empty-state">Loading leave requests...</p>
          ) : error ? (
            <p className="no-data filing-empty-state">{error}</p>
          ) : leaveRequests.length === 0 ? (
            <p className="no-data filing-empty-state">
              No leave requests found.
            </p>
          ) : (
            sortedLeaveRequests.map((request) => (
              <div className="table-content" key={request._id}>
                <article className="table-content-container">
                  <p>{getEmployeeName(request)}</p>
                </article>
                <article className="table-content-container">
                  <p>{formatFullMonthDate(request.appliedAt)}</p>
                </article>
                <article className="table-content-container">
                  <p>{formatDate(request.startDate, request.endDate)}</p>
                </article>
                <article className="table-content-container">
                  <p>{request.leaveType}</p>
                </article>
                <article className="table-content-container">
                  <p>{request.leaveDetails}</p>
                </article>
                <article className="table-content-container">
                  <span className="filing-status" data-status={request.status}>
                    {request.status}
                  </span>
                </article>
                <article className="table-content-container">
                  {request.status !== "Disapproved" &&
                    request.status !== "Approved" && (
                      <>
                        <button
                          className="btn action-button"
                          type="button"
                          aria-label={`Disapprove leave request for ${getEmployeeName(request)}`}
                          title="Disapprove leave request"
                          onClick={() =>
                            handleActionClick(request, "Disapproved")
                          }
                          disabled={request.status !== "Pending"}
                        >
                          <IconCircleX stroke={2} />
                        </button>

                        <button
                          className="btn action-button"
                          type="button"
                          aria-label={`Approve leave request for ${getEmployeeName(request)}`}
                          title="Approve leave request"
                          onClick={() => handleActionClick(request, "Approved")}
                          disabled={request.status !== "Pending"}
                        >
                          <IconCircleCheck stroke={2} />
                        </button>
                      </>
                    )}
                </article>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="data-card filing-review-card">
        <div className="user-track-title">
          <p>Overtime Requests</p>
        </div>
        <div className="table filing-review-table filing-review-overtime-table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Employee Name</p>
            </article>
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
          {isLoading ? (
            <p className="no-data filing-empty-state">
              Loading overtime requests...
            </p>
          ) : error ? (
            <p className="no-data filing-empty-state">{error}</p>
          ) : overtimeRequests.length === 0 ? (
            <p className="no-data filing-empty-state">
              No overtime requests found.
            </p>
          ) : (
            sortedOvertimeRequests.map((request) => (
              <div className="table-content" key={request._id}>
                <article className="table-content-container">
                  <p>{getEmployeeName(request)}</p>
                </article>
                <article className="table-content-container">
                  <p>{formatFullMonthDate(request.appliedAt)}</p>
                </article>
                <article className="table-content-container">
                  <p>{request.start}</p>
                </article>
                <article className="table-content-container">
                  <p>{request.end}</p>
                </article>
                <article className="table-content-container">
                  <p>{request.overtimeDetails}</p>
                </article>
                <article className="table-content-container">
                  <span className="filing-status" data-status={request.status}>
                    {request.status}
                  </span>
                </article>
                <article className="table-content-container">
                  {request.status !== "Disapproved" &&
                    request.status !== "Approved" && (
                      <>
                        <button
                          className="btn action-button"
                          type="button"
                          aria-label={`Disapprove overtime request for ${getEmployeeName(request)}`}
                          title="Disapprove overtime request"
                          onClick={() =>
                            handleActionClick(
                              request,
                              "Disapproved",
                              "overtime",
                            )
                          }
                          disabled={request.status !== "Pending"}
                        >
                          <IconCircleX stroke={2} />
                        </button>

                        <button
                          className="btn action-button"
                          type="button"
                          aria-label={`Approve overtime request for ${getEmployeeName(request)}`}
                          title="Approve overtime request"
                          onClick={() =>
                            handleActionClick(request, "Approved", "overtime")
                          }
                          disabled={request.status !== "Pending"}
                        >
                          <IconCircleCheck stroke={2} />
                        </button>
                      </>
                    )}
                </article>
              </div>
            ))
          )}
        </div>
      </div>

      {isConfirmModalOpen && selectedRequest && (
        <ConfirmModal
          title={
            selectedRequestType === "overtime"
              ? selectedAction === "Approved"
                ? "Approved Overtime"
                : "Disapprove Overtime"
              : selectedAction === "Approved"
                ? "Approve Leave"
                : "Disapprove Leave"
          }
          message={`Are you sure you want to ${selectedAction === "Approved" ? "approve" : "disapprove"} this ${selectedRequestType} request for ${getEmployeeName(selectedRequest)}?`}
          onClose={() => {
            setIsConfirmModalOpen(false);
            setSelectedRequest(null);
            setSelectedAction("");
            setSelectedRequestType(null);
          }}
          onConfirm={handleConfirmAction}
          confirmText={selectedAction === "Approved" ? "Approve" : "Disapprove"}
          cancelText="Cancel"
        />
      )}

      {isConfirmedModalOpen && (
        <ConfirmedMessageModal
          message={`Request ${completedAction} Successfully.`}
          onClose={() => {
            closeConfirmed();
            setCompletedAction("");
          }}
        />
      )}
    </div>
  );
};

export default AdminFiling;
