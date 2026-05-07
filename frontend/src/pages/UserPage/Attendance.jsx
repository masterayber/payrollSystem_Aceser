import { useState, useContext, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { UserContext } from "../../context/UserContext";
import { formatFullMonthDate } from "../../utils/dateFormatter";
import "../../styles/UserCSS/Attendance.css";
import Dropdown from "../../components/Dropdown/Dropdown";
import API from "../../api";
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
    const options = [];
    months.forEach((month) => {
      options.push(`${month} 1st Cut-off`);
      options.push(`${month} 2nd Cut-off`);
    });
    return options;
  };

  const cutoffOptions = generateCutoffOptions();

  const getDefaultCutoff = () => {
    const today = new Date();
    const day = today.getDate();
    const monthName = months[today.getMonth()];
    const cutoff = day <= 10 || day >= 26 ? "1st" : "2nd";
    return `${monthName} ${cutoff} Cut-off`;
  };

  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [userAttendance, setUserAttendance] = useState([]);
  const [selectedCutoff, setSelectedCutoff] = useState(getDefaultCutoff());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  const downloadDropdownRef = useRef(null);
  const downloadSvgRef = useRef(null);

  const parseCutoff = (cutoffStr) => {
    const isFirst = cutoffStr.includes("1st");
    const monthName = cutoffStr
      .replace(" 1st Cut-off", "")
      .replace(" 2nd Cut-off", "");
    return {
      monthIndex: months.indexOf(monthName),
      monthName,
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
      const end = `${year}-${year}-${String(monthIndex + 1).padStart(2, "0")}-25`;
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

  const currentYear = new Date().getFullYear();
  const { monthIndex, monthName, cutoff } = parseCutoff(selectedCutoff);

  const filteredAttendance = generateCutoffAttendance(
    userAttendance,
    monthIndex,
    currentYear,
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
    const rows = filteredAttendance.map((att) => ({
      Date: formatFullMonthDate(att.date),
      "Time In": att.timeIn,
      "Time Out": att.timeOut,
      Overtime: att.overtime?.isEligible
        ? `${att.overtime.hours.toFixed(2)} hrs`
        : "-",
      Behavior: att.behavior,
    }));

    const { start, end } = getCutoffRange(monthIndex, currentYear, cutoff);
    const payday = cutoff === "1st" ? "15th" : "End of Month";

    const summaryRows = [
      {},
      { Date: `--- ${selectedCutoff} Summary (${start} to ${end}) ---` },
      { Date: "Payday", "Time In": payday },
      { Date: "Total Hours Worked", "Time In": `${metrics.totalHours} hrs` },
      {
        Date: "Total Overtime Hours",
        "Time In": `${metrics.totalOvetimeHours} hrs`,
      },
      { Date: "Total On-Time", "Time In": metrics.totalOnTime },
      { Date: "Total Absences", "Time In": metrics.totalAbsences },
    ];

    const allRows = [...rows, ...summaryRows];
    const workSheet = XLSX.utils.json_to_sheet(allRows);

    workSheet["!cols"] = [
      { wch: 26 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    const sheetName = `${monthName} ${cutoff} Cutoff`;
    XLSX.utils.book_append_sheet(workbook, workSheet, sheetName);

    const employeeName = userData?.name
      ? userData.name.replace(/\s+/g, "_")
      : "Employee";

    XLSX.writeFile(
      workbook,
      `Attendance_${employeeName}_${monthName}_${cutoff}Cutoff_${currentYear}.xlsx`,
    );

    setShowDownloadDropdown(false);
  };

  const handleMonthChange = (option) => {
    setSelectedCutoff(option);
    setCurrentPage(1);
  };

  useEffect(() => {
    const handleUserAttendance = async () => {
      try {
        const response = await API.get(`/api/attendance/${userData._id}`);
        setUserAttendance(response.data.data);
        setCurrentPage(1);
      } catch (error) {
        console.error("Error fetching user attendance:", error);
      }
    };
    if (userData._id) handleUserAttendance();
  }, [userData._id]);

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
      <div className="user-track-container">
        <div className="user-track">
          <p>Total Hours worked</p>
          <div className="total-user-track">
            <span className="user-number">{metrics.totalHours}</span>
            <span className="user-text">hours</span>
          </div>
        </div>
        <div className="user-track">
          <p>Total Overtime Hours</p>
          <div className="total-user-track">
            <span className="user-number">{metrics.totalOvertimeHours}</span>
            <span className="user-text">hours</span>
          </div>
        </div>
        <div className="user-track">
          <p>Total On-Time</p>
          <div className="total-user-track">
            <span className="user-number">{metrics.totalOnTime}</span>
          </div>
        </div>
        <div className="user-track">
          <p>Total Absences</p>
          <div className="total-user-track">
            <span className="user-number">{metrics.totalAbsences}</span>
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
                    <p>{att.timeIn}</p>
                  </article>
                  <article className="table-content-container">
                    <p>{att.timeOut}</p>
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
