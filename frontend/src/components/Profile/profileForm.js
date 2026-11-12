// Helpers for the profile form shared by the Settings pages and the admin profile page.
// No React here, so Jest can test it (backend/tests/settingsByTick.test.js).
import { isAdminRole, isSuperAdmin } from "../../utils/roles";
import { checkAdminForm, FORM_MESSAGES } from "../../utils/adminAccounts";

export const emptyAddress = {
  country: "",
  region: "",
  province: "",
  city: "",
  barangay: "",
  street: "",
  postalCode: "",
};

export const emptyEmergencyDetails = {
  contactFirstName: "",
  contactLastName: "",
  contactEmergency: "",
  contactAddress: "",
};

// A name part as text: "" for a missing or non-text value
const namePart = (value) => (typeof value === "string" ? value : "");

// Flattens a user object (the shape the login returns) into what ProfileForm edits.
// The names come from the employee record, then from the account itself (an Admin
// account has no employee record); never "undefined".
export const toProfileForm = (user) => {
  const employee = user?.employee || {};
  return {
    firstName: namePart(employee.firstName) || namePart(user?.firstName),
    lastName: namePart(employee.lastName) || namePart(user?.lastName),
    email: user?.email || employee.email || "",
    birthday: employee.birthday ? String(employee.birthday).split("T")[0] : "",
    gender: employee.gender || "",
    contactNumber: employee.contactNumber || "",
    address: { ...emptyAddress, ...(employee.address || {}) },
    emergencyDetails: {
      ...emptyEmergencyDetails,
      ...(employee.emergencyDetails || {}),
    },
  };
};

// "address.city" reads form.address.city; "gender" reads form.gender
export const getField = (form, name) => {
  const [parent, child] = name.split(".");
  return (child ? form[parent]?.[child] : form[name]) ?? "";
};

export const setField = (form, name, value) => {
  const [parent, child] = name.split(".");
  if (child) {
    return { ...form, [parent]: { ...form[parent], [child]: value } };
  }
  return { ...form, [name]: value };
};

// Body for PUT /api/settings/updateGeneralSettings/:id, limited to the fields
// the route whitelists.
export const toProfilePayload = (form) => ({
  email: form.email,
  employee: {
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    birthday: form.birthday || null,
    gender: form.gender,
    contactNumber: form.contactNumber,
    address: form.address,
    emergencyDetails: form.emergencyDetails,
  },
});

// ---- An Admin account's own profile (no employee record) ----

// True when the user object carries a real employee record. The login and /me
// replies send `employee: null` and the Save reply sends `employee: {}` for an
// account without one, so only an object with an `_id` counts.
export const hasEmployeeRecord = (userData) => {
  const employee = userData?.employee;
  return (
    Boolean(employee) &&
    typeof employee === "object" &&
    Boolean(employee._id)
  );
};

// An Admin account (not the main account) with no employee record: its name and
// email live on the account, so General shows and saves only those. An older Admin
// that has an employee record keeps the full form and saves through `employee`.
// Matches the server rule for PUT /api/settings/updateGeneralSettings/:id
// (isOwnAdminAccount in backend/routes/settings.js).
export const isAccountOnly = (userData) =>
  isAdminRole(userData?.role) &&
  !isSuperAdmin(userData?.role) &&
  !hasEmployeeRecord(userData);

const trimmed = (value) => (typeof value === "string" ? value.trim() : "");

// Body for the same route from an Admin account: exactly these three, trimmed
export const toAccountPayload = (form) => ({
  email: trimmed(form?.email),
  firstName: trimmed(form?.firstName),
  lastName: trimmed(form?.lastName),
});

export const ACCOUNT_FORM_MESSAGES = {
  required: "First name, last name and email are required.",
  email: FORM_MESSAGES.email,
};

// The yellow message to show instead of sending, or "" when the form can be sent.
// The email shape is the Settings > Admins check (checkAdminForm); that form also
// needs a username, which this form never edits, so a stand-in fills it.
export const checkAccountForm = (form) => {
  const body = toAccountPayload(form);
  if (!body.firstName || !body.lastName || !body.email) {
    return ACCOUNT_FORM_MESSAGES.required;
  }
  return checkAdminForm({ ...body, username: "account" })
    ? ACCOUNT_FORM_MESSAGES.email
    : "";
};
