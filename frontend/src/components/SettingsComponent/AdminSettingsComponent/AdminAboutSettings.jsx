import React from "react";
import "../SettingsComponent.css";

const AdminAboutSettings = () => {
  return (
    <div className="settings-content">
      <div className="about-title-tab">
        <div className="about-title">
          <p>ACESER Employee & Administrative Management System</p>
        </div>
        <div className="about-description">
          <p>Ver 1.0.0</p>
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
                alt="Express"
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

      <div className="company-info-tab">
        <div className="company-info-title">
          <p>Company Information</p>
        </div>
        <div className="company-description">
          <div className="logo-container">
            <img
              src="/assets/aceser-logo.png"
              alt="Company Logo"
              className="about-company-logo"
            />
          </div>
          <div className="company-tagline">
            Building Dreams, Building Nation
          </div>
          <p>
            {`ACESER Corporation was established as ACDI's construction arm,
            capable of handling both vertical and horizontal projects. Today, it 
            has grown into a full-service construction company specializing in
            building construction, renovation, project management, architectural
            and engineering design, renewable energy solutions, and custom
            furniture and fit-outs.`}
          </p>
        </div>
      </div>

      <div className="credit-tab">
        <div className="credit-company-name">
          <p>ACESER Corporation</p>
        </div>

        <div className="credit-author-name">
          <p>
            Created By: <b>Iverson Nacionales</b>
          </p>
        </div>

        <div className="credit-copyright">
          <p>Copyright (c) 2026, ACESER Corporation. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminAboutSettings;
