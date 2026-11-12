import { useContext, useLayoutEffect, useRef, useState } from "react";
import "../../styles/AdminCSS/AdminSettings.css";

import GeneralSettings from "../../components/SettingsComponent/UserSettingsComponent/GeneralSettings";
import AdminCompanySettings from "../../components/SettingsComponent/AdminSettingsComponent/AdminCompanySettings";

import AdminManageSettings from "../../components/SettingsComponent/AdminSettingsComponent/AdminManageSettings";
import AdminAccessibilitySettings from "../../components/SettingsComponent/AdminSettingsComponent/AdminAccessibilitySettings";
import AdminSecuritySettings from "../../components/SettingsComponent/AdminSettingsComponent/AdminSecuritySettings";
import AdminAboutSettings from "../../components/SettingsComponent/AdminSettingsComponent/AdminAboutSettings";
import AdminAccountsSettings from "../../components/SettingsComponent/AdminSettingsComponent/AdminAccountsSettings";
import { UserContext } from "../../context/UserContext";
import { isSuperAdmin } from "../../utils/roles";

const settingsOptions = [
  { name: "General", key: "general" },
  { name: "Company", key: "company" },
  { name: "Manage", key: "manage" },
  { name: "Accessibility", key: "accessibility" },
  { name: "Employees", key: "employees" },
  { name: "Security & Privacy", key: "security" },
  { name: "Payroll & Benefits", key: "payroll" },
  { name: "Attendance", key: "attendance" },
  { name: "System Log", key: "systemLog" },
  { name: "About", key: "about" },
];

// Shown just before "About", and only to the account that manages the Admin accounts
const adminsOption = { name: "Admins", key: "admins" };

const settingsContent = {
  general: <GeneralSettings showEmployment={false} />,
  company: <AdminCompanySettings />,
  manage: <AdminManageSettings />,
  accessibility: <AdminAccessibilitySettings />,
  // employees: <EmployeesSettings />,
  security: <AdminSecuritySettings />,
  // payroll: <PayrollSettings />,
  // attendance: <AttendanceSettings />,
  // systemLog: <SystemLogSettings />,
  admins: <AdminAccountsSettings />,
  about: <AdminAboutSettings />,
};

const AdminSettings = () => {
  const [selectedOption, setSelectedOption] = useState("general");
  const settingsOptionsRef = useRef(null);
  const { userData } = useContext(UserContext);

  const canManageAdmins = isSuperAdmin(userData?.role);
  const visibleOptions = canManageAdmins
    ? [
        ...settingsOptions.filter((option) => option.key !== "about"),
        adminsOption,
        ...settingsOptions.filter((option) => option.key === "about"),
      ]
    : settingsOptions;
  // The panel follows the tabs: without the Admins tab its panel is never drawn
  const visibleKey = visibleOptions.some(
    (option) => option.key === selectedOption,
  )
    ? selectedOption
    : "general";

  useLayoutEffect(() => {
    const optionsElement = settingsOptionsRef.current;
    if (!optionsElement) return undefined;

    const updateIndicator = () => {
      const activeButton = optionsElement.querySelector(
        ".setting-button.active",
      );
      if (!activeButton) return;

      const optionsRect = optionsElement.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      optionsElement.style.setProperty(
        "--setting-indicator-left",
        `${buttonRect.left - optionsRect.left}px`,
      );
      optionsElement.style.setProperty(
        "--setting-indicator-width",
        `${buttonRect.width}px`,
      );
    };

    updateIndicator();
    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(optionsElement);

    return () => resizeObserver.disconnect();
  }, [visibleKey, canManageAdmins]);

  return (
    <div className="main-content admin-settings-page">
      <div className="data-card settings-shell">
        <div
          className="setting-options"
          role="group"
          aria-label="Settings sections"
          ref={settingsOptionsRef}
        >
          {visibleOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={visibleKey === option.key}
              className={`setting-button ${
                visibleKey === option.key ? "active" : ""
              }`}
              onClick={() => setSelectedOption(option.key)}
            >
              <p>{option.name}</p>
            </button>
          ))}
        </div>

        <div className="settings-panel">{settingsContent[visibleKey]}</div>
      </div>
    </div>
  );
};

export default AdminSettings;
