import React, { useEffect, useRef, useState } from "react";
import { IconDotsVertical, IconEye, IconEyeClosed } from "@tabler/icons-react";
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

  // const toggleYearToDateDropdown = (event) => {
  //   event.stopPropagation();
  //   setShowYearToDateDropdown((prev) => !prev);
  //   setShowPayPeriodDropdown(false);
  //   setShowTaxInformationDropdown(false);
  //   setShowPayHistoryDropdown(false);
  // };

  // const toggleTaxInformationDropdown = (event) => {
  //   event.stopPropagation();
  //   setShowTaxInformationDropdown((prev) => !prev);
  //   setShowPayPeriodDropdown(false);
  //   setShowYearToDateDropdown(false);
  //   setShowPayHistoryDropdown(false);
  // };

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
    <div className="main-content employee-payroll-page">
      <div className="data-card-container payroll-summary-grid">
        <div className="data-card finance-metric-card">
          <div className="message-container">
            <div className="data-title">Next Pay Date</div>
            <div className="data-value">5 days</div>
          </div>
        </div>

        <div className="data-card finance-metric-card">
          <div className="message-container">
            <div className="data-title">Last Payment Amount</div>
            <div className="data-value">
              Php
              <span className="user-number-toggle">
                {showLastPayment ? "10,000.00" : "*****"}
              </span>
              <span className="icon-container">
                <button
                  type="button"
                  className="toggle"
                  onClick={() => setShowLastPayment(!showLastPayment)}
                  aria-label={
                    showLastPayment
                      ? "Hide last payment amount"
                      : "Show last payment amount"
                  }
                  aria-pressed={showLastPayment}
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

        <div className="data-card finance-metric-card">
          <div className="message-container">
            <div className="data-title">Year-to-Date Earnings</div>
            <div className="data-value">
              Php
              <span className="user-number-toggle">
                {showYearToDate ? "100,000.00" : "****"}
              </span>
              <span className="icon-container">
                <button
                  type="button"
                  className="toggle"
                  onClick={() => setShowYearToDate(!showYearToDate)}
                  aria-label={
                    showYearToDate
                      ? "Hide year-to-date earnings"
                      : "Show year-to-date earnings"
                  }
                  aria-pressed={showYearToDate}
                >
                  {showYearToDate ? (
                    <IconEye stroke={2} className="toggle" />
                  ) : (
                    <IconEyeClosed stroke={2} className="toggle" />
                  )}
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="data-card employee-pay-period-card">
        <div className="user-track-title">
          <p>Pay Period Summary</p>
          <div className="dots-button-container">
            <button
              type="button"
              aria-label="Pay period summary options"
              aria-expanded={showPayPeriodDropdown}
              onClick={togglePayPeriodDropdown}
              ref={payPeriodSvgRef}
              className="dots-button finance-menu-button"
            >
              <IconDotsVertical stroke={2} />
            </button>
            {showPayPeriodDropdown && (
              <div className="dropdown-details" ref={payPeriodDropdownRef}>
                <button
                  className="dropdown-item-details"
                  onClick={() => navigate("/")}
                >
                  View Details
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="table payroll-period-summary">
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
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* <div className="user-track-container">
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
      </div> */}

      <div className="data-card employee-pay-history-card">
        <div className="user-track-title">
          <p>Pay History</p>
          <div className="dots-button-container">
            <button
              type="button"
              aria-label="Pay history options"
              aria-expanded={showPayHistoryDropdown}
              onClick={togglePayHistoryDropdown}
              ref={payHistorySvgRef}
              className="dots-button finance-menu-button"
            >
              <IconDotsVertical stroke={2} />
            </button>
            {showPayHistoryDropdown && (
              <div className="dropdown-details" ref={payHistoryDropdownRef}>
                <button
                  className="dropdown-item-details"
                  onClick={() => navigate("/")}
                >
                  View Details
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="table payroll-history-table">
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
          <p className="finance-empty-state">No pay history available yet.</p>
        </div>
      </div>
    </div>
  );
};

export default Payroll;
