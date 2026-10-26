import { useEffect, useRef, useState } from "react";
import { IconCancel, IconEdit } from "@tabler/icons-react";
import API from "../../../api";
import Dropdown from "../../Dropdown/Dropdown";
import { Card, Field } from "../../Profile/ProfileView.jsx";
import ConfirmModal from "../../Modals/Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Modals/Confirmed/ConfirmedMessageModal";
import "../../Profile/Profile.css";
import "../SettingsComponent.css";

// Must match the enums in backend/models/companySettings.js
const DATE_FORMATS = ["MM-DD-YYYY", "DD-MM-YYYY", "YYYY-MM-DD"];
const TIME_FORMATS = ["12 Hour", "24 Hour"];
const LOGO_TYPES = "image/png,image/jpeg,image/webp,image/gif";
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

const toForm = (company) => ({
  name: company?.name || "",
  contact: company?.contact || "",
  dateFormat: company?.dateFormat || DATE_FORMATS[0],
  timeFormat: company?.timeFormat || TIME_FORMATS[0],
});

// Company-wide settings, one record shared by every admin
const AdminCompanySettings = () => {
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState(() => toForm(null));
  const [isEditing, setIsEditing] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    API.get("/api/settings/company")
      .then(({ data }) => {
        setCompany(data);
        setForm(toForm(data));
      })
      .catch(() => setErrorMessage("Could not load the company settings."));
  }, []);

  const showSaved = (message) => {
    setErrorMessage("");
    setTimeout(() => setSavedMessage(message), 300);
  };

  const showError = (error, fallback) =>
    setErrorMessage(error.response?.data?.message || fallback);

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setIsChanged(true);
  };

  const toggleEdit = () => {
    setForm(toForm(company));
    setIsChanged(false);
    setErrorMessage("");
    setIsEditing(!isEditing);
  };

  const handleConfirmSave = async () => {
    setIsConfirmOpen(false);
    try {
      const { data } = await API.put("/api/settings/company", form);
      setCompany(data);
      setIsEditing(false);
      setIsChanged(false);
      showSaved("Company settings saved.");
    } catch (error) {
      showError(error, "Could not save the changes.");
    }
  };

  // The logo saves straight away, like the profile photo, not with the Save button
  const handleLogoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // so choosing the same file again still triggers
    if (!file) return;

    if (file.size > MAX_LOGO_SIZE) {
      setErrorMessage("The logo must be 2 MB or smaller");
      return;
    }

    const body = new FormData();
    body.append("logo", file);
    try {
      const { data } = await API.put("/api/settings/company/logo", body);
      setCompany(data);
      showSaved("Logo updated.");
    } catch (error) {
      showError(error, "Could not upload the logo.");
    }
  };

  const handleLogoRemove = async () => {
    try {
      const { data } = await API.delete("/api/settings/company/logo");
      setCompany(data);
      showSaved("Logo removed.");
    } catch (error) {
      showError(error, "Could not remove the logo.");
    }
  };

  const renderInput = (name, label) => (
    <div className="input-container">
      <div className="label-container">
        <label htmlFor={`company-${name}`}>{label}</label>
      </div>
      <div className="input-group-signup">
        <input
          id={`company-${name}`}
          type="text"
          placeholder={`Enter ${label}`}
          value={form[name]}
          onChange={(event) => handleChange(name, event.target.value)}
        />
      </div>
    </div>
  );

  const renderDropdown = (name, label, options) => (
    <div className="input-container">
      <div className="label-container">
        <label>{label}</label>
      </div>
      <Dropdown
        options={options}
        value={form[name]}
        onSelect={(value) => handleChange(name, value)}
      />
    </div>
  );

  if (!company) {
    return (
      <div className="settings-content">
        {errorMessage ? (
          <p className="feedback-message error">{errorMessage}</p>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    );
  }

  return (
    <div className="settings-content">
      <div className="settings-profile">
        <div className="profile-section">
          <div className="company-logo-preview">
            {company.logo ? (
              <img
                src={`http://localhost:5000${company.logo}`}
                alt="Company logo"
              />
            ) : (
              <span>No logo</span>
            )}
          </div>
          <div className="profile-details">
            <p className="profile-name">
              {company.name || "Company name not set"}
            </p>
            <div className="company-logo-actions">
              <button
                type="button"
                className="btn settings-button-option"
                onClick={() => fileInputRef.current?.click()}
              >
                {company.logo ? "Change logo" : "Upload logo"}
              </button>
              {company.logo && (
                <button
                  type="button"
                  className="btn settings-button-option"
                  onClick={handleLogoRemove}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <button className="btn setting-edit-button" onClick={toggleEdit}>
          {isEditing ? <IconCancel stroke={2} /> : <IconEdit stroke={2} />}
          {isEditing ? "Cancel" : "Edit Company"}
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        hidden
        accept={LOGO_TYPES}
        onChange={handleLogoChange}
      />

      {errorMessage && <p className="feedback-message error">{errorMessage}</p>}

      {isEditing ? (
        <>
          <div className="setting-tab">
            <div className="setting-tab-title">
              <p>Company Information</p>
            </div>
            <div className="input-row">
              {renderInput("name", "Company Name")}
              {renderInput("contact", "Company Contact")}
            </div>
          </div>

          <div className="setting-tab">
            <div className="setting-tab-title">
              <p>Time & Date Settings</p>
            </div>
            <div className="input-row">
              {renderDropdown("dateFormat", "Date Format", DATE_FORMATS)}
              {renderDropdown("timeFormat", "Time Format", TIME_FORMATS)}
            </div>
          </div>

          <div className="settings-button-option-container">
            <button
              className={`btn settings-button-option ${!isChanged ? "disabled" : ""}`}
              onClick={() => setIsConfirmOpen(true)}
              disabled={!isChanged}
            >
              Save
            </button>
            <button
              className={`btn settings-button-option ${!isChanged ? "disabled" : ""}`}
              onClick={toggleEdit}
              disabled={!isChanged}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="profile-grid">
          <Card title="Company Information">
            <Field label="Company name" value={company.name} />
            <Field label="Company contact" value={company.contact} />
          </Card>
          <Card title="Time & Date Settings">
            <Field label="Date format" value={company.dateFormat} />
            <Field label="Time format" value={company.timeFormat} />
          </Card>
        </div>
      )}

      {isConfirmOpen && (
        <ConfirmModal
          title="Confirm Changes"
          message="Save the company settings? They apply to everyone."
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleConfirmSave}
        />
      )}

      {savedMessage && (
        <ConfirmedMessageModal
          message={savedMessage}
          onClose={() => setSavedMessage("")}
        />
      )}
    </div>
  );
};

export default AdminCompanySettings;
