// Admin accounts (role "Admin"), created and managed by the Super Admin through
// /api/admins. Pure functions, no database: the route looks up what these return.
//
// An Admin is not an employee: no Employee or Settings record, never paid, hidden like
// the Super Admin. Its name is on the Auth record; its ticks reuse `pageAccess`; its
// pay list is `payAccess`; `linkedEmployeeId` is the same person's Employee account.
const { pagesForRole, ADMIN_DEFAULT_PAGE_KEYS } = require("../config/pages");
const { normalizePageAccess } = require("./pageAccess");
const { EMAIL_SHAPE_MESSAGE, isEmailShape } = require("./emailShape");

const MESSAGES = {
  required: "First name, last name, username and email are required.",
  emailShape: EMAIL_SHAPE_MESSAGE,
  role: "Role can't be changed.",
  usernameTaken: "Username is already taken.",
  emailTaken: "Email is already registered.",
  notFound: "Admin not found",
  pagesNotList: "`pages` must be a list of page keys.",
  payAccessNotList: "`payAccess` must be a list of employee ids.",
  created: "Admin account created.",
  disabled: "Admin disabled.",
  enabled: "Admin enabled.",
  passwordReset: "Password reset.",
};

const notAdminPage = (keys) => `Not an admin page: ${keys.join(", ")}`;
const notEmployee = (id) => `Not an employee: ${id}`;

const ADMIN_PAGE_KEYS = new Set(pagesForRole("Admin").map((page) => page.key));

const isFilledString = (value) =>
  typeof value === "string" && value.trim() !== "";

const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key);

// Checks a create (POST, `creating` true) or edit (PATCH) body. Returns { error } with
// the refusal message, or { fields, employeeIds }:
// - fields: what to store, only the keys the request changes (on create: every key,
//   with the HR set when `pages` is not sent and an empty pay list when `payAccess`
//   is not sent). `linkedEmployeeId` null means "no linked employee".
// - employeeIds: ids the route must confirm are Employee-role accounts (Active or
//   Resigned) before saving: the pay list first, then the linked employee. Malformed
//   ids are included: the route refuses them with the others ("Not an employee: <id>"),
//   after its username and email checks, so every id refusal comes at the same step.
// Order: a `role` key, the names (and username and email on create), the email's shape
// (only once nothing is blank, as on the screen), the page keys, the pay list's shape.
// Username, status, password and the password flag are never taken from the body (an
// edit ignores a `username`).
const checkAdminDetails = (body, { creating = false } = {}) => {
  const input = body && typeof body === "object" ? body : {};

  if (has(input, "role")) return { error: MESSAGES.role };

  const fields = {};
  const textKeys = creating
    ? ["firstName", "lastName", "username", "email"]
    : ["firstName", "lastName", "email"];
  for (const key of textKeys) {
    if (!creating && !has(input, key)) continue;
    if (!isFilledString(input[key])) return { error: MESSAGES.required };
    fields[key] = input[key].trim();
  }
  if (fields.email !== undefined && !isEmailShape(fields.email)) {
    return { error: MESSAGES.emailShape };
  }

  if (has(input, "pages") || creating) {
    const pages = has(input, "pages") ? input.pages : ADMIN_DEFAULT_PAGE_KEYS;
    if (!Array.isArray(pages) || pages.some((key) => typeof key !== "string")) {
      return { error: MESSAGES.pagesNotList };
    }
    const invalid = [...new Set(pages)].filter((key) => !ADMIN_PAGE_KEYS.has(key));
    if (invalid.length > 0) return { error: notAdminPage(invalid) };
    fields.pageAccess = normalizePageAccess("Admin", pages);
  }

  const employeeIds = [];

  if (has(input, "payAccess") || creating) {
    const list = has(input, "payAccess") ? input.payAccess : [];
    if (!Array.isArray(list)) return { error: MESSAGES.payAccessNotList };
    const ids = [...new Set(list.map((id) => String(id)))];
    fields.payAccess = ids;
    employeeIds.push(...ids);
  }

  if (has(input, "linkedEmployeeId") || creating) {
    const linked = input.linkedEmployeeId;
    if (linked === undefined || linked === null || linked === "") {
      fields.linkedEmployeeId = null;
    } else {
      const id = String(linked);
      fields.linkedEmployeeId = id;
      if (!employeeIds.includes(id)) employeeIds.push(id);
    }
  }

  return { fields, employeeIds };
};

// The first of `ids` (in order) that is not in `found` (the Employee-role account ids
// that exist with status Active or Resigned), or null when all are. A malformed id is
// never in `found`, so it is refused in its place in the list.
const firstMissingEmployee = (ids, found) => {
  const known = new Set([...found].map(String));
  return ids.find((id) => !known.has(String(id))) ?? null;
};

const fullName = (person) =>
  [person?.firstName, person?.lastName].filter(Boolean).join(" ");

// One Admin as the Super Admin's screen shows it. `people` maps an Employee-role
// account id (string) to { name, employeeId, status }; an id missing from it (deleted,
// or no longer an Employee) is left out of the pay list and the linked employee.
// `pages` are the Admin's ticks, the locked pages included.
const describeAdmin = (admin, people = new Map()) => {
  const person = (id) => (id == null ? null : people.get(String(id)) || null);
  const linked = person(admin.linkedEmployeeId);
  return {
    id: String(admin._id),
    firstName: admin.firstName || "",
    lastName: admin.lastName || "",
    username: admin.username,
    email: admin.email,
    status: admin.status,
    mustChangePassword: admin.mustChangePassword === true,
    pages: normalizePageAccess("Admin", admin.pageAccess || []),
    payAccess: (admin.payAccess || [])
      .map((id) => {
        const found = person(id);
        return found
          ? {
              id: String(id),
              name: found.name,
              employeeId: found.employeeId,
              status: found.status,
            }
          : null;
      })
      .filter(Boolean),
    linkedEmployee: linked
      ? { id: String(admin.linkedEmployeeId), name: linked.name }
      : null,
    lastLogin: admin.lastLogin ?? null,
  };
};

module.exports = {
  MESSAGES,
  notAdminPage,
  notEmployee,
  checkAdminDetails,
  firstMissingEmployee,
  fullName,
  describeAdmin,
};
