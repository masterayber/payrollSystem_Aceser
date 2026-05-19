import { createContext, useContext, useCallback } from "react";
import PropTypes from "prop-types";
import { UserContext } from "./UserContext";

export const FilingContext = createContext();

export const FilingProvider = ({ children }) => {
  const { userData, refreshDataSection } = useContext(UserContext);

  const leaveRequests = userData?.leaveRequests || [];
  const overtimeRequests = userData?.overtimeRequests || [];

  const refreshFilingData = useCallback(async () => {
    return await refreshDataSection(["leaveRequests", "overtimeRequests"]);
  }, [refreshDataSection]);

  return (
    <FilingContext.Provider
      value={{
        leaveRequests,
        overtimeRequests,
        refreshFilingData,
      }}
    >
      {children}
    </FilingContext.Provider>
  );
};

FilingProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
