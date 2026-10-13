import { createContext, useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import API from "../api";
import { UserContext } from "./UserContext";

export const EmployeeContext = createContext();

export const EmployeeProvider = ({ children }) => {
  const [employeeData, setEmployeeData] = useState([]);
  const { userData, loading } = useContext(UserContext);

  useEffect(() => {
    if (loading) return undefined;

    if (userData?.role !== "Admin") {
      setEmployeeData([]);
      return undefined;
    }

    const controller = new AbortController();

    const fetchEmployees = async () => {
      try {
        const response = await API.get("/api/employee/employees", {
          signal: controller.signal,
        });
        setEmployeeData(response.data);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Error fetching employees:", error);
        }
      }
    };

    fetchEmployees();
    return () => controller.abort();
  }, [loading, userData?.role]);

  return (
    <EmployeeContext.Provider value={{ employeeData, setEmployeeData }}>
      {children}
    </EmployeeContext.Provider>
  );
};

EmployeeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
