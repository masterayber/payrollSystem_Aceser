import { createContext, useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import API from "../api";
import { UserContext } from "./UserContext";

export const AttendanceContext = createContext();

export const AttendanceProvider = ({ children }) => {
  const [attendanceData, setAttendanceData] = useState([]);
  const { userData, loading } = useContext(UserContext);

  useEffect(() => {
    if (loading) return undefined;

    if (userData?.role !== "Admin") {
      setAttendanceData([]);
      return undefined;
    }

    const controller = new AbortController();

    const fetchAttendance = async () => {
      try {
        const response = await API.get("/api/attendance/attendance", {
          signal: controller.signal,
        });
        setAttendanceData(response.data);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Error fetching attendance:", error);
        }
      }
    };

    fetchAttendance();
    return () => controller.abort();
  }, [loading, userData?.role]);

  return (
    <AttendanceContext.Provider value={{ attendanceData, setAttendanceData }}>
      {children}
    </AttendanceContext.Provider>
  );
};

AttendanceProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
