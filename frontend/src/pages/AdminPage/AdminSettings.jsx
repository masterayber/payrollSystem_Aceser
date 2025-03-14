import React, { useState } from "react";
import "../../styles/AdminCSS/AdminSettings.css";
import GeneralSettings from "../../components/SettingsComponent/AdminSettingsComponent/AdminGeneralSettings";

const settingsOptions = [
  { name: "General", key: "general" },
  { name: "Manage", key: "manage" },
  { name: "Accessibility", key: "accessibility" },
  { name: "Employees", key: "employees" },
  { name: "Security & Privacy", key: "security" },
  { name: "Payroll & Benefits", key: "payroll" },
  { name: "Attendance", key: "attendance" },
  { name: "System Log", key: "systemLog" },
  { name: "About", key: "about" },
];

const settingsContent = {
  general: <GeneralSettings />,
  // manage: <ManageSettings />,
  // accessibility: <AccessibilitySettings />,
  // employees: <EmployeesSettings />,
  // security: <SecuritySettings />,
  // payroll: <PayrollSettings />,
  // attendance: <AttendanceSettings />,
  // systemLog: <SystemLogSettings />,
  // about: <AboutSettings />,
};

const AdminSettings = () => {
  const [selectedOption, setSelectedOption] = useState("general");

  return (
    <div className="main-content">
      <div className="setting-container">
        <div className="setting-options">
          {settingsOptions.map((option) => (
            <button
              key={option.key}
              className={`setting-button ${
                selectedOption === option.key ? "active" : ""
              }`}
              onClick={() => setSelectedOption(option.key)}
            >
              <p>{option.name}</p>
            </button>
          ))}
        </div>

        <div className="settings-content">
          {settingsContent[selectedOption]}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
