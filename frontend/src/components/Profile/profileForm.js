// Helpers for the profile form shared by the Settings pages and the admin profile page.

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

// Flattens a user object (the shape the login returns) into what ProfileForm edits.
export const toProfileForm = (user) => {
  const employee = user?.employee || {};
  return {
    firstName: employee.firstName || "",
    lastName: employee.lastName || "",
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
