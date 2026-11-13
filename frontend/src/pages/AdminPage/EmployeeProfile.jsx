import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IconArrowLeft,
  IconBriefcase,
  IconCancel,
  IconEdit,
  IconShieldLock,
  IconUserCheck,
  IconUserOff,
} from "@tabler/icons-react";
import API from "../../api";
import ProfilePhoto from "../../components/ProfilePhoto/ProfilePhoto";
import ProfileView, {
  Card,
  EMPTY,
  Field,
} from "../../components/Profile/ProfileView";
import { daysText, monthName } from "../../utils/leaveCredits";
import { isAdminRole } from "../../utils/roles";
import {
  canDeleteEmployee,
  canLoad,
  canSeeThirteenthMonth,
  isOwnLinkedEmployee,
  OWN_RECORD_NOTE,
} from "../../utils/pageAccess";
import { isPayHidden } from "../../utils/payVisibility";
import { UserContext } from "../../context/UserContext";
import { EmployeeContext } from "../../context/EmployeeContext";
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
import ResignEmployeeModal from "../../components/Modals/Resign/ResignEmployeeModal";
import ThirteenthMonthCard from "../../components/ThirteenthMonth/ThirteenthMonthCard";
import "../../components/SettingsComponent/SettingsComponent.css";
import "../../styles/AdminCSS/EmployeeProfile.css";

const MEMBER_ROLE_LABELS = {
  ProjectInCharge: "In-charge",
  DocumentController: "Document Controller",
};

const EmployeeProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { userData } = useContext(UserContext);
  const { reloadEmployees } = useContext(EmployeeContext);

  const [profile, setProfile] = useState(null);
  const [access, setAccess] = useState(null);
  // The server refused the Page Access read (403: the tick was taken away after
  // this sign-in loaded); the card is hidden instead of reading "Could not load"
  const [accessRefused, setAccessRefused] = useState(false);
  const [credits, setCredits] = useState(null);
  const [logisticsProjects, setLogisticsProjects] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSavedOpen, setIsSavedOpen] = useState(false);
  const [isEmploymentOpen, setIsEmploymentOpen] = useState(false);
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const [isResignOpen, setIsResignOpen] = useState(false);
  const [isReinstateOpen, setIsReinstateOpen] = useState(false);
  const [doneMessage, setDoneMessage] = useState("");

  // Each request below is sent only with the tick its server route needs
  // (utils/pageAccess.js, canLoad): Page Access "employee-access", Leave Credits
  // "admin-filing", Logistics projects any Logistics tick. Delete Employee is the
  // main account's only.
  const canLoadAccess = canLoad(userData, "pageAccess");
  const canLoadCredits = canLoad(userData, "leaveCredits");
  const canLoadProjects = canLoad(userData, "logisticsProjects");
  const showAccess = canLoadAccess && !accessRefused;
  const canDelete = canDeleteEmployee(userData);
  // An Admin's own linked employee: the server refuses every change, so no buttons
  const isOwnRecord = isOwnLinkedEmployee(userData, userId);

  const loadProfile = useCallback(async () => {
    // Not found: back to the Employees list, as for a deleted employee
    const leaveProfile = () => navigate("/employees", { replace: true });

    try {
      const { data } = await API.get(`/api/employee/employees/${userId}`);
      // Super Admin and Admin accounts are not employees; the server already
      // answers 404 for them, this only guards against a stale response
      if (isAdminRole(data.role)) {
        leaveProfile();
        return;
      }
      setProfile(data);
      setErrorMessage("");
    } catch (error) {
      // Deleted from the Edit Employee modal, a hidden account, or a bad link
      if (error.response?.status === 404) {
        leaveProfile();
        return;
      }
      setErrorMessage(
        error.response?.data?.message || "Could not load this employee.",
      );
    }
  }, [userId, navigate]);

  const loadAccess = useCallback(async () => {
    if (!canLoadAccess) {
      setAccess(null);
      return;
    }
    try {
      const { data } = await API.get(`/api/access/users/${userId}`);
      setAccess(data);
      setAccessRefused(false);
    } catch (error) {
      setAccess(null);
      setAccessRefused(error.response?.status === 403);
    }
  }, [userId, canLoadAccess]);

  const loadCredits = useCallback(async () => {
    if (!canLoadCredits) {
      setCredits(null);
      return;
    }
    try {
      const { data } = await API.get(`/api/filing/leave-credits/${userId}`);
      setCredits(data);
    } catch {
      setCredits(null);
    }
  }, [userId, canLoadCredits]);

  // "ACE01 (In-charge), ACE02 (Document Controller)"; hidden without a Logistics
  // tick or when the request fails
  const loadLogisticsProjects = useCallback(async () => {
    if (!canLoadProjects) {
      setLogisticsProjects(null);
      return;
    }
    try {
      const { data } = await API.get("/api/logistics/projects", {
        params: { memberId: userId },
      });
      setLogisticsProjects(
        data.length
          ? data
              .map(
                (project) =>
                  `${project.code} (${MEMBER_ROLE_LABELS[project.memberRole] || project.memberRole})`,
              )
              .join(", ")
          : EMPTY,
      );
    } catch {
      setLogisticsProjects(null);
    }
  }, [userId, canLoadProjects]);

  useEffect(() => {
    loadProfile();
    loadAccess();
    loadCredits();
    loadLogisticsProjects();
  }, [loadProfile, loadAccess, loadCredits, loadLogisticsProjects]);

  if (!profile) {
    return (
      <div className="main-content employee-profile-page">
        {errorMessage ? (
          <p className="feedback-message error">{errorMessage}</p>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    );
  }

  const employee = profile.employee || {};
  const fullName =
    `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() ||
    profile.username;
  const job = profile.jobDescription;
  const isResigned = profile.status === "Resigned";
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

  const handleResigned = async () => {
    setIsResignOpen(false);
    await loadProfile();
    setTimeout(() => setDoneMessage(`${fullName} is marked as resigned.`), 300);
  };

  const handleReinstate = async () => {
    setIsReinstateOpen(false);
    try {
      await API.patch(`/api/employee/employees/${userId}/reinstate`);
      await loadProfile();
      setTimeout(() => setDoneMessage(`${fullName} is active again.`), 300);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Could not reinstate.");
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
        {!isOwnRecord && (
          <>
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

            {isResigned ? (
              <button
                type="button"
                className="btn"
                onClick={() => setIsReinstateOpen(true)}
                disabled={isEditing}
              >
                <IconUserCheck stroke={2} />
                Reinstate
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={() => setIsResignOpen(true)}
                disabled={isEditing}
              >
                <IconUserOff stroke={2} />
                Mark as resigned
              </button>
            )}
          </>
        )}
      </ProfileHeader>

      {isOwnRecord && <p className="feedback-message">{OWN_RECORD_NOTE}</p>}

      {errorMessage && <p className="feedback-message error">{errorMessage}</p>}

      {isEditing && !isOwnRecord ? (
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
          ownerId={profile._id}
          employment={{
            ...job,
            employeeId: employee.employeeId,
            employmentType: isResigned ? "Resigned" : job.employmentType,
            logisticsProjects,
          }}
        />
      )}

      <div className="profile-grid">
        {credits && (
          <Card title="Leave Credits">
            <Field
              label="Vacation Leave left"
              value={daysText(credits.vacation.available)}
            />
            <Field
              label="VL earned, used, pending"
              value={`${credits.vacation.earned}, ${credits.vacation.used}, ${credits.vacation.pending}`}
            />
            <Field
              label={`Sick Leave left (${monthName(credits.sick.month)})`}
              value={daysText(credits.sick.available)}
            />
            <Field
              label="VL opening balance"
              value={daysText(job.vacationLeaveOpening || 0)}
            />
          </Card>
        )}

        {/* With the 13th month tick only (the Super Admin always). Amounts come
            from the server; pay hidden from this Admin stays Restricted. */}
        {canSeeThirteenthMonth(userData) && (
          <ThirteenthMonthCard
            userId={userId}
            refreshKey={profile}
            payHidden={isPayHidden(job)}
          />
        )}
      </div>

      {showAccess && (
        <section className="profile-card access-card">
          <div className="access-card-header">
            <h4 className="profile-card-title">Page Access</h4>
            {!isOwnRecord && (
              <button
                type="button"
                className="btn"
                onClick={() => setIsAccessOpen(true)}
              >
                <IconShieldLock stroke={2} />
                Manage access
              </button>
            )}
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
      )}

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

      {isEmploymentOpen && !isOwnRecord && (
        <EditEmployeeModal
          employee={modalEmployee}
          canDelete={canDelete}
          onClose={() => setIsEmploymentOpen(false)}
          onUpdateEmployee={() => {
            loadProfile();
            loadCredits();
            // Saving a basic pay clears "Pay needs an update" in the shared list too
            reloadEmployees();
          }}
        />
      )}

      {isResignOpen && !isOwnRecord && (
        <ResignEmployeeModal
          userId={userId}
          name={fullName}
          onClose={() => setIsResignOpen(false)}
          onResigned={handleResigned}
        />
      )}

      {isReinstateOpen && !isOwnRecord && (
        <ConfirmModal
          title="Reinstate Employee"
          message={`Reinstate ${fullName}? They will be able to log in again, and the resignation date and reason are cleared.`}
          onClose={() => setIsReinstateOpen(false)}
          onConfirm={handleReinstate}
          confirmText="Yes, Reinstate"
          cancelText="No"
        />
      )}

      {doneMessage && (
        <ConfirmedMessageModal
          message={doneMessage}
          onClose={() => setDoneMessage("")}
        />
      )}

      {showAccess && !isOwnRecord && isAccessOpen && (
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
