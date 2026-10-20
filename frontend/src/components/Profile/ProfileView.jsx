import PropTypes from "prop-types";
import "./Profile.css";

const EMPTY = "—";

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

const Field = ({ label, value }) => (
  <div className="profile-field">
    <dt>{label}</dt>
    <dd>{value || EMPTY}</dd>
  </div>
);

Field.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
};

const Card = ({ title, children }) => (
  <section className="profile-card">
    <h4 className="profile-card-title">{title}</h4>
    <dl className="profile-fields">{children}</dl>
  </section>
);

Card.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
};

// Read-only profile. `profile` has the shape toProfileForm returns; `employment`
// (optional) is a job description plus employeeId.
const ProfileView = ({ profile, employment }) => {
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
          <Field label="Schedule" value={schedule} />
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
};

export default ProfileView;
