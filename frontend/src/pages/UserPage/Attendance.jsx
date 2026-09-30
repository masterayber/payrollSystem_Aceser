import { useState, useContext, useEffect, useRef, useCallback } from "react";
import XLSX from "xlsx-js-style";
import { UserContext } from "../../context/UserContext";
import { formatFullMonthDate, formatTime } from "../../utils/dateFormatter";
import "../../styles/UserCSS/Attendance.css";
import Dropdown from "../../components/Dropdown/Dropdown";
import Pagination from "../../components/Pagination/Pagination";
import { isWeekend } from "date-fns";
import { IconDotsVertical } from "@tabler/icons-react";

const Attendance = () => {
  const { userData } = useContext(UserContext);

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

  const generateCutoffOptions = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const options = [];

    let monthsEmployed = 12;
    if (userData?.createdAt) {
      const hireDate = new Date(userData.createdAt);
      const hireMonth = hireDate.getMonth();
      const hireYear = hireDate.getFullYear();
      monthsEmployed =
        (currentYear - hireYear) * 12 + (currentMonth - hireMonth) + 1;
    }

    const monthsToShow = Math.min(monthsEmployed, 12);

    for (let offset = 0; offset >= -(monthsToShow - 1); offset--) {
      const monthIndex = (((currentMonth + offset) % 12) + 12) % 12;
      const year = currentYear + Math.floor((currentMonth + offset) / 12);
      const monthName = months[monthIndex];

      options.push(`${monthName} 2nd Cut-off ${year}`);
      options.push(`${monthName} 1st Cut-off ${year}`);
    }
    return options;
  };

  const cutoffOptions = generateCutoffOptions();

  const getDefaultCutoff = () => {
    const today = new Date();
    const day = today.getDate();
    const monthName = months[today.getMonth()];
    const year = today.getFullYear();
    const cutoff = day <= 10 || day >= 26 ? "1st" : "2nd";
    return `${monthName} ${cutoff} Cut-off ${year}`;
  };

  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [selectedCutoff, setSelectedCutoff] = useState(getDefaultCutoff());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  const userAttendance = userData?.attendance || [];

  const downloadDropdownRef = useRef(null);
  const downloadSvgRef = useRef(null);

  const parseCutoff = (cutoffStr) => {
    const isFirst = cutoffStr.includes("1st");
    const parts = cutoffStr.split(" ");
    const monthName = parts[0];
    const year = parseInt(parts[parts.length - 1]);
    return {
      monthIndex: months.indexOf(monthName),
      monthName,
      year,
      cutoff: isFirst ? "1st" : "2nd",
    };
  };

  const toggleDownloadDropdown = (event) => {
    event.stopPropagation();
    setShowDownloadDropdown((prev) => !prev);
  };

  const formatKey = (date) => {
    if (typeof date === "string") return date.split("T")[0];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getCutoffRange = (monthIndex, year, cutoff) => {
    if (cutoff === "2nd") {
      const start = `${year}-${String(monthIndex + 1).padStart(2, "0")}-11`;
      const end = `${year}-${String(monthIndex + 1).padStart(2, "0")}-25`;
      return { start, end };
    } else {
      const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
      const prevYear = monthIndex === 0 ? year - 1 : year;
      const prevDaysInMonth = new Date(
        prevYear,
        prevMonthIndex + 1,
        0,
      ).getDate();
      const startDay = Math.min(26, prevDaysInMonth);
      const start = `${prevYear}-${String(prevMonthIndex + 1).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
      const end = `${year}-${String(monthIndex + 1).padStart(2, "0")}-10`;
      return { start, end };
    }
  };

  const generateCutoffAttendance = (attendance, monthIndex, year, cutoff) => {
    const { start, end } = getCutoffRange(monthIndex, year, cutoff);
    const todayKey = formatKey(new Date());
    const hireKey = userData.createdAt?.split("T")[0];

    const attendanceMap = new Map(
      attendance.map((att) => [att.date.split("T")[0], att]),
    );

    const fullData = [];
    const startDate = new Date(start);
    const endDate = new Date(end);

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const key = formatKey(new Date(d));
      const existing = attendanceMap.get(key);

      if (existing) {
        fullData.push(existing);
      } else {
        const isFuture = key > todayKey;
        const isToday = key === todayKey;
        const isBeforeHire = hireKey && key < hireKey;
        const weekend = isWeekend(new Date(d));

        let behavior;
        if (isBeforeHire) {
          behavior = "-";
        } else if (weekend) {
          if (isFuture) continue;
          behavior = "Rest Day";
        } else if (isToday) {
          behavior = "Pending";
        } else if (isFuture) {
          continue;
        } else {
          behavior = "Absent";
        }

        fullData.push({
          _id: `absent-${key}`,
          date: key,
          timeIn: "--:--",
          timeOut: "--:--",
          overtime: null,
          behavior,
        });
      }
    }

    return fullData.reverse();
  };

  const { monthIndex, monthName, year, cutoff } = parseCutoff(selectedCutoff);

  const filteredAttendance = generateCutoffAttendance(
    userAttendance,
    monthIndex,
    year,
    cutoff,
  );

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
    const { start, end } = getCutoffRange(monthIndex, year, cutoff);

    const cutoffDates = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      cutoffDates.push(new Date(d));
    }

    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

    const thinBorder = { style: "thin", color: { rgb: "000000" } };
    const allBorders = {
      top: thinBorder,
      bottom: thinBorder,
      left: thinBorder,
      right: thinBorder,
    };
    const topBottomBorder = {
      top: thinBorder,
      bottom: thinBorder,
    };

    const thickBorder = { style: "medium", color: { rgb: "000000" } };
    const thickAllBorders = {
      top: thickBorder,
      bottom: thickBorder,
      left: thickBorder,
      right: thickBorder,
    };

    const blueFill = { patternType: "solid", fgColor: { rgb: "BDD7EE" } };
    const yellowFill = { patternType: "solid", fgColor: { rgb: "FFE699" } };
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
    ws2["!rows"] = [
      { hpt: 10 },
      { hpt: 22 },
      { hpt: 20 },
      { hpt: 20 },
      { hpt: 20 },
      { hpt: 20 },
      { hpt: 20 },
      { hpt: 20 },
      { hpt: 20 },
    ];

    const ws1 = {};
    const totalCols = 5 + cutoffDates.length;

    for (let c = 0; c < totalCols; c++) setCell(ws1, 0, c, "", "s", {});

    setCell(ws1, 1, 0, "", "s", {});
    setCell(ws1, 1, 1, `ACESER Corporation - "${selectedCutoff}"`, "s", {
      font: { bold: true, sz: 12, color: { rgb: "000000" } },
      alignment: centerAlign,
    });
    for (let c = 2; c <= 4; c++) setCell(ws1, 1, c, "", "s", {});

    cutoffDates.forEach((d, i) => {
      const value = "REG";

      setCell(ws1, 1, 5 + i, "REG", "s", {
        font: { bold: true, sz: 11, color: { rgb: "000000" } },
        fill: value === "HOL" ? yellowFill : blueFill,
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

    const fullName = `${userData?.employee?.lastName}, ${userData?.employee?.firstName}`;

    setCell(ws1, 4, 0, "", "s", {});
    [
      userData?.employee?.employeeId || "",
      fullName || "",
      userData?.settings?.general?.jobDescription?.category || "",
      userData?.settings?.general?.jobDescription?.designation || "",
    ].forEach((val, i) => {
      setCell(ws1, 4, 1 + i, val, "s", {
        font: { sz: 12, color: { rgb: "000000" } },
        border: allBorders,
        alignment: centerAlign,
      });
    });

    cutoffDates.forEach((d, i) => {
      const dayFill = getDayFill(d);
      setCell(ws1, 4, 5 + i, "", "s", {
        ...(dayFill ? { fill: dayFill } : {}),
        border: allBorders,
        alignment: centerAlign,
      });
    });

    ws1["!merges"] = [
      { s: { r: 1, c: 1 }, e: { r: 1, c: 4 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } },
    ];

    ws1["!dataValidation"] = [
      ...cutoffDates.map((_, i) => ({
        sqref: XLSX.utils.encode_cell({ r: 1, c: 5 + i }),
        type: "list",
        formula1: "Remarks!$A$3:$A$5",
        showDropdown: false,
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: "Invalid Value",
        error: "Please select REG, HOL, or leave blank.",
      })),
      ...cutoffDates.map((_, i) => ({
        sqref: XLSX.utils.encode_cell({ r: 2, c: 5 + i }),
        type: "list",
        formula1: "Remarks!$C$3:$C$9",
        showDropdown: false,
        showErrorMessage: true,
        errorStyle: "warning",
        errorTitle: "Invalid Value",
        error: "Please select a valid day.",
      })),
    ];

    const firstDayCol = XLSX.utils.encode_col(5);
    const lastDayCol = XLSX.utils.encode_col(4 + cutoffDates.length);
    const cfRange = `${firstDayCol}2:${lastDayCol}2`;

    ws1["!conditionalFormatting"] = [
      {
        ref: cfRange,
        rules: [
          {
            type: "containsText",
            operator: "containsText",
            text: "REG",
            priority: 1,
            dxf: {
              fill: { patternType: "solid", fgColor: { rgb: "BDD7EE" } },
            },
          },
          {
            type: "containsText",
            operator: "containsText",
            text: "HOL",
            priority: 2,
            dxf: {
              fill: { patternType: "solid", fgColor: { rgb: "FFE699" } },
            },
          },
        ],
      },
    ];

    ws1["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: 4, c: totalCols - 1 },
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
      { hpt: 22 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      ws1,
      `${monthName} ${cutoff} Cutoff`,
    );
    XLSX.utils.book_append_sheet(workbook, ws2, "Remarks");

    const employeeName = userData?.name
      ? userData.name.replace(/\s+/g, "_")
      : "Employee";

    XLSX.writeFile(
      workbook,
      `Attendance_${employeeName}_${monthName}_${cutoff}Cutoff_${year}.xlsx`,
    );

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
      document.addEventListener("click", handleClickOutside);
    };
  }, [showDownloadDropdown]);

  return (
    <div className="main-content">
      <div className="data-card-container">
        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Total Hours Worked</div>
            <div className="data-value">{metrics.totalHours}</div>
          </div>
        </div>

        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Total Overtime Hours</div>
            <div className="data-value">{metrics.totalOvertimeHours}</div>
          </div>
        </div>

        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Total On-Time</div>
            <div className="data-value">{metrics.totalOnTime}</div>
          </div>
        </div>

        <div className="data-card">
          <div className="message-container">
            <div className="data-title">Total Absences</div>
            <div className="data-value">{metrics.totalAbsences}</div>
          </div>
        </div>
      </div>

      <Dropdown
        options={cutoffOptions}
        value={selectedCutoff}
        placeholder="Select Cut-off period"
        onSelect={handleMonthChange}
      />

      <div className="table-container">
        <div className="table-title">
          <p>Daily Attendance Log</p>

          <div className="dots-button-container">
            <IconDotsVertical
              stroke={2}
              onClick={toggleDownloadDropdown}
              ref={downloadSvgRef}
              className="dots-button"
            />
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
        <div className="table">
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
                <h6 className="no-data">No Attendance Available</h6>
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
                    <p>{att.behavior}</p>
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
