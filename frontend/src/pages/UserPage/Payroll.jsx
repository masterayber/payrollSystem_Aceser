import React, { useEffect, useRef, useState } from "react";
import { IconDotsVertical } from "@tabler/icons-react";
import "../../styles/UserCSS/Payroll.css";
import { useNavigate } from "react-router-dom";

const Payroll = () => {
  const navigate = useNavigate();

  const [showLastPayment, setShowLastPayment] = useState(false);
  const [showYearToDate, setShowYearToDate] = useState(false);

  const [showPayPeriodDropdown, setShowPayPeriodDropdown] = useState(false);
  const [showYearToDateDropdown, setShowYearToDateDropdown] = useState(false);
  const [showTaxInformationDropdown, setShowTaxInformationDropdown] =
    useState(false);
  const [showPayHistoryDropdown, setShowPayHistoryDropdown] = useState(false);

  const payPeriodDropdownRef = useRef(null);
  const payPeriodSvgRef = useRef(null);

  const yearToDateDropdownRef = useRef(null);
  const yearToDateSvgRef = useRef(null);

  const taxInformationDropdownRef = useRef(null);
  const taxInformationSvgRef = useRef(null);

  const payHistoryDropdownRef = useRef(null);
  const payHistorySvgRef = useRef(null);

  const togglePayPeriodDropdown = (event) => {
    event.stopPropagation();
    setShowPayPeriodDropdown((prev) => !prev);
    setShowYearToDateDropdown(false);
    setShowTaxInformationDropdown(false);
    setShowPayHistoryDropdown(false);
  };

  const toggleYearToDateDropdown = (event) => {
    event.stopPropagation();
    setShowYearToDateDropdown((prev) => !prev);
    setShowPayPeriodDropdown(false);
    setShowTaxInformationDropdown(false);
    setShowPayHistoryDropdown(false);
  };

  const toggleTaxInformationDropdown = (event) => {
    event.stopPropagation();
    setShowTaxInformationDropdown((prev) => !prev);
    setShowPayPeriodDropdown(false);
    setShowYearToDateDropdown(false);
    setShowPayHistoryDropdown(false);
  };

  const togglePayHistoryDropdown = (event) => {
    event.stopPropagation();
    setShowPayHistoryDropdown((prev) => !prev);
    setShowPayPeriodDropdown(false);
    setShowYearToDateDropdown(false);
    setShowTaxInformationDropdown(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showPayPeriodDropdown &&
        payPeriodDropdownRef.current &&
        !payPeriodDropdownRef.current.contains(event.target) &&
        payPeriodSvgRef.current &&
        !payPeriodSvgRef.current.contains(event.target)
      ) {
        setShowPayPeriodDropdown(false);
      }

      if (
        showYearToDateDropdown &&
        yearToDateDropdownRef.current &&
        !yearToDateDropdownRef.current.contains(event.target) &&
        yearToDateSvgRef.current &&
        !yearToDateSvgRef.current.contains(event.target)
      ) {
        setShowYearToDateDropdown(false);
      }

      if (
        showTaxInformationDropdown &&
        taxInformationDropdownRef.current &&
        !taxInformationDropdownRef.current.contains(event.target) &&
        taxInformationSvgRef.current &&
        !taxInformationSvgRef.current.contains(event.target)
      ) {
        setShowTaxInformationDropdown(false);
      }

      if (
        showPayHistoryDropdown &&
        payHistoryDropdownRef.current &&
        !payHistoryDropdownRef.current.contains(event.target) &&
        payHistorySvgRef.current &&
        !payHistorySvgRef.current.contains(event.target)
      ) {
        setShowPayHistoryDropdown(false);
      }
    };

    if (
      showPayPeriodDropdown ||
      showYearToDateDropdown ||
      showTaxInformationDropdown ||
      showPayHistoryDropdown
    ) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [
    showPayPeriodDropdown,
    showYearToDateDropdown,
    showTaxInformationDropdown,
    showPayHistoryDropdown,
  ]);

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
          <div className="dots-button-container">
            <IconDotsVertical
              stroke={2}
              onClick={togglePayPeriodDropdown}
              ref={payPeriodSvgRef}
              className="dots-button"
            />
            {showPayPeriodDropdown && (
              <div className="dropdown-details" ref={payPeriodDropdownRef}>
                <button
                  className="dropdown-item-details"
                  onClick={() => navigate("/")}
                >
                  View details
                </button>
              </div>
            )}
          </div>
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
            <div className="dots-button-container">
              <IconDotsVertical
                stroke={2}
                onClick={toggleYearToDateDropdown}
                ref={yearToDateSvgRef}
                className="dots-button"
              />
              {showYearToDateDropdown && (
                <div className="dropdown-details" ref={yearToDateDropdownRef}>
                  <button
                    className="dropdown-item-details"
                    onClick={() => navigate("/")}
                  >
                    View details
                  </button>
                </div>
              )}
            </div>
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
            <div className="dots-button-container ">
              <IconDotsVertical
                stroke={2}
                onClick={toggleTaxInformationDropdown}
                ref={taxInformationSvgRef}
                className="dots-button"
              />
              {showTaxInformationDropdown && (
                <div
                  className="dropdown-details"
                  ref={taxInformationDropdownRef}
                >
                  <button
                    className="dropdown-item-details"
                    onClick={() => navigate("/")}
                  >
                    View details
                  </button>
                </div>
              )}
            </div>
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
          <div className="dots-button-container ">
            <IconDotsVertical
              stroke={2}
              onClick={togglePayHistoryDropdown}
              ref={payHistorySvgRef}
              className="dots-button"
            />
            {showPayHistoryDropdown && (
              <div className="dropdown-details" ref={payHistoryDropdownRef}>
                <button
                  className="dropdown-item-details"
                  onClick={() => navigate("/")}
                >
                  View details
                </button>
              </div>
            )}
          </div>
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
