// Account roles. Mirrors backend/config/roles.js.
// "Super Admin" can do everything "Admin" does, but the screen always says "Admin".

export const SUPER_ADMIN = "Super Admin";

export const ROLES = ["Super Admin", "Admin", "Employee"];

export const ADMIN_ROLES = ["Super Admin", "Admin"];

export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

export const isSuperAdmin = (role) => role === SUPER_ADMIN;

// The role used for page routing: both admin roles use the admin pages
export const pageRole = (role) => (isAdminRole(role) ? "Admin" : role);

// The role as shown on screen: never "Super Admin"
export const roleLabel = (role) => (isAdminRole(role) ? "Admin" : role);
