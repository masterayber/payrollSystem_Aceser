import { createContext, useState, useEffect } from "react";
import PropTypes from "prop-types";

export const FilingContext = createContext();

export const FilingProvider = ({ children }) => {
  const [leaveRequests, setLeaveRequests] = useState([]);

  useEffect(() => {
    const fetchLeaveRequests = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/filing/user-leave-requests",
        );
        const data = await response.json();
        setLeaveRequests(data);
      } catch (error) {
        console.error("Error fetching leave requests:", error);
      }
    };

    fetchLeaveRequests();
  }, []);

  return (
    <FilingContext.Provider value={{ leaveRequests, setLeaveRequests }}>
      {children}
    </FilingContext.Provider>
  );
};

FilingProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
