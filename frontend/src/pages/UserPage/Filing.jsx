import { useState, useContext, useEffect } from "react";
import { formatDate } from "../../utils/dateFormatter";
import ApplyLeaveModal from "../../components/Modals/Filing/ApplyLeave/ApplyLeaveModal";
import ApplyOvertimeModal from "../../components/Modals/Filing/ApplyOvertime/ApplyOvertimeModal";
import { IconPlus } from "@tabler/icons-react";
import "../../styles/UserCSS/Filing.css";
import API from "../../api";
import { FilingContext } from "../../context/FilingContext";

const Filing = () => {
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);
  const [isApplyOvertimeOpen, setIsApplyOvertimeOpen] = useState(false);
  const [userOvertimeLists, setUserOvertimeLists] = useState([]);
  const {
    leaveRequests: userLeaveRequests,
    overtimeRequests: userOvertimeRequests,
    refreshFilingData,
  } = useContext(FilingContext);

  const handleApplyLeave = () => {
    setIsApplyLeaveOpen(true);
  };

  const handleApplyOvertime = async () => {
    await handleUserOvertimeLists();
    setIsApplyOvertimeOpen(true);
  };

  const handleUserLeaveRequests = async () => {
    await refreshFilingData();
  };

  const handleUserOvertimeRequests = async () => {
    await refreshFilingData();
  };

  const handleUserOvertimeLists = async () => {
    try {
      const response = await API.get("/api/filing/user-overtime-candidates");
      setUserOvertimeLists(response.data);
    } catch (error) {
      console.error("Error fetching overtime candidates:", error);
    }
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
                  <button className="action-button">Edit</button>
                  <button className="action-button">Delete</button>
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
                  <button className="action-button">Edit</button>
                  <button className="action-button">Delete</button>
                </article>
              </div>
            ))
          )}
        </div>
      </div>

      {isApplyLeaveOpen && (
        <ApplyLeaveModal
          onClose={() => setIsApplyLeaveOpen(false)}
          onUpdateLeaveLists={handleUserLeaveRequests}
        />
      )}

      {isApplyOvertimeOpen && (
        <ApplyOvertimeModal
          overtimeList={userOvertimeLists}
          onClose={() => {
            setIsApplyOvertimeOpen(false);
          }}
          onUpdateOvertimeRequests={handleUserOvertimeRequests}
        />
      )}
    </div>
  );
};

export default Filing;
