import { useState, useContext, useEffect, useRef } from "react";
import XLSX from "xlsx-js-style";
import { UserContext } from "../../context/UserContext";
import { formatFullMonthDate, formatTime } from "../../utils/dateFormatter";
import "../../styles/UserCSS/Attendance.css";
import Dropdown from "../../components/Dropdown/Dropdown";
import Pagination from "../../components/Pagination/Pagination";
import { IconDotsVertical } from "@tabler/icons-react";
import {
  getCutoffOptions,
  getCutoffRange,
  parseCutoffValue,
} from "../../utils/cutoff";
import { hireDateKey } from "../../utils/employees";
import {
  buildOwnAttendanceWorkbook,
  ownCutoffDays,
} from "../../utils/reports/ownAttendance";

const Attendance = () => {
  const { userData } = useContext(UserContext);

  // The start date in the job description (the account's createdAt when there is none)
  const hireKey = hireDateKey(userData);

  // The current cut-off first, back to the start date or one year (24 cut-offs)
  const cutoffOptions = getCutoffOptions({
    count: 24,
    since: hireKey || undefined,
  });

  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [selectedCutoff, setSelectedCutoff] = useState(cutoffOptions[0].value);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  const userAttendance = userData?.attendance || [];

  const downloadDropdownRef = useRef(null);
  const downloadSvgRef = useRef(null);

  const toggleDownloadDropdown = (event) => {
    event.stopPropagation();
    setShowDownloadDropdown((prev) => !prev);
  };

  const selected = parseCutoffValue(selectedCutoff);
  const selectedRange = getCutoffRange(selected);

  // Newest first; later days without a record are left out (the Download keeps them blank)
  const filteredAttendance = ownCutoffDays(userAttendance, selectedRange, {
    hireKey,
  })
    .filter((day) => !day.upcoming)
    .reverse();

  const totalPages = Math.ceil(filteredAttendance.length / itemsPerPage);

  const calculateMetrics = () => {
    let totalHours = 0;
    let totalOvertimeHours = 0;
    let totalOnTime = 0;
    let totalAbsences = 0;

    filteredAttendance.forEach((att) => {
      if (
        att.timeIn &&
        att.timeOut &&
        att.timeIn !== "--:--" &&
        att.timeOut !== "--:--"
      ) {
        const [inHour, inMin] = att.timeIn.split(":").map(Number);
        const [outHour, outMin] = att.timeOut.split(":").map(Number);
        const workedMinutes = outHour * 60 + outMin - (inHour * 60 + inMin);
        totalHours += workedMinutes / 60;
      }
      if (att.overtime?.isEligible && att.overtime?.hours)
        totalOvertimeHours += att.overtime.hours;
      if (att.behavior === "On-Time") totalOnTime++;
      if (att.behavior === "Absent") totalAbsences++;
    });

    return {
      totalHours: totalHours.toFixed(2),
      totalOvertimeHours: totalOvertimeHours.toFixed(2),
      totalOnTime,
      totalAbsences,
    };
  };

  const metrics = calculateMetrics();

  const handleDownload = () => {
    const { workbook, fileName } = buildOwnAttendanceWorkbook({
      userData,
      cutoff: selected,
    });
    XLSX.writeFile(workbook, fileName);
    setShowDownloadDropdown(false);
  };

  const handleMonthChange = (option) => {
    setSelectedCutoff(option);
    setCurrentPage(1);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showDownloadDropdown &&
        downloadDropdownRef.current &&
        !downloadDropdownRef.current.contains(event.target) &&
        downloadSvgRef.current &&
        !downloadSvgRef.current.contains(event.target)
      ) {
        setShowDownloadDropdown(false);
      }
    };

    if (showDownloadDropdown) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showDownloadDropdown]);

  return (
    <div className="main-content employee-attendance-page">
      <div className="data-card-container employee-attendance-summary">
        <div className="data-card attendance-metric-card">
          <div className="message-container">
            <div className="data-title">Total Hours Worked</div>
            <div className="data-value">{metrics.totalHours}</div>
          </div>
        </div>

        <div className="data-card attendance-metric-card">
          <div className="message-container">
            <div className="data-title">Total Overtime Hours</div>
            <div className="data-value">{metrics.totalOvertimeHours}</div>
          </div>
        </div>

        <div className="data-card attendance-metric-card">
          <div className="message-container">
            <div className="data-title">Total On-Time</div>
            <div className="data-value">{metrics.totalOnTime}</div>
          </div>
        </div>

        <div className="data-card attendance-metric-card">
          <div className="message-container">
            <div className="data-title">Total Absences</div>
            <div className="data-value">{metrics.totalAbsences}</div>
          </div>
        </div>
      </div>

      <div className="attendance-period-control">
        <Dropdown
          options={cutoffOptions}
          value={selectedCutoff}
          placeholder="Select Cut-off period"
          onSelect={handleMonthChange}
        />
      </div>

      <div className="table-container employee-attendance-log">
        <div className="table-title">
          <p>Daily Attendance Log</p>

          <div className="dots-button-container">
            <button
              type="button"
              aria-label="Attendance log options"
              aria-expanded={showDownloadDropdown}
              onClick={toggleDownloadDropdown}
              ref={downloadSvgRef}
              className="dots-button attendance-download-button"
            >
              <IconDotsVertical stroke={2} />
            </button>
            {showDownloadDropdown && (
              <div className="dropdown-details" ref={downloadDropdownRef}>
                <button
                  className="dropdown-item-details"
                  onClick={handleDownload}
                >
                  Download
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="table attendance-record-table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Date</p>
            </article>
            <article className="table-header-container">
              <p>Time IN</p>
            </article>
            <article className="table-header-container">
              <p>Time OUT</p>
            </article>
            <article className="table-header-container">
              <p>Overtime</p>
            </article>
            <article className="table-header-container">
              <p>Behavior</p>
            </article>
          </div>
          {filteredAttendance.length === 0 ? (
            <div className="table-content">
              <article className="table-content-container">
                <h6 className="no-data">No attendance available</h6>
              </article>
            </div>
          ) : (
            filteredAttendance
              .slice(
                (currentPage - 1) * itemsPerPage,
                currentPage * itemsPerPage,
              )
              .map((att) => (
                <div key={att._id} className="table-content">
                  <article className="table-content-container">
                    <p>{formatFullMonthDate(att.date)}</p>
                  </article>
                  <article className="table-content-container">
                    <p>{formatTime(att.timeIn)}</p>
                  </article>
                  <article className="table-content-container">
                    <p>{formatTime(att.timeOut)}</p>
                  </article>
                  <article className="table-content-container">
                    <p>
                      {att.overtime?.isEligible
                        ? `${att.overtime.hours.toFixed(2)} hrs`
                        : "-"}
                    </p>
                  </article>
                  <article className="table-content-container">
                    <p>
                      <span
                        className="attendance-behavior"
                        data-behavior={att.behavior}
                      >
                        {att.behavior}
                      </span>
                    </p>
                  </article>
                </div>
              ))
          )}
        </div>
        {filteredAttendance.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  );
};

export default Attendance;
