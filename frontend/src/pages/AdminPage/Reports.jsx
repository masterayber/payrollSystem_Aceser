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

    const ws2 = RemarksSheet();

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      ws1,
      `${monthName} ${cutoff || "Report"} Cut-off`,
    );
    XLSX.utils.book_append_sheet(workbook, ws2, "Remarks");

    XLSX.writeFile(workbook, `Admin_Attendance_${label}.xlsx`);
  };

  const reportLabel = reportType === "month" ? "Full Month" : "Cut-off";

  return (
    <div className="main-content">
      <div className="data-card">
        <div className="user-track-title">
          <p>Attendance Reports</p>
        </div>

        <div className="user-track-description">
          <p>Export attendance for all employees.</p>
          <div className="reports-actions">
            <label className="reports-label">
              Export Mode
              <select
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
              className="btn"
              disabled={loading || employeeData.length === 0 || !selectedOption}
              onClick={handleDownload}
            >
              {loading ? "Preparing..." : `Download ${reportLabel} Attendance`}
            </button>
          </div>
        </div>
      </div>

      <div className="data-card-container">
        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Employees</div>
            <span className="data-value">{employeeData.length}</span>
          </div>
        </div>

        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Attendance Records</div>
            <span className="data-value">{attendanceRecords.length}</span>
          </div>
        </div>

        <div className="data-card">
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
