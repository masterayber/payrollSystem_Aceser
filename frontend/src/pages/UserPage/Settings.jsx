import { useState } from "react";
import GeneralSettings from "../../components/SettingsComponent/UserSettingsComponent/GeneralSettings";
import ManageSettings from "../../components/SettingsComponent/UserSettingsComponent/ManageSettings";
import AccessibilittySettings from "../../components/SettingsComponent/UserSettingsComponent/AccessibilittySettings";
import AboutSettings from "../../components/SettingsComponent/UserSettingsComponent/AboutSettings";
import "../../components/SettingsComponent/SettingsComponent.css";
import "../../styles/UserCSS/Settings.css";

const settingsOptions = [
  { name: "General", key: "general" },
  { name: "Manage", key: "manage" },
  { name: "Accessibility", key: "accessibility" },
  { name: "About", key: "about" },
];

const settingsContent = {
  general: <GeneralSettings />,
  manage: <ManageSettings />,
  accessibility: <AccessibilittySettings />,
  about: <AboutSettings />,
};

const AdminSettings = () => {
  const [selectedOption, setSelectedOption] = useState("general");

  return (
    <div className="main-content employee-settings-page">
      <div className="data-card settings-shell">
        <div
          className="setting-options"
          role="group"
          aria-label="Settings sections"
        >
          {settingsOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={selectedOption === option.key}
              className={`setting-button ${
                selectedOption === option.key ? "active" : ""
              }`}
              onClick={() => setSelectedOption(option.key)}
            >
              <p>{option.name}</p>
            </button>
          ))}
        </div>

        <div className="settings-panel">
          {settingsContent[selectedOption]}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
