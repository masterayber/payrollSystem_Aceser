import { useContext, useState } from "react";
import PropTypes from "prop-types";
import { IconEye, IconEyeClosed } from "@tabler/icons-react";
import { formatPeso } from "../../utils/money";
import { UserContext } from "../../context/UserContext";
import { isPayHidden, showsPayNotSetBadge } from "../../utils/payVisibility";
import Restricted from "../Restricted/Restricted";
import PayNotSetBadge from "../Restricted/PayNotSetBadge";
import "./Profile.css";

export const EMPTY = "—";

const formatDate = (value) => {
  if (!value) return EMPTY;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? EMPTY
    : date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};

export const Field = ({ label, value }) => (
  <div className="profile-field">
    <dt>{label}</dt>
    <dd>{value || EMPTY}</dd>
  </div>
);

Field.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
};

// A field that stays hidden until the eye button is pressed, like a password.
// `badge` (optional) shows after the value, e.g. "Pay needs an update".
export const SecretField = ({ label, value, badge }) => {
  const [isShown, setIsShown] = useState(false);
  const hasValue = Boolean(value) && value !== EMPTY;

  return (
    <div className="profile-field">
      <dt>{label}</dt>
      <dd className="profile-secret">
        <span>{!hasValue ? EMPTY : isShown ? value : "₱ •••••••"}</span>
        {hasValue && (
          <button
            type="button"
            className="profile-secret-toggle"
            aria-label={isShown ? `Hide ${label}` : `Show ${label}`}
            onClick={() => setIsShown(!isShown)}
          >
            {isShown ? (
              <IconEye stroke={2} size={18} />
            ) : (
              <IconEyeClosed stroke={2} size={18} />
            )}
          </button>
        )}
        {badge}
      </dd>
    </div>
  );
};

SecretField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  badge: PropTypes.node,
};

// A pay field this Admin may not see: "Restricted", with nothing to reveal
export const RestrictedField = ({ label }) => (
  <div className="profile-field">
    <dt>{label}</dt>
    <dd>
      <Restricted />
    </dd>
  </div>
);

RestrictedField.propTypes = {
  label: PropTypes.string.isRequired,
};

// `message` (optional) is a line shown in place of, or above, the fields (loading,
// not available, an error). `action` (optional) is a button on the right of the title.
export const Card = ({ title, message, action, children }) => (
  <section className="profile-card">
    {action ? (
      <div className="profile-card-header">
        <h4 className="profile-card-title">{title}</h4>
        {action}
      </div>
    ) : (
      <h4 className="profile-card-title">{title}</h4>
    )}
    {message && <div className="profile-card-message">{message}</div>}
    {children && <dl className="profile-fields">{children}</dl>}
  </section>
);

Card.propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.node,
  action: PropTypes.node,
  children: PropTypes.node,
};

// Read-only profile. `profile` has the shape toProfileForm returns; `employment`
// (optional) is a job description plus employeeId. `ownerId` (optional) is the user
// id of the person shown; "Pay needs an update" shows only when it is someone
// other than the signed-in viewer, never on a person's own profile.
// `accountOnly` (an Admin account, no employee record): one Personal Information card
// with the names, `username` (read-only) and the email; nothing else is stored.
const ProfileView = ({
  profile,
  employment,
  ownerId,
  accountOnly = false,
  username,
}) => {
  const { userData } = useContext(UserContext);

  if (accountOnly) {
    return (
      <div className="profile-grid">
        <Card title="Personal Information">
          <Field label="First name" value={profile.firstName} />
          <Field label="Last name" value={profile.lastName} />
          <Field label="Username" value={username} />
          <Field label="Email" value={profile.email} />
        </Card>
      </div>
    );
  }

  const address = profile.address || {};
  const emergency = profile.emergencyDetails || {};
  const emergencyName = [emergency.contactFirstName, emergency.contactLastName]
    .filter(Boolean)
    .join(" ");
  const schedule =
    employment?.schedule?.timeIn && employment?.schedule?.timeOut
      ? `${employment.schedule.timeIn} - ${employment.schedule.timeOut}`
      : "";

  return (
    <div className="profile-grid">
      <Card title="Personal Information">
        <Field label="First name" value={profile.firstName} />
        <Field label="Last name" value={profile.lastName} />
        <Field label="Email" value={profile.email} />
        <Field label="Contact number" value={profile.contactNumber} />
        <Field label="Birthday" value={formatDate(profile.birthday)} />
        <Field label="Gender" value={profile.gender} />
      </Card>

      {employment && (
        <Card title="Employment">
          <Field label="Employee ID" value={employment.employeeId} />
          <Field label="Employment type" value={employment.employmentType} />
          <Field label="Designation" value={employment.designation} />
          <Field label="Department" value={employment.department} />
          <Field label="Position" value={employment.position} />
          <Field label="Start date" value={formatDate(employment.startDate)} />
          <Field
            label="Date of regularization"
            value={formatDate(employment.regularizationDate)}
          />
          {isPayHidden(employment) ? (
            <RestrictedField label="Basic pay (monthly)" />
          ) : (
            <SecretField
              label="Basic pay (monthly)"
              value={formatPeso(employment.basicPay)}
              badge={
                showsPayNotSetBadge(employment, ownerId, userData?._id) ? (
                  <PayNotSetBadge />
                ) : null
              }
            />
          )}
          <Field label="Schedule" value={schedule} />

          {/* Admin profile only: where the person sits in the Logistics module */}
          {employment.logisticsProjects && (
            <Field
              label="Logistics projects"
              value={employment.logisticsProjects}
            />
          )}

          {employment.resignationDate && (
            <>
              <Field
                label="Last working day"
                value={formatDate(employment.resignationDate)}
              />
              <Field
                label="Reason for leaving"
                value={employment.resignationReason}
              />
            </>
          )}
        </Card>
      )}

      <Card title="Address">
        <Field label="Street" value={address.street} />
        <Field label="Barangay" value={address.barangay} />
        <Field label="City" value={address.city} />
        <Field label="Province" value={address.province} />
        <Field label="Region" value={address.region} />
        <Field label="Postal code" value={address.postalCode} />
        <Field label="Country" value={address.country} />
      </Card>

      <Card title="Emergency Contact">
        <Field label="Name" value={emergencyName} />
        <Field label="Contact number" value={emergency.contactEmergency} />
        <Field label="Address" value={emergency.contactAddress} />
      </Card>
    </div>
  );
};

ProfileView.propTypes = {
  profile: PropTypes.object.isRequired,
  employment: PropTypes.object,
  ownerId: PropTypes.string,
  accountOnly: PropTypes.bool,
  username: PropTypes.string,
};

export default ProfileView;
