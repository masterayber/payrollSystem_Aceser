import React, { useState, useEffect } from "react";
import "../Modal.css";
import ConfirmModal from "../Confirm/ConfirmModal";
import ConfirmedMessageModal from "../Confirmed/ConfirmedMessageModal";
import { format } from "date-fns";

const ApproveEmployeeModal = ({ onClose, onUpdateEmployee }) => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedMessageModalOpen, setIsConfirmedMessageModalOpen] =
    useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const fetchPendingUsers = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/auth/pending-users"
        );
        const data = await response.json();
        setPendingUsers(data);
      } catch (error) {
        console.error("Error fetching pending employees:", error);
      }
    };

    fetchPendingUsers();
  }, []);

  const handleApprove = async (userId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/auth/auths/${userId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "Active" }),
        }
      );

      if (response.ok) {
        setPendingUsers((prev) => prev.filter((user) => user._id !== userId));
        onUpdateEmployee();
        setIsConfirmModalOpen(false);

        setTimeout(() => setIsConfirmedMessageModalOpen(true), 300);
      } else {
        console.error("Failed to approve employee.");
      }
    } catch (error) {
      console.error("Error approving employee:", error);
    }
  };

  const handleConfirmApprove = (user) => {
    setSelectedUser(user);
    setIsConfirmModalOpen(true);
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Approve User</h3>
        <div className="table-modal">
          <div className="table-header">
            <article className="table-header-container">
              <p>First Name</p>
            </article>
            <article className="table-header-container">
              <p>Last Name</p>
            </article>
            <article className="table-header-container">
              <p>Email</p>
            </article>
            <article className="table-header-container">
              <p>Date Created</p>
            </article>
            <article className="table-header-container">
              <p>Action</p>
            </article>
          </div>

          {pendingUsers.length > 0 ? (
            pendingUsers.map((user) => (
              <div className="table-content" key={user._id}>
                <article className="table-content-container">
                  <p>{user.firstName}</p>
                </article>
                <article className="table-content-container">
                  <p>{user.lastName}</p>
                </article>
                <article className="table-content-container">
                  <p>{user.email}</p>
                </article>
                <article className="table-content-container">
                  <p>
                    {user.createdAt
                      ? format(new Date(user.createdAt), "MMM dd, yyyy hh:mm a")
                      : "N/A"}
                  </p>
                </article>
                <article className="table-content-container">
                  <button
                    className="approve-button"
                    onClick={() => handleConfirmApprove(user)}
                  >
                    Approve
                  </button>
                </article>
              </div>
            ))
          ) : (
            <p className="no-data">No pending users found.</p>
          )}
        </div>

        <div className="modal-buttons">
          <button onClick={onClose} className="modal-button">
            Close
          </button>
        </div>
      </div>
      {isConfirmModalOpen && selectedUser && (
        <ConfirmModal
          title="Confirm Approval"
          message={`Are you sure you want to approve ${selectedUser.firstName} ${selectedUser.lastName}?`}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={() => handleApprove(selectedUser._id)}
          confirmText="Approve"
        />
      )}

      {isConfirmedMessageModalOpen && (
        <ConfirmedMessageModal
          message={`Employee ${selectedUser?.firstName} ${selectedUser?.lastName} has been successfully approved!`}
          onClose={() => setIsConfirmedMessageModalOpen(false)}
        />
      )}
    </div>
  );
};

export default ApproveEmployeeModal;
