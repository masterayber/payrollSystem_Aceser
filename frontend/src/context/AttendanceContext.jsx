import { createContext, useEffect, useState } from "react";

export const AttendanceContext = createContext();

export const AttendanceProvider = ({ children }) => {
  const [attendanceData, setAttendanceData] = useState([]);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/attendance/attendance"
        );
        const data = await response.json();
        setAttendanceData(data);
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
    };

    fetchAttendance();
  }, []);

  return (
    <AttendanceContext.Provider value={{ attendanceData, setAttendanceData }}>
      {children}
    </AttendanceContext.Provider>
  );
};
