import { useState } from "react";
import ProjectsTab from "./ProjectsTab";
import ItemsTab from "./ItemsTab";
import SuppliersTab from "./SuppliersTab";
import ListsTab from "./ListsTab";
import "../../../styles/AdminCSS/AdminSettings.css";
import "../../../styles/AdminCSS/LogisticsSetup.css";

const SETUP_TABS = [
  { name: "Projects", key: "projects" },
  { name: "Items", key: "items" },
  { name: "Suppliers", key: "suppliers" },
  { name: "Lists", key: "lists" },
];

const tabContent = {
  projects: <ProjectsTab />,
  items: <ItemsTab />,
  suppliers: <SuppliersTab />,
  lists: <ListsTab />,
};

// Logistics > Setup (admin only): master data and project membership
const Setup = () => {
  const [selectedTab, setSelectedTab] = useState("projects");

  return (
    <div className="main-content admin-settings-page logistics-setup-page">
      <div className="data-card settings-shell">
        <div
          className="setting-options logistics-setup-tabs"
          role="group"
          aria-label="Setup sections"
        >
          {SETUP_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={selectedTab === tab.key}
              className={`setting-button ${
                selectedTab === tab.key ? "active" : ""
              }`}
              onClick={() => setSelectedTab(tab.key)}
            >
              <p>{tab.name}</p>
            </button>
          ))}
        </div>

        <div className="settings-panel">{tabContent[selectedTab]}</div>
      </div>
    </div>
  );
};

export default Setup;
