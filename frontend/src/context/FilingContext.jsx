import {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";
import PropTypes from "prop-types";
import API from "../api";
import { UserContext } from "./UserContext";

export const FilingContext = createContext();

export const FilingProvider = ({ children }) => {
  const { userData } = useContext(UserContext);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [overtimeRequests, setOvertimeRequests] = useState([]);

  const fetchFilingData = useCallback(async () => {
    if (!userData) return;

    try {
      const [leaveRes, overtimeRes] = await Promise.all([
        API.get("/api/filing/user-leave-requests"),
        API.get("/api/filing/user-overtime-requests"),
      ]);

      setLeaveRequests(leaveRes.data || []);
      setOvertimeRequests(overtimeRes.data || []);
    } catch (error) {
      console.error("Error fetching filing data:", error);
      setLeaveRequests([]);
      setOvertimeRequests([]);
    }
  }, [userData]);

  useEffect(() => {
    if (userData) {
      fetchFilingData();
    } else {
      setLeaveRequests([]);
      setOvertimeRequests([]);
    }
  }, [userData, fetchFilingData]);

  return (
    <FilingContext.Provider
      value={{
        leaveRequests,
        setLeaveRequests,
        overtimeRequests,
        setOvertimeRequests,
        refreshFilingData: fetchFilingData,
      }}
    >
      {children}
    </FilingContext.Provider>
  );
};

FilingProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
