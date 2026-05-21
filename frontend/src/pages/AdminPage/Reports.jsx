import { useState, useEffect, useContext } from "react";
import XLSX from "xlsx-js-style";
import { EmployeeContext } from "../../context/EmployeeContext";
import "../../styles/AdminCSS/Reports.css";

const Reports = () => {
  const { employeeData } = useContext(EmployeeContext);
  const [reportType, setReportType] = useState("cutoff");
  const [selectedOption, setSelectedOption] = useState("");
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const formatMonthValue = (year, monthIndex) =>
    `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  const getCutoffOptions = () => {
    const options = [];
    const today = new Date();
    const day = today.getDate();
    let monthIndex = today.getMonth();
    let year = today.getFullYear();
    const currentCutoff = day <= 10 || day >= 26 ? "1st" : "2nd";

    if (currentCutoff === "2nd") {
      options.push({
        label: `${months[monthIndex]} ${year} 2nd Cutoff`,
        value: `${year}-${String(monthIndex + 1).padStart(2, "0")}-2nd`,
      });
      options.push({
        label: `${months[monthIndex]} ${year} 1st Cutoff`,
        value: `${year}-${String(monthIndex + 1).padStart(2, "0")}-1st`,
      });
    } else {
      options.push({
        label: `${months[monthIndex]} ${year} 1st Cutoff`,
        value: `${year}-${String(monthIndex + 1).padStart(2, "0")}-1st`,
      });
      monthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
      if (monthIndex === 11) year -= 1;
      options.push({
        label: `${months[monthIndex]} ${year} 2nd Cutoff`,
        value: `${year}-${String(monthIndex + 1).padStart(2, "0")}-2nd`,
      });
    }

    while (options.length < 6) {
      monthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
      if (monthIndex === 11) year -= 1;
      options.push({
        label: `${months[monthIndex]} ${year} 2nd Cutoff`,
        value: `${year}-${String(monthIndex + 1).padStart(2, "0")}-2nd`,
      });
      options.push({
        label: `${months[monthIndex]} ${year} 1st Cutoff`,
        value: `${year}-${String(monthIndex + 1).padStart(2, "0")}-1st`,
      });
    }

    return options.slice(0, 6);
  };

  const getMonthOptions = () => {
    const options = [];
    const today = new Date();
    let monthIndex = today.getMonth();
    let year = today.getFullYear();

    for (let i = 0; i < 6; i += 1) {
      options.push({
        label: `${months[monthIndex]} ${year}`,
        value: formatMonthValue(year, monthIndex),
      });
      monthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
      if (monthIndex === 11) year -= 1;
    }

    return options;
  };

  const cutoffOptions = getCutoffOptions();
  const monthOptions = getMonthOptions();

  useEffect(() => {
    const today = new Date();
    const monthIndex = today.getMonth();
    const year = today.getFullYear();
    const day = today.getDate();
    const cutoff = day <= 10 || day >= 26 ? "1st" : "2nd";

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

  const formatKey = (date) => {
    if (typeof date === "string") return date.split("T")[0];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getDateRange = () => {
    if (!selectedOption) {
      return { start: "", end: "", label: "" };
    }

    const [yearStr, monthStr, cutoff] = selectedOption.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const monthName = months[monthIndex];

    if (reportType === "month") {
      const start = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
      const end = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(
        new Date(year, monthIndex + 1, 0).getDate(),
      ).padStart(2, "0")}`;
      return { start, end, label: `${monthName} ${year}`, monthName };
    }

    if (cutoff === "2nd") {
      const start = `${year}-${String(monthIndex + 1).padStart(2, "0")}-11`;
      const end = `${year}-${String(monthIndex + 1).padStart(2, "0")}-25`;
      return {
        start,
        end,
        label: `${monthName} ${year} 2nd Cutoff`,
        monthName,
        cutoff,
      };
    }

    const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1;
    const prevYear = monthIndex === 0 ? year - 1 : year;
    const prevDays = new Date(prevYear, prevMonth + 1, 0).getDate();
    const startDay = Math.min(26, prevDays);
    const start = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
    const end = `${year}-${String(monthIndex + 1).padStart(2, "0")}-10`;
    return {
      start,
      end,
      label: `${monthName} ${year} 1stCutoff`,
      monthName,
      cutoff,
    };
  };

  const handleDownload = () => {
    const { start, end, label, monthName, cutoff } = getDateRange();
    const startDate = new Date(start);
    const endDate = new Date(end);
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

    const thinBorder = { style: "thin", color: { rgb: "000000" } };
    const allBorders = {
      top: thinBorder,
      bottom: thinBorder,
      left: thinBorder,
      right: thinBorder,
    };
    const topBottomBorder = { top: thinBorder, bottom: thinBorder };
    const thickBorder = { style: "medium", color: { rgb: "000000" } };
    const thickAllBorders = {
      top: thickBorder,
      bottom: thickBorder,
      left: thickBorder,
      right: thickBorder,
    };

    const blueFill = { patternType: "solid", fgColor: { rgb: "BDD7EE" } };
    const yellowFill = { patternType: "solid", fgColor: { rgb: "FF3699" } };
    const greenFill = { patternType: "solid", fgColor: { rgb: "70AD47" } };
    const redFill = { patternType: "solid", fgColor: { rgb: "FF0000" } };
    const grayFill = { patternType: "solid", fgColor: { rgb: "808080" } };

    const centerAlign = { horizontal: "center", vertical: "center" };

    const setCell = (ws, r, c, value, type, style) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      ws[addr] = { v: value, t: type, s: style };
    };

    const getDayFill = (d) => {
      const day = d.getDay();
      if (day === 0) return redFill;
      if (day === 6) return grayFill;
      return null;
    };

    const ws2 = {};
    for (let c = 0; c < 4; c++) setCell(ws2, 0, c, "", "s", {});

    const refHeaderStyle = {
      font: { bold: true, sz: 12, color: { rgb: "000000" } },
      fill: { patternType: "solid", fgColor: { rgb: "FFE699" } },
      border: allBorders,
      alignment: centerAlign,
    };
    setCell(ws2, 1, 0, "REMARKS", "s", refHeaderStyle);
    setCell(ws2, 1, 1, "", "s", {});
    setCell(ws2, 1, 2, "DAY", "s", refHeaderStyle);

    const remarksList = ["REG", "HOL", ""];
    const remarkStyles = [
      {
        font: { sz: 12, color: { rgb: "000000" } },
        fill: blueFill,
        border: allBorders,
        alignment: centerAlign,
      },
      {
        font: { sz: 12, color: { rgb: "000000" } },
        fill: yellowFill,
        border: allBorders,
        alignment: centerAlign,
      },
      { border: allBorders, alignment: centerAlign },
    ];
    remarksList.forEach((val, i) => {
      setCell(ws2, 2 + i, 0, val, "s", remarkStyles[i]);
      setCell(ws2, 2 + i, 1, "", "s", {});
    });

    const daySources = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const dayFillMap = [redFill, null, null, null, null, null, grayFill];
    daySources.forEach((day, i) => {
      const fill = dayFillMap[i];
      setCell(ws2, 2 + i, 2, day, "s", {
        font: { sz: 12, color: { rgb: "000000" } },
        ...(fill ? { fill } : {}),
        border: allBorders,
        alignment: centerAlign,
      });
    });

    ws2["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: 8, c: 2 },
    });
    ws2["!cols"] = [{ wch: 12 }, { wch: 4 }, { wch: 10 }];
    ws2["!rows"] = [{ hpt: 10 }, { hpt: 22 }, ...Array(7).fill({ hpt: 20 })];

    const cutoffDates = [];

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      cutoffDates.push(new Date(d));
    }

    const ws1 = {};
    const totalCols = 5 + cutoffDates.length;

    for (let c = 0; c < totalCols; c++) setCell(ws1, 0, c, "", "s", {});

    setCell(ws1, 1, 0, "", "s", {});
    setCell(ws1, 1, 1, `ACESER Corporation - "${label}"`, "s", {
      font: { bold: true, sz: 12, color: { rgb: "000000" } },
      alignment: centerAlign,
    });
    for (let c = 2; c <= 4; c++) setCell(ws1, 1, c, "", "s", {});

    cutoffDates.forEach((d, i) => {
      setCell(ws1, 1, 5 + i, "REG", "s", {
        font: { bold: true, sz: 11, color: { rgb: "000000" } },
        fill: blueFill,
        border: topBottomBorder,
        alignment: centerAlign,
      });
    });

    setCell(ws1, 2, 0, "", "s", {});
    setCell(ws1, 2, 1, "ATTENDANCE", "s", {
      font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
      fill: greenFill,
      border: thickAllBorders,
      alignment: centerAlign,
    });
    for (let c = 2; c <= 4; c++) {
      setCell(ws1, 2, c, "", "s", { fill: greenFill, border: thickAllBorders });
    }

    cutoffDates.forEach((d, i) => {
      const dayFill = getDayFill(d);
      const isColored = d.getDay() === 0 || d.getDay() === 6;
      setCell(ws1, 2, 5 + i, dayNames[d.getDay()], "s", {
        font: {
          bold: true,
          sz: 11,
          color: { rgb: isColored ? "FFFFFF" : "000000" },
        },
        ...(dayFill ? { fill: dayFill } : {}),
        border: allBorders,
        alignment: centerAlign,
      });
    });

    setCell(ws1, 3, 0, "", "s", {});
    ["EMP NO.", "PERSONNEL", "CATEGORY", "SITE/OFFICE"].forEach((label, i) => {
      setCell(ws1, 3, 1 + i, label, "s", {
        font: { bold: true, sz: 12, color: { rgb: "000000" } },
        border: allBorders,
        alignment: centerAlign,
      });
    });

    cutoffDates.forEach((d, i) => {
      const dayFill = getDayFill(d);
      const isColored = d.getDay() === 0 || d.getDay() === 6;
      setCell(ws1, 3, 5 + i, d.getDate(), "n", {
        font: {
          bold: true,
          sz: 12,
          color: { rgb: isColored ? "FFFFFF" : "000000" },
        },
        ...(dayFill ? { fill: dayFill } : {}),
        border: allBorders,
        alignment: centerAlign,
      });
    });

    const attendanceMap = {};
    attendanceRecords.forEach((record) => {
      const userId = record.userId?._id || record.userId;
      const dateKey = formatKey(record.date);
      if (!attendanceMap[userId]) attendanceMap[userId] = {};
      attendanceMap[userId][dateKey] = record;
    });

    let rowIndex = 4;
    const employees = employeeData.filter((e) => e.role !== "Admin");

    employees.forEach((employee) => {
      const employeeAttendance = attendanceMap[employee._id] || {};
      const hireKey = employee.createdAt ? formatKey(employee.createdAt) : null;

      setCell(ws1, rowIndex, 0, "", "s", {});
      [
        employee.employeeId || "",
        employee.firstName + " " + employee.lastName,
        employee.category || "",
        employee.siteOffice || "",
      ].forEach((val, i) => {
        setCell(ws1, rowIndex, 1 + i, val, "s", {
          font: { sz: 12, color: { rgb: "000000" } },
          border: allBorders,
          alignment: centerAlign,
        });
      });

      cutoffDates.forEach((d, i) => {
        const dateKey = formatKey(d);
        const dayIndex = d.getDay();
        const isWeekendDay = dayIndex === 0 || dayIndex === 6;
        const dayFill = getDayFill(d);
        const isBeforeHire = hireKey && dateKey < hireKey;

        let cellValue = "";
        if (isBeforeHire) {
          cellValue = "-";
        } else if (employeeAttendance[dateKey]) {
          const record = employeeAttendance[dateKey];
          cellValue =
            record.behavior === "On-Time"
              ? "P"
              : record.behavior === "Late"
                ? "L"
                : record.behavior === "Absent"
                  ? "A"
                  : record.behavior || "";
        } else if (isWeekendDay) {
          cellValue = "R";
        }

        setCell(ws1, rowIndex, 5 + i, cellValue, "s", {
          ...(dayFill ? { fill: dayFill } : {}),
          border: allBorders,
          alignment: centerAlign,
        });
      });

      rowIndex++;
    });

    ws1["!merges"] = [
      { s: { r: 1, c: 1 }, e: { r: 1, c: 4 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } },
    ];

    ws1["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: rowIndex - 1, c: totalCols - 1 },
    });

    ws1["!cols"] = [
      { wch: 4 },
      { wch: 12 },
      { wch: 26 },
      { wch: 16 },
      { wch: 18 },
      ...cutoffDates.map(() => ({ wch: 6 })),
    ];

    ws1["!rows"] = [
      { hpt: 10 },
      { hpt: 28 },
      { hpt: 22 },
      { hpt: 22 },
      ...Array(rowIndex - 4).fill({ hpt: 22 }),
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      ws1,
      `${monthName} ${cutoff || "Report"}`,
    );
    XLSX.utils.book_append_sheet(workbook, ws2, "Remarks");

    XLSX.writeFile(workbook, `Admin_Attendance_${label}.xlsx`);
  };

  const { label } = getDateRange();
  const reportLabel = reportType === "month" ? "Full Month" : "Cut-off";

  return (
    <div className="main-content">
      <div className="user-track">
        <div className="user-track-title">
          <p>Attendance Reports</p>
        </div>
        <p className="user-track-description">
          Export attendance for all employees.
        </p>
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
            className="download-button"
            disabled={loading || employeeData.length === 0 || !selectedOption}
            onClick={handleDownload}
          >
            {loading ? "Preparing..." : `Download ${reportLabel} Attendance`}
          </button>
        </div>
      </div>

      <div className="reports-summary-panel">
        <div className="reports-metric-card">
          <p className="metric-title">Employees</p>
          <span className="metric-value">{employeeData.length}</span>
        </div>
        <div className="reports-metric-card">
          <p className="metric-title">Attendance Records</p>
          <span className="metric-value">{attendanceRecords.length}</span>
        </div>
        <div className="reports-metric-card">
          <p className="metric-title">Export Range</p>
          <span className="metric-value">{label}</span>
        </div>
      </div>
    </div>
  );
};

export default Reports;
