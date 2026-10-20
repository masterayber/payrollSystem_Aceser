import PropTypes from "prop-types";
import { getField } from "./profileForm";

// One field per entry. A row with one field spans the full width.
const SECTIONS = [
  {
    title: "Personal Information",
    rows: [
      [
        { name: "firstName", label: "First Name" },
        { name: "lastName", label: "Last Name" },
      ],
      [{ name: "email", label: "Email", type: "email" }],
      [
        { name: "birthday", label: "Birthday", type: "date" },
        { name: "gender", label: "Gender" },
      ],
    ],
  },
  {
    title: "Contact Details",
    rows: [
      [
        { name: "contactNumber", label: "Contact Number" },
        { name: "address.country", label: "Country" },
      ],
      [
        { name: "address.region", label: "Region" },
        { name: "address.province", label: "Province" },
      ],
      [
        { name: "address.city", label: "City" },
        { name: "address.barangay", label: "Barangay" },
      ],
      [
        { name: "address.street", label: "Street" },
        { name: "address.postalCode", label: "Postal Code" },
      ],
    ],
  },
  {
    title: "Emergency Contact",
    rows: [
      [
        {
          name: "emergencyDetails.contactFirstName",
          label: "Contact First Name",
        },
        {
          name: "emergencyDetails.contactLastName",
          label: "Contact Last Name",
        },
      ],
      [
        {
          name: "emergencyDetails.contactEmergency",
          label: "Contact Emergency Number",
        },
      ],
      [{ name: "emergencyDetails.contactAddress", label: "Contact Address" }],
    ],
  },
];

const ProfileForm = ({ form, onChange, disabled }) => {
  const renderField = ({ name, label, type = "text" }) => (
    <div className="input-container" key={name}>
      <div className="label-container">
        <label htmlFor={`profile-${name}`}>{label}</label>
      </div>
      <div className="input-group-signup">
        <input
          id={`profile-${name}`}
          type={type}
          name={name}
          placeholder={disabled ? "" : `Enter ${label}`}
          value={getField(form, name)}
          onChange={(event) => onChange(name, event.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  );

  return (
    <>
      {SECTIONS.map((section) => (
        <div className="setting-tab" key={section.title}>
          <div className="setting-tab-title">
            <p>{section.title}</p>
          </div>
          {section.rows.map((row) =>
            row.length === 1 ? (
              renderField(row[0])
            ) : (
              <div className="input-row" key={row.map((f) => f.name).join()}>
                {row.map(renderField)}
              </div>
            ),
          )}
        </div>
      ))}
    </>
  );
};

ProfileForm.propTypes = {
  form: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default ProfileForm;
