import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IconArrowLeft,
  IconBriefcase,
  IconCancel,
  IconEdit,
  IconShieldLock,
} from "@tabler/icons-react";
import API from "../../api";
import ProfilePhoto from "../../components/ProfilePhoto/ProfilePhoto";
import ProfileView from "../../components/Profile/ProfileView";
import ProfileHeader from "../../components/Profile/ProfileHeader";
import ProfileForm from "../../components/Profile/ProfileForm.jsx";
import {
  toProfileForm,
  setField,
} from "../../components/Profile/profileForm.js";
import EditEmployeeModal from "../../components/Modals/EditEmployee/EditEmployeeModal";
import ManageAccessModal from "../../components/Modals/ManageAccess/ManageAccessModal";
import ConfirmModal from "../../components/Modals/Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../components/Modals/Confirmed/ConfirmedMessageModal";
import "../../components/SettingsComponent/SettingsComponent.css";
import "../../styles/AdminCSS/EmployeeProfile.css";

const EmployeeProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [access, setAccess] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSavedOpen, setIsSavedOpen] = useState(false);
  const [isEmploymentOpen, setIsEmploymentOpen] = useState(false);
  const [isAccessOpen, setIsAccessOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await API.get(`/api/employee/employees/${userId}`);
      setProfile(data);
      setErrorMessage("");
    } catch (error) {
      // Deleted from the Edit Employee modal, or a bad link
      if (error.response?.status === 404) {
        navigate("/employees", { replace: true });
        return;
      }
      setErrorMessage(
        error.response?.data?.message || "Could not load this employee.",
      );
    }
  }, [userId, navigate]);

  const loadAccess = useCallback(async () => {
    try {
      const { data } = await API.get(`/api/access/users/${userId}`);
      setAccess(data);
    } catch {
      setAccess(null);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
    loadAccess();
  }, [loadProfile, loadAccess]);

  if (!profile) {
    return (
      <div className="main-content employee-profile-page">
        <p>{errorMessage || "Loading..."}</p>
      </div>
    );
  }

  const employee = profile.employee || {};
  const fullName =
    `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() ||
    profile.username;
  const job = profile.jobDescription;
  const subtitle = [job.designation, job.department]
    .filter(Boolean)
    .join(" · ");

  // The shape EditEmployeeModal expects (same as a row from the Employees list)
  const modalEmployee = {
    _id: profile._id,
    username: profile.username,
    email: profile.email,
    employeeId: employee.employeeId || "",
    firstName: employee.firstName || "",
    lastName: employee.lastName || "",
    gender: employee.gender || "",
    jobDescription: job,
  };

  const startEditing = () => {
    setForm(toProfileForm(profile));
    setIsChanged(false);
    setIsEditing(true);
  };

  const stopEditing = () => {
    setIsEditing(false);
    setIsChanged(false);
  };

  const handleChange = (name, value) => {
    setForm((prev) => setField(prev, name, value));
    setIsChanged(true);
  };

  const handleConfirmSave = async () => {
    try {
      await API.put(`/api/employee/edit-employee-via-admin/${userId}`, {
        ...form,
        birthday: form.birthday || null,
      });
      await loadProfile();
      stopEditing();
      setIsConfirmOpen(false);
      setTimeout(() => setIsSavedOpen(true), 300);
    } catch (error) {
      setIsConfirmOpen(false);
      setErrorMessage(
        error.response?.data?.message || "Could not save the changes.",
      );
    }
  };

  return (
    <div className="main-content employee-profile-page">
      <button
        type="button"
        className="profile-back"
        onClick={() => navigate("/employees")}
      >
        <IconArrowLeft stroke={2} size={18} />
        Back to Employees
      </button>

      <ProfileHeader
        photo={<ProfilePhoto size="88px" photo={profile.profilePhoto || ""} />}
        name={fullName}
        subtitle={subtitle}
        badges={[
          { label: employee.employeeId },
          { label: job.employmentType },
          {
            label: profile.status,
            className: `status-${String(profile.status).toLowerCase()}`,
          },
        ]}
      >
        <button
          type="button"
          className="btn"
          onClick={isEditing ? stopEditing : startEditing}
        >
          {isEditing ? <IconCancel stroke={2} /> : <IconEdit stroke={2} />}
          {isEditing ? "Cancel" : "Edit profile"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setIsEmploymentOpen(true)}
          disabled={isEditing}
        >
          <IconBriefcase stroke={2} />
          Edit employment
        </button>
      </ProfileHeader>

      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {isEditing ? (
        <div className="settings-content profile-edit">
          <ProfileForm form={form} onChange={handleChange} disabled={false} />
          <div className="settings-button-option-container">
            <button
              className={`btn settings-button-option ${!isChanged ? "disabled" : ""}`}
              onClick={() => setIsConfirmOpen(true)}
              disabled={!isChanged}
            >
              Save
            </button>
            <button
              className="btn settings-button-option"
              onClick={stopEditing}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <ProfileView
          profile={toProfileForm(profile)}
          employment={{ ...job, employeeId: employee.employeeId }}
        />
      )}

      <section className="profile-card access-card">
        <div className="access-card-header">
          <h4 className="profile-card-title">Page Access</h4>
          <button
            type="button"
            className="btn"
            onClick={() => setIsAccessOpen(true)}
          >
            <IconShieldLock stroke={2} />
            Manage access
          </button>
        </div>
        {access ? (
          <>
            <p className="access-summary">
              {access.customized
                ? "Customized by an admin"
                : "Default access for employees"}
            </p>
            <div className="access-chips">
              {access.pages.map((page) => {
                const on = access.allowedPages.includes(page.key);
                return (
                  <span
                    key={page.key}
                    className={`access-chip ${on ? "on" : "off"}`}
                  >
                    {page.label}
                    {page.locked ? " (always)" : on ? "" : " (off)"}
                  </span>
                );
              })}
            </div>
          </>
        ) : (
          <p className="access-summary">Could not load page access.</p>
        )}
      </section>

      {isConfirmOpen && (
        <ConfirmModal
          title="Confirm Changes"
          message={`Save the changes to ${fullName}'s profile?`}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleConfirmSave}
        />
      )}

      {isSavedOpen && (
        <ConfirmedMessageModal
          message="Profile updated successfully."
          onClose={() => setIsSavedOpen(false)}
        />
      )}

      {isEmploymentOpen && (
        <EditEmployeeModal
          employee={modalEmployee}
          onClose={() => setIsEmploymentOpen(false)}
          onUpdateEmployee={loadProfile}
        />
      )}

      {isAccessOpen && (
        <ManageAccessModal
          employee={{ ...employee, _id: userId }}
          onClose={() => {
            setIsAccessOpen(false);
            loadAccess();
          }}
        />
      )}
    </div>
  );
};

export default EmployeeProfile;
