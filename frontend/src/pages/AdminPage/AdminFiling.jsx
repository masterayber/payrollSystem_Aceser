import { useState, useEffect } from "react";
import { formatDate, formatFullMonthDate } from "../../utils/dateFormatter";
import API from "../../api";
import { IconCircleX, IconCircleCheck } from "@tabler/icons-react";
import ConfirmModal from "../../components/Modals/Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../components/Modals/Confirmed/ConfirmedMessageModal";
import "../../styles/UserCSS/Filing.css";

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
          : `/api/filing/${selectedRequest._id}/status`;

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

  const closeConfirmed = () => {
    setIsConfirmedModalOpen(false);
  };

  return (
    <div className="main-content">
      <div className="data-card-container">
        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Total Leave Requests</div>
            <div className="data-value">{leaveRequests.length}</div>
          </div>
        </div>

        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Total Overtime Requests</div>
            <div className="data-value">{overtimeRequests.length}</div>
          </div>
        </div>
      </div>

      <div className="data-card">
        <div className="user-track-title">
          <p>Leave Requests</p>
        </div>
        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Employee Name</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Date Filed</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Date Requested</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Leave Type</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Details</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Status</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Action</p>
            </article>
          </div>
          {isLoading ? (
            <div className="table-content">
              <article className="table-content-container">
                <p className="no-data">Loading Leave Requests...</p>
              </article>
            </div>
          ) : error ? (
            <div className="table-content">
              <article className="table-content-container">
                <p className="no-data">{error}</p>
              </article>
            </div>
          ) : leaveRequests.length === 0 ? (
            <div className="table-content">
              <article className="table-content-container">
                <p className="no-data">No leave requests found.</p>
              </article>
            </div>
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
                  <p>{request.status}</p>
                </article>
                <article className="table-content-container">
                  {request.status !== "Disapproved" &&
                    request.status !== "Approved" && (
                      <>
                        <button
                          className="btn action-button"
                          onClick={() =>
                            handleActionClick(request, "Disapproved")
                          }
                          disabled={request.status !== "Pending"}
                        >
                          <IconCircleX stroke={2} />
                        </button>

                        <button
                          className="btn action-button"
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

      <div className="data-card">
        <div className="user-track-title">
          <p>Overtime Requests</p>
        </div>
        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Employee Name</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Date</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Time In</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Time Out</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Details</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Status</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Action</p>
            </article>
          </div>
          {isLoading ? (
            <div className="table-content">
              <article className="table-content-container">
                <p className="no-data">Loading Overtime Requests...</p>
              </article>
            </div>
          ) : error ? (
            <div className="table-content">
              <article className="table-content-container">
                <p className="no-data">{error}</p>
              </article>
            </div>
          ) : overtimeRequests.length === 0 ? (
            <div className="table-content">
              <article className="table-content-container">
                <p className="no-data">No Overtime Requests Found.</p>
              </article>
            </div>
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
                  <p>{request.status}</p>
                </article>
                <article className="table-content-container">
                  {request.status !== "Disapproved" &&
                    request.status !== "Approved" && (
                      <>
                        <button
                          className="btn action-button"
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
