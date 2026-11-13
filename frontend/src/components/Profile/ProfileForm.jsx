import { useState } from "react";
import PropTypes from "prop-types";
import Dropdown from "../Dropdown/Dropdown";
import { getField } from "./profileForm";

// The genders the default icons know (backend/utils/profileIcon.js GENDER_ICONS)
const GENDERS = ["Male", "Female"];

// One field per entry. A row with one field spans the full width. A field with
// `options` is a list instead of a text box.
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
        { name: "gender", label: "Gender", options: GENDERS },
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

// An Admin account (no employee record) edits only its names and email: the first
// two rows of Personal Information
const ACCOUNT_SECTIONS = [
  { title: SECTIONS[0].title, rows: SECTIONS[0].rows.slice(0, 2) },
];

const ProfileForm = ({ form, onChange, disabled, accountOnly = false }) => {
  // The form as it opened: a stored value off a list (an older typed "male") stays
  // in that list, so it can be picked again after trying another
  const [opened] = useState(form);

  const listOptions = (name, options) => {
    const stored = getField(opened, name);
    return stored && !options.includes(stored) ? [...options, stored] : options;
  };

  const renderField = ({ name, label, type = "text", options }) =>
    options && !disabled ? (
      <div className="input-container profile-select" key={name}>
        <div className="label-container">
          <label>{label}</label>
        </div>
        <Dropdown
          options={listOptions(name, options)}
          placeholder={`Select ${label}`}
          value={getField(form, name)}
          onSelect={(value) => onChange(name, value)}
        />
      </div>
    ) : (
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
      {(accountOnly ? ACCOUNT_SECTIONS : SECTIONS).map((section) => (
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
  accountOnly: PropTypes.bool,
};

export default ProfileForm;
