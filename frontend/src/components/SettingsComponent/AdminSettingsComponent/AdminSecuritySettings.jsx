import "react";
import { MIN_PASSWORD_LENGTH } from "../../../utils/password";

const AdminSecuritySettings = () => {
  return (
    <div className="settings-content">
      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Security & Privacy</p>
        </div>

        {/* The admin's own password is on General (one place for it) */}
        {/* Two-Factor sign-in is not built yet: the switch is shown greyed out */}
        <div className="setting-tab-container">
          <div className="setting-section">
            <div className="setting-section-text-container">
              <p className="setting-section-text-title">
                Two-Factor Authentication
              </p>
              <p className="setting-section-text-description">
                Not available yet.
              </p>
            </div>
            <label className="switch switch-unavailable">
              <input
                type="checkbox"
                disabled
                aria-label="Two-Factor Authentication (not available yet)"
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>

        <div className="setting-tab-container">
          <div className="setting-section">
            <div className="setting-section-text-container">
              <p className="setting-section-text-title">Password Policy</p>
              <p className="setting-section-text-description">
                {`Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSecuritySettings;
