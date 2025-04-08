import React from "react";
import "../SettingsComponent.css";

const AboutSettings = () => {
  return (
    <div className="settings-content">
      <div className="settings-title-tab">
        <div className="settings-title-section">
          <div className="settings-title">
            <p>ACESER Payroll System</p>
          </div>
          <div className="settings-description">
            <p>Version 1.0.0</p>
          </div>
        </div>
        <div className="company-logo">
          <img
            src="/assets/aceser-logo.png"
            alt="Company Logo"
            className="company-logo"
          />
        </div>
      </div>

      <div className="tech-stack-tab">
        <div className="tech-stack-title">
          <p>Technology Stack</p>
        </div>
        <div className="tech-stack-list">
          <ul className="tech-stack-items">
            <li>
              <img
                src="/assets/techStackIcons/mongodb-logo.png"
                alt="MongoDB"
              />
            </li>
            <li>
              <img
                src="/assets/techStackIcons/express-logo.png"
                alt="Express.js"
              />
            </li>
            <li>
              <img src="/assets/techStackIcons/react-logo.png" alt="React" />
            </li>
            <li>
              <img src="/assets/techStackIcons/nodejs-logo.png" alt="Node.js" />
            </li>
            <li>
              <img src="/assets/techStackIcons/vite-logo.png" alt="Vite" />
            </li>
          </ul>
        </div>
      </div>

      <div className="contact-support-tab">
        <div className="contact-support-title">
          <p>Contact & Support</p>
        </div>
        <div className="email-support">
          <p>
            Email: <a href="mailto:ict@aceserph.com">ict@aceserph.com</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutSettings;
