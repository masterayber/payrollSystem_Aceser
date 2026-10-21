import { useContext, useState } from "react";
import { IconCancel, IconEdit } from "@tabler/icons-react";
import { UserContext } from "../../../context/UserContext";
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
} from "../../Profile/profileForm.js";
import ConfirmModal from "../../Modals/Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Modals/Confirmed/ConfirmedMessageModal";
import "../SettingsComponent.css";

const GeneralSettings = ({ showEmployment = true }) => {
  const { userData, updateUserDataLocally } = useContext(UserContext);

  const [form, setForm] = useState(() => toProfileForm(userData));
  const [isEditing, setIsEditing] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSavedOpen, setIsSavedOpen] = useState(false);

  const handleChange = (name, value) => {
    setForm((prev) => setField(prev, name, value));
    setIsChanged(true);
  };

  const resetForm = () => {
    setForm(toProfileForm(userData));
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
        toProfilePayload(form),
      );
      // Merge, so allowedPages, attendance and the rest of the login data survive
      updateUserDataLocally({ email: data.email, employee: data.employee });
      setIsEditing(false);
      setIsChanged(false);
      setIsConfirmOpen(false);
      setTimeout(() => setIsSavedOpen(true), 300);
    } catch (error) {
      console.error("Error editing profile:", error);
    }
  };

  const fullName =
    `${userData?.employee?.firstName ?? ""} ${userData?.employee?.lastName ?? ""}`.trim();

  const job = userData?.settings?.general?.jobDescription || {};
  const employment = { ...job, employeeId: userData?.employee?.employeeId };

  // Employees see their job under their name; admins see their role
  const subtitle = showEmployment
    ? [job.designation, job.department].filter(Boolean).join(" · ")
    : userData?.role;
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
        name={fullName || userData?.username}
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
          <ProfileForm form={form} onChange={handleChange} />

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
        </>
      ) : (
        <ProfileView
          profile={toProfileForm(userData)}
          employment={showEmployment ? employment : undefined}
        />
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
};
