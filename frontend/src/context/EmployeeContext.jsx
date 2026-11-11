import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import PropTypes from "prop-types";
import API from "../api";
import { UserContext } from "./UserContext";
import { isAdminRole } from "../utils/roles";
import { activeFirst } from "../utils/employees";

export const EmployeeContext = createContext();

export const EmployeeProvider = ({ children }) => {
  const [employeeData, setEmployeeData] = useState([]);
  const { userData, loading } = useContext(UserContext);

  useEffect(() => {
    if (loading) return undefined;

    if (!isAdminRole(userData?.role)) {
      setEmployeeData([]);
      return undefined;
    }

    const controller = new AbortController();

    const fetchEmployees = async () => {
      try {
        const response = await API.get("/api/employee/employees", {
          params: { includeResigned: true },
          signal: controller.signal,
        });
        setEmployeeData(activeFirst(response.data));
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Error fetching employees:", error);
        }
      }
    };

    fetchEmployees();
    return () => controller.abort();
  }, [loading, userData?.role]);

  // A fresh list after a change made outside the Employees page (e.g. basic pay
  // saved on a profile), so the Dashboard's "need basic pay" count stays right
  const reloadEmployees = useCallback(async () => {
    if (!isAdminRole(userData?.role)) return;
    try {
      const response = await API.get("/api/employee/employees", {
        params: { includeResigned: true },
      });
      setEmployeeData(activeFirst(response.data));
    } catch (error) {
      console.error("Error reloading employees:", error);
    }
  }, [userData?.role]);

  return (
    <EmployeeContext.Provider
      value={{ employeeData, setEmployeeData, reloadEmployees }}
    >
      {children}
    </EmployeeContext.Provider>
  );
};

EmployeeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
