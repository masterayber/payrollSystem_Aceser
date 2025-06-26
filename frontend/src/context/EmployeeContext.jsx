import { createContext, useState, useEffect, useContext } from "react";
import PropTypes from "prop-types";
import { UserContext } from "./UserContext";

export const EmployeeContext = createContext();

export const EmployeeProvider = ({ children }) => {
  const [employeeData, setEmployeeData] = useState([]);
  const { userData } = useContext(UserContext);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/auth/employees"
        );
        const data = await response.json();
        setEmployeeData(data);
      } catch (error) {
        console.error("Error fetching employees", error);
      }

      EmployeeProvider.propTypes = {
        children: PropTypes.node.isRequired,
      };
    };

    if (userData?.role === "Admin" && employeeData.length === 0) {
      fetchEmployees();
    }
  }, [userData, employeeData.length]);
  return (
    <EmployeeContext.Provider value={{ employeeData, setEmployeeData }}>
      {children}
    </EmployeeContext.Provider>
  );
};
