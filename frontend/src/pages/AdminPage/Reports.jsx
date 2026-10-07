import { useState, useEffect, useContext } from "react";
import XLSX from "xlsx-js-style";
import { EmployeeContext } from "../../context/EmployeeContext";
import "../../styles/AdminCSS/Reports.css";

import {
  formatMonthValue,
  getCutoffOptions,
  getMonthOptions,
  getDateRange,
  getFormattedDateRange,
} from "../../utils/reports/reportHelpers";
import { AttendanceSheet } from "../../utils/reports/attendanceSheet";
import { LeaveSheet } from "../../utils/reports/leave";
import { LateSheet } from "../../utils/reports/late";
import { RemarksSheet } from "../../utils/reports/remarks";

const Reports = () => {
  const { employeeData } = useContext(EmployeeContext);
  const [reportType, setReportType] = useState("cutoff");
  const [selectedOption, setSelectedOption] = useState("");
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const cutoffOptions = getCutoffOptions();
  const monthOptions = getMonthOptions();

  useEffect(() => {
    const today = new Date();
    const monthIndex = today.getMonth();
    const year = today.getFullYear();
    const day = today.getDate();
    const cutoff = day >= 26 ? "2nd" : "1st";

    if (reportType === "month") {
      setSelectedOption(formatMonthValue(year, monthIndex));
    } else {
      setSelectedOption(
        `${year}-${String(monthIndex + 1).padStart(2, "0")}-${cutoff}`,
      );
    }
  }, [reportType]);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          "http://localhost:5000/api/attendance/attendance",
        );
        const data = await response.json();
        setAttendanceRecords(data || []);
      } catch (error) {
        console.error("Error fetching attendance records:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, []);

  const handleDownload = () => {
    const { start, end, label, monthName, cutoff } = getDateRange(
      reportType,
      selectedOption,
    );

    const { ws1 } = AttendanceSheet({
      label,
      monthName,
      cutoff,
      startDate: new Date(start),
      endDate: new Date(end),
      employeeData,
      attendanceRecords,
    });

    const { ws2 } = LeaveSheet({
      label,
      monthName,
      cutoff,
      startDate: new Date(start),
      endDate: new Date(end),
      employeeData,
      attendanceRecords,
    });

    const { ws3 } = LateSheet({
      label,
      monthName,
      cutoff,
      startDate: new Date(start),
      endDate: new Date(end),
      employeeData,
      attendanceRecords,
    });

    const ws4 = RemarksSheet();
    const worksheetName =
      reportType === "month"
        ? `${monthName} Report Summary`
        : `${monthName} ${cutoff}-Cutoff Summary`;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws1, worksheetName);
    XLSX.utils.book_append_sheet(workbook, ws2, "LEAVE");
    XLSX.utils.book_append_sheet(workbook, ws3, "TARDINESS");
    XLSX.utils.book_append_sheet(workbook, ws4, "REMARKS");

    XLSX.writeFile(workbook, `Admin_Attendance_${label}.xlsx`);
  };

  const reportLabel = reportType === "month" ? "Full Month" : "Cut-off";

  return (
    <div className="main-content reports-page">
      <div className="data-card reports-export-card" aria-busy={loading}>
        <div className="user-track-title">
          <p>Attendance Reports</p>
        </div>

        <div className="user-track-description reports-description">
          <p>Export attendance for all employees.</p>
          <div className="reports-actions">
            <label className="reports-label">
              Export Mode
              <select
                className="reports-select"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option value="cutoff">Cut-off</option>
                <option value="month">Full Month</option>
              </select>
            </label>
            {reportType === "cutoff" ? (
              <label className="reports-label">
                Cut-off Period
                <select
                  className="reports-select"
                  value={selectedOption}
                  onChange={(e) => setSelectedOption(e.target.value)}
                >
                  {cutoffOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="reports-label">
                Select Month
                <select
                  className="reports-select"
                  value={selectedOption}
                  onChange={(e) => setSelectedOption(e.target.value)}
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              className="btn reports-download-button"
              disabled={loading || employeeData.length === 0 || !selectedOption}
              onClick={handleDownload}
            >
              {loading ? "Preparing..." : `Download ${reportLabel} Attendance`}
            </button>
          </div>
        </div>
      </div>

      <div className="data-card-container reports-summary-grid">
        <div className="data-card reports-metric-card">
          <div className="message-container">
            <div className="data-title">Employees</div>
            <span className="data-value">{employeeData.length}</span>
          </div>
        </div>

        <div className="data-card reports-metric-card">
          <div className="message-container">
            <div className="data-title">Attendance Records</div>
            <span className="data-value">{attendanceRecords.length}</span>
          </div>
        </div>

        <div className="data-card reports-metric-card reports-range-card">
          <div className="message-container">
            <div className="data-title">Export Range</div>
            <span className="data-value">
              {getFormattedDateRange(reportType, selectedOption)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
