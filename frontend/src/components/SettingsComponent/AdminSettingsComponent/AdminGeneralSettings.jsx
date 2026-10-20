import { useContext, useState } from "react";
import { IconCancel, IconEdit } from "@tabler/icons-react";
import { UserContext } from "../../../context/UserContext";
import API from "../../../api";
import ProfilePhotoEditor from "../../Profile/ProfilePhotoEditor";
import ProfileForm from "../../Profile/ProfileForm.jsx";
import {
  toProfileForm,
  setField,
  toProfilePayload,
} from "../../Profile/profileForm.js";
import ConfirmModal from "../../Modals/Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Modals/Confirmed/ConfirmedMessageModal";
import "../SettingsComponent.css";

const emptyGeneral = {
  companyName: "",
  companyLogo: "",
  companyContact: "",
  dateFormat: "",
  timeFormat: "",
};

// Company and display settings, kept here until they move to their own tab
const COMPANY_FIELDS = [
  { name: "companyName", label: "Company Name" },
  { name: "companyLogo", label: "Company Logo", type: "file" },
  { name: "companyContact", label: "Company Contact" },
];
const FORMAT_FIELDS = [
  { name: "dateFormat", label: "Date Format" },
  { name: "timeFormat", label: "Time Format" },
];

const AdminGeneralSettings = () => {
  const { userData, updateUserDataLocally } = useContext(UserContext);

  const [form, setForm] = useState(() => toProfileForm(userData));
  const [general, setGeneral] = useState(() => ({
    ...emptyGeneral,
    ...(userData?.settings?.general || {}),
  }));
  const [isEditing, setIsEditing] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSavedOpen, setIsSavedOpen] = useState(false);

  const handleChange = (name, value) => {
    setForm((prev) => setField(prev, name, value));
    setIsChanged(true);
  };

  const handleGeneralChange = (event) => {
    const { name, value } = event.target;
    setGeneral((prev) => ({ ...prev, [name]: value }));
    setIsChanged(true);
  };

  const resetForm = () => {
    setForm(toProfileForm(userData));
    setGeneral({ ...emptyGeneral, ...(userData?.settings?.general || {}) });
    setIsChanged(false);
  };

  const toggleEdit = () => {
    if (isEditing) resetForm();
    setIsEditing(!isEditing);
  };

  const handleCancel = () => {
    resetForm();
    setIsEditing(false);
  };

  const handleConfirmSave = async () => {
    try {
      const { data } = await API.put(
        `/api/settings/updateGeneralSettings/${userData._id}`,
        { ...toProfilePayload(form), settings: { general } },
      );
      updateUserDataLocally({
        email: data.email,
        employee: data.employee,
        settings: data.settings,
      });
      setIsEditing(false);
      setIsChanged(false);
      setIsConfirmOpen(false);
      setTimeout(() => setIsSavedOpen(true), 300);
    } catch (error) {
      console.error("Error editing profile:", error);
    }
  };

  const renderGeneralField = ({ name, label, type = "text" }) => (
    <div className="input-container" key={name}>
      <div className="label-container">
        <label htmlFor={`general-${name}`}>{label}</label>
      </div>
      <div className="input-group-signup">
        <input
          id={`general-${name}`}
          type={type}
          name={name}
          accept={type === "file" ? "image/*" : undefined}
          placeholder={isEditing ? `Enter ${label}` : ""}
          value={type === "file" ? undefined : general[name] || ""}
          onChange={handleGeneralChange}
          disabled={!isEditing}
        />
      </div>
    </div>
  );

  const fullName =
    `${userData?.employee?.firstName ?? ""} ${userData?.employee?.lastName ?? ""}`.trim();

  return (
    <div className="settings-content">
      <div className="settings-profile">
        <div className="profile-section">
          <ProfilePhotoEditor />
          <div className="profile-details">
            <p className="profile-name">{fullName}</p>
            <p className="profile-role">{userData?.role}</p>
          </div>
        </div>

        <button className="btn setting-edit-button" onClick={toggleEdit}>
          {isEditing ? <IconCancel stroke={2} /> : <IconEdit stroke={2} />}
          {isEditing ? "Cancel" : "Edit Profile"}
        </button>
      </div>

      <ProfileForm form={form} onChange={handleChange} disabled={!isEditing} />

      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Company Information</p>
        </div>
        {renderGeneralField(COMPANY_FIELDS[0])}
        <div className="input-row">
          {COMPANY_FIELDS.slice(1).map(renderGeneralField)}
        </div>
      </div>

      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Time & Date Settings</p>
        </div>
        <div className="input-row">{FORMAT_FIELDS.map(renderGeneralField)}</div>
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
          onClick={handleCancel}
          disabled={!isChanged}
        >
          Cancel
        </button>
      </div>

      {isConfirmOpen && (
        <ConfirmModal
          title="Confirm Changes"
          message="Are you sure you want to save changes?"
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleConfirmSave}
        />
      )}

      {isSavedOpen && (
        <ConfirmedMessageModal
          message="Save changes successfully."
          onClose={() => setIsSavedOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminGeneralSettings;
