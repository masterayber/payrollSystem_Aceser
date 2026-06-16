import React, { useState, useContext } from "react";
import { UserContext } from "../../context/UserContext";
import "../../styles/UserCSS/Payslips.css";
import { IconEye, IconEyeClosed, IconDotsVertical } from "@tabler/icons-react";
import Dropdown from "../../components/Dropdown/Dropdown";
import ProfilePhoto from "../../components/ProfilePhoto/ProfilePhoto";

const Payslips = () => {
  const [showLastPayment, setShowLastPayment] = useState(false);
  const { userData } = useContext(UserContext);

  const fullName = `${userData?.employee?.firstName} ${userData?.employee?.lastName}`;

  return (
    <div className="main-content">
      <div className="data-card user-profile-container">
        <ProfilePhoto size="50px" />
        <div className="user-profile">
          <span>{fullName}</span>
          <p>12345678</p>
        </div>
      </div>

      <div className="data-card-container">
        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Next Pay Date</div>
            <div className="data-value">5 days</div>
          </div>
        </div>

        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Last Payment Amount</div>
            <div className="data-value">
              Php
              <span className="user-number-toggle">
                {showLastPayment ? "10,000.00" : "*****"}
              </span>
              <span className="icon-container">
                <button
                  className="toggle"
                  onClick={() => setShowLastPayment(!showLastPayment)}
                >
                  {showLastPayment ? (
                    <IconEye stroke={2} className="toggle-data" />
                  ) : (
                    <IconEyeClosed stroke={2} className="toggle-data" />
                  )}
                </button>
              </span>
            </div>
          </div>
        </div>

        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Payment Method</div>
            <div className="data-value">Unionbank</div>
          </div>
        </div>
      </div>

      <div className="data-card">
        <div className="user-track-title">
          <p>Government-Mandated Contribution</p>
        </div>
        <div className="table">
          <div className="table-header">
            {[
              { label: "Philhealth", amount: "00000" },
              { label: "SSS", amount: "00000" },
              { label: "Pag-ibig", amount: "00000" },
            ].map((item, index) => (
              <React.Fragment key={index}>
                <article className="pay-period-container">
                  <div className="pay-period-data">
                    <p>{item.label}</p>
                    <div>
                      <span>{item.amount}</span>
                    </div>
                  </div>
                </article>
                {index < 2 && <hr></hr>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="data-card">
        <div className="user-track-title">
          <p>Pay History</p>
          <div className="dots-button-container">
            <IconDotsVertical stroke={2} className="dots-button" />
          </div>
        </div>

        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Date</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Pay Period</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Gross Pay</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Deductions</p>
            </article>
            <hr className="header-hr"></hr>
            <article className="table-header-container">
              <p>Net Pay</p>
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

export default Payslips;
