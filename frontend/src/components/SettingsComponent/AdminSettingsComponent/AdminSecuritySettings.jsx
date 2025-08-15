import { useEffect, useState } from "react";

const AdminSecuritySettings = () => {
  return (
    <div className="settings-content">
      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Security & Privacy</p>
        </div>

        <div className="setting-tab-container">
          <div className="setting-section">
            <div className="setting-section-text-container">
              <p className="setting-section-text-title">
                Two-Factor Authenthication
              </p>
              <p className="setting-section-text-description">
                Enable Two-Factor Authentication
              </p>
            </div>
            <label className="switch">
              <input type="checkbox" />
              <span className="slider round"></span>
            </label>
          </div>
        </div>

        <div className="setting-tab-container">
          <div className="setting-section">
            <div className="setting-section-text-container">
              <p className="setting-section-text-title">Password Policy</p>
              <p className="setting-section-text-description">
                Enable password policies, multi
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSecuritySettings;
