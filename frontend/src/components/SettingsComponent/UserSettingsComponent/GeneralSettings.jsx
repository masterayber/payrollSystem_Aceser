import { useContext, useState } from "react";
import { IconCancel, IconEdit } from "@tabler/icons-react";
import { UserContext } from "../../../context/UserContext";
import { roleLabel } from "../../../utils/roles";
import { accountName } from "../../../utils/adminAccounts";
import PropTypes from "prop-types";
import API from "../../../api";
import ProfilePhotoEditor from "../../Profile/ProfilePhotoEditor";
import ProfileForm from "../../Profile/ProfileForm.jsx";
import ProfileView from "../../Profile/ProfileView.jsx";
import ProfileHeader from "../../Profile/ProfileHeader.jsx";
import {
  toProfileForm,
  setField,
  toProfilePayload,
  isAccountOnly,
  toAccountPayload,
  checkAccountForm,
} from "../../Profile/profileForm.js";
import PasswordSettings from "./PasswordSettings";
import ConfirmModal from "../../Modals/Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Modals/Confirmed/ConfirmedMessageModal";
import "../SettingsComponent.css";

// `showPassword`: the signed-in account's own Password section at the bottom, while
// the profile is not being edited (admin Settings; employees keep it on Manage).
// An Admin account (no employee record) shows and saves only its names and email.
const GeneralSettings = ({ showEmployment = true, showPassword = false }) => {
  const { userData, updateUserDataLocally } = useContext(UserContext);
  const accountOnly = isAccountOnly(userData);

  const [form, setForm] = useState(() => toProfileForm(userData));
  const [isEditing, setIsEditing] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSavedOpen, setIsSavedOpen] = useState(false);
  // { type: "warning" | "error", text } above Save: a form check or a server refusal
  const [message, setMessage] = useState(null);

  const handleChange = (name, value) => {
    setForm((prev) => setField(prev, name, value));
    setIsChanged(true);
    setMessage(null);
  };

  const resetForm = () => {
    setForm(toProfileForm(userData));
    setIsChanged(false);
    setMessage(null);
  };

  // An Admin account's form is checked before the confirm box opens
  const handleSaveClick = () => {
    const problem = accountOnly ? checkAccountForm(form) : "";
    if (problem) {
      setMessage({ type: "warning", text: problem });
      return;
    }
    setMessage(null);
    setIsConfirmOpen(true);
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
        accountOnly ? toAccountPayload(form) : toProfilePayload(form),
      );
      // Merge, so allowedPages, attendance and the rest of the login data survive.
      // A gender change can switch a default icon, so take the photo the server set.
      // An Admin account takes the names saved on the account; its empty `employee`
      // in the reply is not merged, so it cannot hide those names.
      const updates = accountOnly
        ? {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
          }
        : { email: data.email, employee: data.employee };
      updateUserDataLocally({
        ...updates,
        ...(data.profilePhoto ? { profilePhoto: data.profilePhoto } : {}),
      });
      // The next Edit starts from what the server saved (trimmed)
      setForm(toProfileForm({ ...userData, ...updates }));
      setIsEditing(false);
      setIsChanged(false);
      setIsConfirmOpen(false);
      setTimeout(() => setIsSavedOpen(true), 300);
    } catch (error) {
      console.error("Error editing profile:", error);
      setIsConfirmOpen(false);
      const refusal =
        error.response?.data?.message || "Could not save the changes.";
      // An Admin account sees the server's words on the form; the others keep the popup
      if (accountOnly) setMessage({ type: "error", text: refusal });
      else alert(refusal);
    }
  };

  const job = userData?.settings?.general?.jobDescription || {};
  const employment = { ...job, employeeId: userData?.employee?.employeeId };

  // Employees see their job under their name; admins see their role
  const subtitle = showEmployment
    ? [job.designation, job.department].filter(Boolean).join(" · ")
    : roleLabel(userData?.role);
  const badges = [
    ...(showEmployment
      ? [{ label: employment.employeeId }, { label: job.employmentType }]
      : []),
    {
      label: userData?.status,
      className: `status-${String(userData?.status).toLowerCase()}`,
    },
  ];

  return (
    <div className="settings-content">
      <ProfileHeader
        photo={<ProfilePhotoEditor />}
        name={accountName(userData)}
        subtitle={subtitle}
        badges={badges}
      >
        <button className="btn setting-edit-button" onClick={toggleEdit}>
          {isEditing ? <IconCancel stroke={2} /> : <IconEdit stroke={2} />}
          {isEditing ? "Cancel" : "Edit Profile"}
        </button>
      </ProfileHeader>

      {isEditing ? (
        <>
          <ProfileForm
            form={form}
            onChange={handleChange}
            accountOnly={accountOnly}
          />

          {message && (
            <p className={`feedback-message ${message.type}`} role="alert">
              {message.text}
            </p>
          )}

          <div className="settings-button-option-container">
            <button
              className={`btn settings-button-option ${!isChanged ? "disabled" : ""}`}
              onClick={handleSaveClick}
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
        </>
      ) : (
        <div className={showPassword ? "setting-tab" : undefined}>
          <ProfileView
            profile={toProfileForm(userData)}
            ownerId={userData?._id}
            employment={showEmployment ? employment : undefined}
            accountOnly={accountOnly}
            username={userData?.username}
          />
          {/* The account's own password, below the profile (spaced by setting-tab) */}
          {showPassword && <PasswordSettings />}
        </div>
      )}

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

export default GeneralSettings;

GeneralSettings.propTypes = {
  showEmployment: PropTypes.bool,
  showPassword: PropTypes.bool,
};
