// Settings > Admins: the plain rules behind the list, the Add and Edit form, the two
// employee pickers and the temporary password box. No React here, so Jest can test it
// (backend/tests/adminAccountsScreen.test.js).
//
// The tick labels and marks come from GET /api/access/pages (backend/config/pages.js),
// never from a list typed into the screen. The account's role is never shown or sent.

// ---- Names ----

export const fullName = (person) =>
  [person?.firstName, person?.lastName]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");

// Where the signed-in account's name comes from: its employee record, then the names on
// the account itself (an Admin account has no employee record), or null when neither
// holds a name
const nameSource = (userData) =>
  [userData?.employee, userData].find((source) => fullName(source) !== "") ||
  null;

const username = (userData) =>
  typeof userData?.username === "string" ? userData.username.trim() : "";

// The signed-in account's name as the header shows it: the employee's name, then the
// account's own first and last name, then the username. Never "undefined".
export const accountName = (userData) =>
  fullName(nameSource(userData)) || username(userData);

// The short name beside the profile photo: the first name from the same source
export const accountFirstName = (userData) => {
  const source = nameSource(userData);
  return (
    fullName({ firstName: source?.firstName }) ||
    fullName(source) ||
    username(userData)
  );
};

// One Admin as the list and the boxes name it
export const adminName = (admin) => fullName(admin) || admin?.username || "";

// ---- Pages and actions (the ticks) ----

// Only the Admin rows of GET /api/access/pages, split in config order: `pages` open a
// screen, `actions` allow one kind of action on a page the Admin already has
export const splitAdminPages = (allPages) => {
  const adminRows = (Array.isArray(allPages) ? allPages : []).filter(
    (page) => page?.role === "Admin",
  );
  return {
    pages: adminRows.filter((page) => !page.action),
    actions: adminRows.filter((page) => page.action),
  };
};

export const isLogisticsPage = (page) =>
  typeof page?.key === "string" && page.key.startsWith("logistics-");

// The label on the tick; the Logistics pages sit under their own heading
export const tickLabel = (page) =>
  String(page?.label || "").replace(/^Logistics: /, "");

// The page ticks in two groups, as Manage access shows them
export const pageGroups = (pages) =>
  [
    { title: "", pages: pages.filter((page) => !isLogisticsPage(page)) },
    { title: "Logistics", pages: pages.filter(isLogisticsPage) },
  ].filter((group) => group.pages.length > 0);

// A new form's ticks: the locked pages and the ones marked for a new Admin
export const defaultTicks = (allPages) => {
  const { pages, actions } = splitAdminPages(allPages);
  return [...pages, ...actions]
    .filter((page) => page.locked || page.adminDefault)
    .map((page) => page.key);
};

// Ticks that only work together with another one: a hint, nothing is ticked for the user
export const ACTION_HINTS = {
  "employee-access": "Needs the Employees page.",
  "thirteenth-month":
    "Needs Reports or Employees, and shows only people on the pay list.",
};

// ---- The form ----

// { firstName, lastName, username, email, linkedEmployeeId ("" for None), pages (every
// ticked key, actions included), payAccess (account ids) }
export const newAdminForm = (allPages) => ({
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  linkedEmployeeId: "",
  pages: defaultTicks(allPages),
  payAccess: [],
});

// The form of an Admin as GET /api/admins lists it
export const formFromAdmin = (admin) => ({
  firstName: admin?.firstName || "",
  lastName: admin?.lastName || "",
  username: admin?.username || "",
  email: admin?.email || "",
  linkedEmployeeId: admin?.linkedEmployee?.id || "",
  pages: [...(admin?.pages || [])],
  payAccess: (admin?.payAccess || []).map((person) => person.id),
});

const text = (value) => (typeof value === "string" ? value.trim() : "");

const sameSet = (a, b) => {
  const first = new Set(a);
  const second = new Set(b);
  return first.size === second.size && [...first].every((key) => second.has(key));
};

// True when the form differs from `saved` (the form as it opened)
export const formChanged = (form, saved) =>
  ["firstName", "lastName", "username", "email"].some(
    (key) => text(form[key]) !== text(saved[key]),
  ) ||
  (form.linkedEmployeeId || "") !== (saved.linkedEmployeeId || "") ||
  !sameSet(form.pages, saved.pages) ||
  !sameSet(form.payAccess, saved.payAccess);

export const FORM_MESSAGES = {
  required: "First name, last name, username and email are required.",
  email: "Enter a valid email address.",
};

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The yellow message to show instead of sending, or "" when the form can be sent
export const checkAdminForm = (form) => {
  const filled = ["firstName", "lastName", "username", "email"].every(
    (key) => text(form?.[key]) !== "",
  );
  if (!filled) return FORM_MESSAGES.required;
  if (!EMAIL_SHAPE.test(text(form.email))) return FORM_MESSAGES.email;
  return "";
};

const editableFields = (form) => ({
  firstName: text(form.firstName),
  lastName: text(form.lastName),
  email: text(form.email),
  pages: [...new Set(form.pages || [])],
  payAccess: [...new Set(form.payAccess || [])],
  linkedEmployeeId: form.linkedEmployeeId || null,
});

// POST /api/admins. The server makes the password and sets the role and the status,
// so none of them is sent.
export const addAdminBody = (form) => {
  const { firstName, lastName, ...rest } = editableFields(form);
  return { firstName, lastName, username: text(form.username), ...rest };
};

// PATCH /api/admins/:id. Every editable field; the username and the role are never
// sent. `linkedEmployeeId: null` takes the linked employee off.
export const editAdminBody = (form) => editableFields(form);

// ---- The list ----

// The stored status is "Active" or "Inactive"; the screen says "Disabled"
export const isDisabled = (admin) => admin?.status !== "Active";

export const statusLabel = (status) =>
  status === "Active" ? "Active" : "Disabled";

export const payListText = (payAccess) => {
  const count = Array.isArray(payAccess) ? payAccess.length : 0;
  if (count === 0) return "None";
  return count === 1 ? "1 employee" : `${count} employees`;
};

// The date and time of the last sign-in in Manila, or "Never"
export const lastLoginText = (lastLogin) => {
  const date = lastLogin ? new Date(lastLogin) : null;
  if (!date || Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

// ---- The employee pickers (pay list and linked employee) ----

// One row per person from the employee list in EmployeeContext (`_id` is the account
// id the server wants). `saved` are people from the Admin's reply (pay list, linked
// employee): one that is missing from the list still gets a row, so it can be seen
// and unticked.
export const pickerRows = (employees, saved = []) => {
  const rows = (Array.isArray(employees) ? employees : [])
    .filter((employee) => employee?._id)
    .map((employee) => ({
      id: String(employee._id),
      name: fullName(employee),
      employeeId: employee.employeeId || "",
      department: employee.jobDescription?.department || "",
      resigned: employee.status === "Resigned",
    }));
  const known = new Set(rows.map((row) => row.id));
  for (const person of saved) {
    if (!person?.id || known.has(String(person.id))) continue;
    known.add(String(person.id));
    rows.push({
      id: String(person.id),
      name: person.name || "",
      employeeId: person.employeeId || "",
      department: "",
      resigned: person.status === "Resigned",
    });
  }
  return rows;
};

const RESIGNED_MARK = " (resigned)";

// "Ana Reyes" or "Ben Cruz (resigned)"
export const personName = (row) =>
  `${row.name || row.employeeId || "Unnamed employee"}${row.resigned ? RESIGNED_MARK : ""}`;

// "Name · Employee ID · Department", with "(resigned)" at the end
export const pickerLabel = (row) =>
  `${[row.name || "Unnamed employee", row.employeeId, row.department]
    .filter(Boolean)
    .join(" · ")}${row.resigned ? RESIGNED_MARK : ""}`;

// The rows whose name, Employee ID or department holds every word typed, in any case
export const searchRows = (rows, query) => {
  const words = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return rows;
  return rows.filter((row) => {
    const haystack = [row.name, row.employeeId, row.department]
      .join(" ")
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
};

// "Chosen (2): Ana Reyes, Ben Cruz (resigned)" for the ticked ids, in list order
export const chosenText = (ids, rows) => {
  const chosen = new Set((ids || []).map(String));
  const names = rows.filter((row) => chosen.has(row.id)).map(personName);
  return `Chosen (${names.length}): ${names.length > 0 ? names.join(", ") : "nobody"}`;
};

// ---- Messages ----

export const NOT_AVAILABLE =
  "A chosen employee is no longer available. Close this form and open it again.";

// A refusal as the screen shows it: the server's own words, except "Not an employee:
// <id>" (a raw id means nothing to the reader), or `fallback` when there is no message
export const refusalText = (error, fallback) => {
  const message = error?.response?.data?.message;
  if (typeof message !== "string" || message.trim() === "") return fallback;
  return message.startsWith("Not an employee:") ? NOT_AVAILABLE : message;
};

// The sentence after the password in the temporary password box
export const temporaryPasswordNote = (name) =>
  `This is shown only once. Give it to ${name} yourself; they must change it when they first sign in.`;
