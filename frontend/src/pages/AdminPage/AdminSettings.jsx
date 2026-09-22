import { useState } from "react";
import "../../styles/AdminCSS/AdminSettings.css";
import AdminGeneralSettings from "../../components/SettingsComponent/AdminSettingsComponent/AdminGeneralSettings";
import AdminManageSettings from "../../components/SettingsComponent/AdminSettingsComponent/AdminManageSettings";
import AdminAccessibilitySettings from "../../components/SettingsComponent/AdminSettingsComponent/AdminAccessibilitySettings";
import AdminSecuritySettings from "../../components/SettingsComponent/AdminSettingsComponent/AdminSecuritySettings";
import AdminAboutSettings from "../../components/SettingsComponent/AdminSettingsComponent/AdminAboutSettings";

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
  general: <AdminGeneralSettings />,
  manage: <AdminManageSettings />,
  accessibility: <AdminAccessibilitySettings />,
  // employees: <EmployeesSettings />,
  security: <AdminSecuritySettings />,
  // payroll: <PayrollSettings />,
  // attendance: <AttendanceSettings />,
  // systemLog: <SystemLogSettings />,
  about: <AdminAboutSettings />,
};

const AdminSettings = () => {
  const [selectedOption, setSelectedOption] = useState("general");
  return (
    <div className="main-content">
      <div className="data-card">
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

        {settingsContent[selectedOption]}
      </div>
    </div>
  );
};

export default AdminSettings;
