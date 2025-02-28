import { createContext, useContext, useState } from "react";

const EmployeeContext = createContext();

export const EmployeeProvider = ({ children }) => {
  const [employeeData, setEmployeeData] = useState([
    {
      id: "AC-001",
      lastName: "NACIONALES",
      firstName: "IVERSON",
      type: "Probationary",
      department: "Admin",
      position: "Web Developer",
      startDate: "December 2, 2024",
      withholdingTax: "000.00",
      deductions: "000.00",
      loans: "000.00",
      grossPay: "000.00",
      netPay: "000.00",
      attendance: [
        { date: "2025-02-24", timeIn: "07:41:00", timeOut: "17:20:00" },
        { date: "2025-02-25", timeIn: "07:45:00", timeOut: "17:15:00" },
        { date: "2025-02-26", timeIn: "07:55:00", timeOut: "17:09:00" },
        { date: "2025-02-27", timeIn: "07:33:00", timeOut: "17:45:00" },
        { date: "2025-02-28", timeIn: "07:43:00", timeOut: "17:04:00" }, // Absent
      ],
    },
    {
      id: "AC-002",
      lastName: "FERNANDEZ",
      firstName: "LUCIA",
      type: "Probationary",
      department: "Finance",
      position: "Financial Analyst",
      startDate: "July 10, 2023",
      withholdingTax: "000.00",
      deductions: "000.00",
      loans: "000.00",
      grossPay: "000.00",
      netPay: "000.00",
      attendance: [
        { date: "2025-02-24", timeIn: "08:40:00", timeOut: "17:50:00" },
        { date: "2025-02-25", timeIn: "09:00:00", timeOut: "17:30:00" },
        { date: "2025-02-26", timeIn: "", timeOut: "" }, // Absent
        { date: "2025-02-27", timeIn: "08:35:00", timeOut: "17:40:00" },
        { date: "2025-02-28", timeIn: "08:10:00", timeOut: "17:20:00" },
      ],
    },
    {
      id: "AC-003",
      lastName: "TORRES",
      firstName: "CARLOS",
      type: "Regular",
      department: "IT",
      position: "Software Engineer",
      startDate: "March 4, 2024",
      withholdingTax: "000.00",
      deductions: "000.00",
      loans: "000.00",
      grossPay: "000.00",
      netPay: "000.00",
      attendance: [
        { date: "2025-02-24", timeIn: "07:55:00", timeOut: "17:00:00" },
        { date: "2025-02-25", timeIn: "08:10:00", timeOut: "16:50:00" },
        { date: "2025-02-26", timeIn: "08:05:00", timeOut: "17:10:00" },
        { date: "2025-02-27", timeIn: "08:20:00", timeOut: "17:15:00" },
        { date: "2025-02-28", timeIn: "07:50:00", timeOut: "17:30:00" },
      ],
    },
    {
      id: "AC-004",
      lastName: "RAMIREZ",
      firstName: "SOFIA",
      type: "Regular",
      department: "Marketing",
      position: "Marketing Coordinator",
      startDate: "October 20, 2021",
      withholdingTax: "000.00",
      deductions: "000.00",
      loans: "000.00",
      grossPay: "000.00",
      netPay: "000.00",
      attendance: [
        { date: "2025-02-24", timeIn: "09:10:00", timeOut: "18:15:00" },
        { date: "2025-02-25", timeIn: "", timeOut: "" }, // Absent
        { date: "2025-02-26", timeIn: "08:45:00", timeOut: "17:40:00" },
        { date: "2025-02-27", timeIn: "09:00:00", timeOut: "18:00:00" },
        { date: "2025-02-28", timeIn: "09:05:00", timeOut: "18:10:00" },
      ],
    },
    {
      id: "AC-005",
      lastName: "CRUZ",
      firstName: "DANIEL",
      type: "Regular",
      department: "IT",
      position: "System Administrator",
      startDate: "August 30, 2023",
      withholdingTax: "000.00",
      deductions: "000.00",
      loans: "000.00",
      grossPay: "000.00",
      netPay: "000.00",
      attendance: [
        { date: "2025-02-24", timeIn: "08:00:00", timeOut: "16:45:00" },
        { date: "2025-02-25", timeIn: "07:55:00", timeOut: "16:50:00" },
        { date: "2025-02-26", timeIn: "08:05:00", timeOut: "16:55:00" },
        { date: "2025-02-27", timeIn: "08:15:00", timeOut: "16:40:00" },
        { date: "2025-02-28", timeIn: "08:10:00", timeOut: "16:50:00" },
      ],
    },
  ]);

  return (
    <EmployeeContext.Provider value={{ employeeData, setEmployeeData }}>
      {children}
    </EmployeeContext.Provider>
  );
};

export const useEmployee = () => useContext(EmployeeContext);
