import { useEffect, useState } from "react";

const AdminAccessibilitySettings = () => {
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add("light-mode");
    } else {
      document.body.classList.remove("light-mode");
    }
    return () => {
      document.body.classList.remove("light-mode");
    };
  }, [isLightMode]);

  return (
    <div className="settings-content">
      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Accesibility</p>
        </div>

        <div className="setting-tab-container">
          <div className="setting-section">
            <div className="setting-section-text-container">
              <p className="setting-section-text-title">Theme</p>
              <p className="setting-section-text-description">
                Enable light mode/dark mode for improve visibility and
                readability.
              </p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={isLightMode}
                onChange={() => setIsLightMode((prev) => !prev)}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>

        <div className="setting-tab-container">
          <div className="setting-section">
            <div className="setting-section-text-container">
              <p className="setting-section-text-title">Push Notifications</p>
              <p className="setting-section-text-description">
                Enable push notifications at email
              </p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={isLightMode}
                onChange={() => setIsLightMode((prev) => !prev)}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAccessibilitySettings;
