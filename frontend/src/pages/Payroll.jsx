import React, { useState } from "react";
import "../styles/Payroll.css";

const Payroll = () => {
  const [showLastPayment, setShowLastPayment] = useState(false);
  const [showYearToDate, setShowYearToDate] = useState(false);

  return (
    <div className="main-content">
      <div className="user-track-container">
        <div className="user-track">
          <p>Next Pay Date</p>
          <div className="total-user-track">
            <span className="user-number">5</span>
            <span className="user-text">days</span>
          </div>
        </div>

        <div className="user-track">
          <p>Last Payment Amount</p>
          <div className="total-user-track">
            <span className="user-text">Php</span>
            <span className="user-number-toggle">
              {showLastPayment ? "10,000.00" : "****"}
            </span>
            <span className="icon-container">
              <button
                type="button"
                className="toggle-salary"
                onClick={() => setShowLastPayment(!showLastPayment)}
              >
                {showLastPayment ? (
                  // Open Eye Icon
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="toggle-data"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
                    <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
                  </svg>
                ) : (
                  // Closed Eye Icon
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="toggle-data"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
                    <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
                    <path d="M3 3l18 18" />
                  </svg>
                )}
              </button>
            </span>
          </div>
        </div>

        <div className="user-track">
          <p>Year-to-Date Earnings</p>
          <div className="total-user-track">
            <span className="user-text">Php</span>
            <span className="user-number-toggle">
              {showYearToDate ? "100,000.00" : "****"}
            </span>
            <span className="icon-container">
              <button
                type="button"
                className="toggle-salary"
                onClick={() => setShowYearToDate(!showYearToDate)}
              >
                {showYearToDate ? (
                  // Open Eye Icon
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="toggle-data"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
                    <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
                  </svg>
                ) : (
                  // Closed Eye Icon
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="toggle-data"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
                    <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
                    <path d="M3 3l18 18" />
                  </svg>
                )}
              </button>
            </span>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-title">
          <p>Pay Period Summary</p>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10.7998 18.3C10.7998 17.9022 10.9578 17.5206 11.2391 17.2393C11.5204 16.958 11.902 16.8 12.2998 16.8C12.6976 16.8 13.0792 16.958 13.3605 17.2393C13.6418 17.5206 13.7998 17.9022 13.7998 18.3C13.7998 18.6978 13.6418 19.0794 13.3605 19.3607C13.0792 19.642 12.6976 19.8 12.2998 19.8C11.902 19.8 11.5204 19.642 11.2391 19.3607C10.9578 19.0794 10.7998 18.6978 10.7998 18.3ZM10.7998 12.3C10.7998 11.9022 10.9578 11.5206 11.2391 11.2393C11.5204 10.958 11.902 10.8 12.2998 10.8C12.6976 10.8 13.0792 10.958 13.3605 11.2393C13.6418 11.5206 13.7998 11.9022 13.7998 12.3C13.7998 12.6978 13.6418 13.0794 13.3605 13.3607C13.0792 13.642 12.6976 13.8 12.2998 13.8C11.902 13.8 11.5204 13.642 11.2391 13.3607C10.9578 13.0794 10.7998 12.6978 10.7998 12.3ZM10.7998 6.3C10.7998 5.90218 10.9578 5.52065 11.2391 5.23934C11.5204 4.95804 11.902 4.8 12.2998 4.8C12.6976 4.8 13.0792 4.95804 13.3605 5.23934C13.6418 5.52065 13.7998 5.90218 13.7998 6.3C13.7998 6.69783 13.6418 7.07936 13.3605 7.36066C13.0792 7.64197 12.6976 7.8 12.2998 7.8C11.902 7.8 11.5204 7.64197 11.2391 7.36066C10.9578 7.07936 10.7998 6.69783 10.7998 6.3Z"
              fill="#0A0A0A"
            />
          </svg>
        </div>
        <div className="table">
          <div className="table-header">
            {[
              { label: "Gross Pay", amount: "00000" },
              { label: "Deductions", amount: "00000" },
              { label: "Net Pay", amount: "00000" },
              { label: "Taxes", amount: "00000" },
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
                {index < 3 && <hr></hr>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="user-track-container">
        <div className="user-track">
          <div className="table-title">
            <p>Year-to-Date Earnings</p>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10.7998 18.3C10.7998 17.9022 10.9578 17.5206 11.2391 17.2393C11.5204 16.958 11.902 16.8 12.2998 16.8C12.6976 16.8 13.0792 16.958 13.3605 17.2393C13.6418 17.5206 13.7998 17.9022 13.7998 18.3C13.7998 18.6978 13.6418 19.0794 13.3605 19.3607C13.0792 19.642 12.6976 19.8 12.2998 19.8C11.902 19.8 11.5204 19.642 11.2391 19.3607C10.9578 19.0794 10.7998 18.6978 10.7998 18.3ZM10.7998 12.3C10.7998 11.9022 10.9578 11.5206 11.2391 11.2393C11.5204 10.958 11.902 10.8 12.2998 10.8C12.6976 10.8 13.0792 10.958 13.3605 11.2393C13.6418 11.5206 13.7998 11.9022 13.7998 12.3C13.7998 12.6978 13.6418 13.0794 13.3605 13.3607C13.0792 13.642 12.6976 13.8 12.2998 13.8C11.902 13.8 11.5204 13.642 11.2391 13.3607C10.9578 13.0794 10.7998 12.6978 10.7998 12.3ZM10.7998 6.3C10.7998 5.90218 10.9578 5.52065 11.2391 5.23934C11.5204 4.95804 11.902 4.8 12.2998 4.8C12.6976 4.8 13.0792 4.95804 13.3605 5.23934C13.6418 5.52065 13.7998 5.90218 13.7998 6.3C13.7998 6.69783 13.6418 7.07936 13.3605 7.36066C13.0792 7.64197 12.6976 7.8 12.2998 7.8C11.902 7.8 11.5204 7.64197 11.2391 7.36066C10.9578 7.07936 10.7998 6.69783 10.7998 6.3Z"
                fill="#0A0A0A"
              />
            </svg>
          </div>
          <div className="table">
            <div className="table-header">
              {[
                { label: "Earnings", amount: "00000" },
                { label: "Deductions", amount: "00000" },
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
                  {index < 1 && <hr></hr>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="user-track">
          <div className="table-title">
            <p>Tax Information</p>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10.7998 18.3C10.7998 17.9022 10.9578 17.5206 11.2391 17.2393C11.5204 16.958 11.902 16.8 12.2998 16.8C12.6976 16.8 13.0792 16.958 13.3605 17.2393C13.6418 17.5206 13.7998 17.9022 13.7998 18.3C13.7998 18.6978 13.6418 19.0794 13.3605 19.3607C13.0792 19.642 12.6976 19.8 12.2998 19.8C11.902 19.8 11.5204 19.642 11.2391 19.3607C10.9578 19.0794 10.7998 18.6978 10.7998 18.3ZM10.7998 12.3C10.7998 11.9022 10.9578 11.5206 11.2391 11.2393C11.5204 10.958 11.902 10.8 12.2998 10.8C12.6976 10.8 13.0792 10.958 13.3605 11.2393C13.6418 11.5206 13.7998 11.9022 13.7998 12.3C13.7998 12.6978 13.6418 13.0794 13.3605 13.3607C13.0792 13.642 12.6976 13.8 12.2998 13.8C11.902 13.8 11.5204 13.642 11.2391 13.3607C10.9578 13.0794 10.7998 12.6978 10.7998 12.3ZM10.7998 6.3C10.7998 5.90218 10.9578 5.52065 11.2391 5.23934C11.5204 4.95804 11.902 4.8 12.2998 4.8C12.6976 4.8 13.0792 4.95804 13.3605 5.23934C13.6418 5.52065 13.7998 5.90218 13.7998 6.3C13.7998 6.69783 13.6418 7.07936 13.3605 7.36066C13.0792 7.64197 12.6976 7.8 12.2998 7.8C11.902 7.8 11.5204 7.64197 11.2391 7.36066C10.9578 7.07936 10.7998 6.69783 10.7998 6.3Z"
                fill="#0A0A0A"
              />
            </svg>
          </div>
          <div className="table">
            <div className="table-header">
              {[
                { label: "Tax Withhold", amount: "00000" },
                { label: "Total Tax Withheld YTD", amount: "00000" },
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
                  {index < 1 && <hr></hr>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="table-container">
        <div className="table-title">
          <p>Pay History</p>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10.7998 18.3C10.7998 17.9022 10.9578 17.5206 11.2391 17.2393C11.5204 16.958 11.902 16.8 12.2998 16.8C12.6976 16.8 13.0792 16.958 13.3605 17.2393C13.6418 17.5206 13.7998 17.9022 13.7998 18.3C13.7998 18.6978 13.6418 19.0794 13.3605 19.3607C13.0792 19.642 12.6976 19.8 12.2998 19.8C11.902 19.8 11.5204 19.642 11.2391 19.3607C10.9578 19.0794 10.7998 18.6978 10.7998 18.3ZM10.7998 12.3C10.7998 11.9022 10.9578 11.5206 11.2391 11.2393C11.5204 10.958 11.902 10.8 12.2998 10.8C12.6976 10.8 13.0792 10.958 13.3605 11.2393C13.6418 11.5206 13.7998 11.9022 13.7998 12.3C13.7998 12.6978 13.6418 13.0794 13.3605 13.3607C13.0792 13.642 12.6976 13.8 12.2998 13.8C11.902 13.8 11.5204 13.642 11.2391 13.3607C10.9578 13.0794 10.7998 12.6978 10.7998 12.3ZM10.7998 6.3C10.7998 5.90218 10.9578 5.52065 11.2391 5.23934C11.5204 4.95804 11.902 4.8 12.2998 4.8C12.6976 4.8 13.0792 4.95804 13.3605 5.23934C13.6418 5.52065 13.7998 5.90218 13.7998 6.3C13.7998 6.69783 13.6418 7.07936 13.3605 7.36066C13.0792 7.64197 12.6976 7.8 12.2998 7.8C11.902 7.8 11.5204 7.64197 11.2391 7.36066C10.9578 7.07936 10.7998 6.69783 10.7998 6.3Z"
              fill="#0A0A0A"
            />
          </svg>
        </div>
        <div className="table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Date</p>
            </article>
            <article className="table-header-container">
              <p>Pay Period</p>
            </article>
            <article className="table-header-container">
              <p>Gross Pay</p>
            </article>
            <article className="table-header-container">
              <p>Deductions</p>
            </article>
            <article className="table-header-container">
              <p>Net Pay</p>
            </article>
            <article className="table-header-container">
              <p>Action</p>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>01/13/25</p>
            </article>
            <article className="table-content-container">
              <p>Dec 26 - Jan 10</p>
            </article>
            <article className="table-content-container">
              <p>10000</p>
            </article>
            <article className="table-content-container">
              <p>1000</p>
            </article>
            <article className="table-content-container">
              <p>9000</p>
            </article>
            <article className="table-content-container">
              <button className="action-button">View</button>
              <button className="action-button">Download</button>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>01/30/25</p>
            </article>
            <article className="table-content-container">
              <p>Jan 11 - Jan 25</p>
            </article>
            <article className="table-content-container">
              <p>10000</p>
            </article>
            <article className="table-content-container">
              <p>1000</p>
            </article>
            <article className="table-content-container">
              <p>9000</p>
            </article>
            <article className="table-content-container">
              <button className="action-button">View</button>
              <button className="action-button">Download</button>
            </article>
          </div>
          <div className="table-content">
            <article className="table-content-container">
              <p>02/13/25</p>
            </article>
            <article className="table-content-container">
              <p>Jan 26 - Feb 10</p>
            </article>
            <article className="table-content-container">
              <p>10000</p>
            </article>
            <article className="table-content-container">
              <p>1000</p>
            </article>
            <article className="table-content-container">
              <p>9000</p>
            </article>
            <article className="table-content-container">
              <button className="action-button">View</button>
              <button className="action-button">Download</button>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payroll;
