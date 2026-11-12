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
import { adminSettingsTabs, visibleSettingsTab } from "../../utils/pageAccess";

// The tabs drawn and their order come from adminSettingsTabs (by tick and role).
// The empty tabs (Employees, Payroll & Benefits, Attendance, System Log) are not
// listed until they have content.
const settingsContent = {
  // The signed-in admin's own password sits at the bottom of General
  general: <GeneralSettings showEmployment={false} showPassword />,
  company: <AdminCompanySettings />,
  manage: <AdminManageSettings />,
  accessibility: <AdminAccessibilitySettings />,
  security: <AdminSecuritySettings />,
  admins: <AdminAccountsSettings />,
  about: <AdminAboutSettings />,
};

const AdminSettings = () => {
  const [selectedOption, setSelectedOption] = useState("general");
  const settingsOptionsRef = useRef(null);
  const { userData } = useContext(UserContext);

  const visibleOptions = adminSettingsTabs(userData);
  // The panel follows the tabs: a tab that disappears falls back to General
  const visibleKey = visibleSettingsTab(visibleOptions, selectedOption);
  // Redraw the indicator when the set of tabs changes (a tick loaded or changed)
  const tabsKey = visibleOptions.map((option) => option.key).join();

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
  }, [visibleKey, tabsKey]);

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
