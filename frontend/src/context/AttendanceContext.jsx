import { createContext, useEffect, useState } from "react";
import PropTypes from "prop-types";

export const AttendanceContext = createContext();

export const AttendanceProvider = ({ children }) => {
  const [attendanceData, setAttendanceData] = useState([]);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/attendance/attendance",
        );
        const data = await response.json();
        setAttendanceData(data);
      } catch (error) {
        console.error("Error fetching employees:", error);
      }

      AttendanceProvider.propTypes = {
        children: PropTypes.node.isRequired,
      };
    };

    fetchAttendance();
  }, [attendanceData, setAttendanceData]);

  return (
    <AttendanceContext.Provider value={{ attendanceData, setAttendanceData }}>
      {children}
    </AttendanceContext.Provider>
  );
};
