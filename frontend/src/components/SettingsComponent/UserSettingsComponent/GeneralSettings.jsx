import { useContext, useState } from "react";
import { IconCancel, IconEdit } from "@tabler/icons-react";
import { UserContext } from "../../../context/UserContext";
import API from "../../../api";
import ProfilePhotoEditor from "../../Profile/ProfilePhotoEditor";
import ProfileForm from "../../Profile/ProfileForm.jsx";
import ProfileView from "../../Profile/ProfileView.jsx";
import {
  toProfileForm,
  setField,
  toProfilePayload,
} from "../../Profile/profileForm.js";
import ConfirmModal from "../../Modals/Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Modals/Confirmed/ConfirmedMessageModal";

const GeneralSettings = () => {
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
        { ...toProfilePayload(form), settings: {} },
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

  const employment = {
    ...(userData?.settings?.general?.jobDescription || {}),
    employeeId: userData?.employee?.employeeId,
  };

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
          employment={employment}
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
