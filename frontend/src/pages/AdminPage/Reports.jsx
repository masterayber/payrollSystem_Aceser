import { useState, useEffect, useContext } from "react";
import XLSX from "xlsx-js-style";
import { EmployeeContext } from "../../context/EmployeeContext";
import { activeOnly, isPastLastWorkingDay } from "../../utils/employees";
import Dropdown from "../../components/Dropdown/Dropdown";
import "../../styles/AdminCSS/Reports.css";
import API from "../../api";

import {
  getMonthOptions,
  getDateRange,
  getFormattedDateRange,
} from "../../utils/reports/reportHelpers";
import { getCutoffOptions } from "../../utils/cutoff";
import { AttendanceSheet } from "../../utils/reports/attendanceSheet";
import { LeaveSheet } from "../../utils/reports/leave";
import { LateSheet } from "../../utils/reports/late";
import { RemarksSheet } from "../../utils/reports/remarks";

const Reports = () => {
  const { employeeData } = useContext(EmployeeContext);

  // Both lists start at the current period
  const cutoffOptions = getCutoffOptions();
  const monthOptions = getMonthOptions();

  const [reportType, setReportType] = useState("cutoff");
  const [selectedOption, setSelectedOption] = useState(cutoffOptions[0].value);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleReportTypeChange = (type) => {
    setReportType(type);
    setSelectedOption(
      type === "month" ? monthOptions[0].value : cutoffOptions[0].value,
    );
  };

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const response = await API.get("/api/attendance/attendance");
        setAttendanceRecords(response.data);
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

    const reportEmployees = employeeData.filter(
      (employee) => !isPastLastWorkingDay(employee, start),
    );

    const { ws1 } = AttendanceSheet({
      label,
      monthName,
      cutoff,
      startDate: new Date(start),
      endDate: new Date(end),
      employeeData: reportEmployees,
      attendanceRecords,
    });

    const { ws2 } = LeaveSheet({
      label,
      monthName,
      cutoff,
      startDate: new Date(start),
      endDate: new Date(end),
      employeeData: reportEmployees,
      attendanceRecords,
    });

    const { ws3 } = LateSheet({
      label,
      monthName,
      cutoff,
      startDate: new Date(start),
      endDate: new Date(end),
      employeeData: reportEmployees,
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
      <div className="data-card-container reports-summary-grid">
        <div className="data-card reports-metric-card">
          <div className="message-container">
            <div className="data-title">Employees</div>
            <span className="data-value">
              {activeOnly(employeeData).length}
            </span>
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

      <div className="data-card reports-export-card" aria-busy={loading}>
        <div className="user-track-title">
          <p>Attendance Reports</p>
        </div>

        <div className="user-track-description reports-description">
          <p>Export attendance for all employees.</p>
          <div className="reports-actions">
            <label className="reports-label">
              <p>Export Mode</p>
              <Dropdown
                options={[
                  { label: "Cut-off", value: "cutoff" },
                  { label: "Full Month", value: "month" },
                ]}
                placeholder="Select Export Mode"
                value={reportType}
                onSelect={handleReportTypeChange}
              />
            </label>
            {reportType === "cutoff" ? (
              <label className="reports-label">
                Cut-off Period
                <Dropdown
                  options={cutoffOptions}
                  placeholder="Select Cut-off Period"
                  value={selectedOption}
                  onSelect={setSelectedOption}
                />
              </label>
            ) : (
              <label className="reports-label">
                Select Month
                <Dropdown
                  options={monthOptions}
                  placeholder="Select Month"
                  value={selectedOption}
                  onSelect={setSelectedOption}
                />
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
    </div>
  );
};

export default Reports;
