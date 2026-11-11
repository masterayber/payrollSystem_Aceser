const Employee = require("../models/employees");

// Default profile icons. An Employee-role account shows the icon for the gender on its
// Employee record; Super Admin and Admin accounts are not employees, so they always
// show the plain user icon. An uploaded photo (/uploads/...) is never replaced by
// these rules; only Remove photo (routes/settings.js) deletes one.
const DEFAULT_ICON = "/assets/user-circle.svg";
const MALE_ICON = "/assets/genderIcons/male.svg";
const FEMALE_ICON = "/assets/genderIcons/female.svg";
const GENDER_ICONS = { Male: MALE_ICON, Female: FEMALE_ICON };
const DEFAULT_ICONS = [DEFAULT_ICON, MALE_ICON, FEMALE_ICON];

// True when the photo is one of the default icons, or empty or missing
const isDefaultIcon = (photo) => !photo || DEFAULT_ICONS.includes(photo);

// "Male" or "Female" give their icon; anything else (empty, unknown) the plain one
const iconForGender = (gender) => GENDER_ICONS[gender] || DEFAULT_ICON;

// The default icon for a role and gender: the gender's icon for an Employee, the plain
// icon for the Super Admin and Admins
const iconFor = (role, gender) =>
  role === "Employee" ? iconForGender(gender) : DEFAULT_ICON;

// The photo an account should hold: an upload stays as it is; a default icon (or no
// photo) becomes the icon for the role and gender
const nextProfilePhoto = (photo, role, gender) =>
  isDefaultIcon(photo) ? iconFor(role, gender) : photo;

// The gender on an account's Employee record, found by userId, else by email
const genderOf = async (user) => {
  const employee =
    (await Employee.findOne({ userId: user._id }).select("gender").lean()) ||
    (user.email
      ? await Employee.findOne({ email: user.email }).select("gender").lean()
      : null);
  return employee?.gender;
};

// The default icon for an account (used by Remove photo, whatever the current photo)
const defaultPhotoFor = async (user) =>
  user.role === "Employee"
    ? iconForGender(await genderOf(user))
    : DEFAULT_ICON;

// Applies the rule to an account (a document or a plain object): an upload is left
// alone; a default icon becomes the icon for its role and gender. `gender` is the
// gender just saved; without it the Employee record is looked up. Sets
// `user.profilePhoto` (the caller saves) and returns { profilePhoto, changed }.
const refreshDefaultIcon = async (user, options = {}) => {
  const current = user.profilePhoto;
  if (!isDefaultIcon(current)) return { profilePhoto: current, changed: false };

  const gender =
    "gender" in options
      ? options.gender
      : user.role === "Employee"
        ? await genderOf(user)
        : undefined;
  const profilePhoto = iconFor(user.role, gender);
  const changed = profilePhoto !== current;
  if (changed) user.profilePhoto = profilePhoto;
  return { profilePhoto, changed };
};

module.exports = {
  DEFAULT_ICON,
  MALE_ICON,
  FEMALE_ICON,
  GENDER_ICONS,
  DEFAULT_ICONS,
  isDefaultIcon,
  iconForGender,
  iconFor,
  nextProfilePhoto,
  genderOf,
  defaultPhotoFor,
  refreshDefaultIcon,
};
