import React, { useState } from "react";
import GeneralSettings from "../../components/SettingsComponent/UserSettingsComponent/GeneralSettings";
import ManageSettings from "../../components/SettingsComponent/UserSettingsComponent/ManageSettings";
import AccessibilittySettings from "../../components/SettingsComponent/UserSettingsComponent/AccessibilittySettings";
import AboutSettings from "../../components/SettingsComponent/UserSettingsComponent/AboutSettings";

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

        {settingsContent[selectedOption]}
      </div>
    </div>
  );
};

export default AdminSettings;
