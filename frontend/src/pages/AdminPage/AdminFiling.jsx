import React from "react";

const AdminFiling = () => {
  return (
    <div className="main-content">
      <div className="data-card-container">
        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Total Leave Requests</div>
            <div className="data-value">10</div>
          </div>
        </div>

        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Total Overtime Requests</div>
            <div className="data-value">10</div>
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
              <p>Action</p>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminFiling;
