// The activity log (PR E; "Activity log" on screen): who changed what, on which record
// and when, for every write the Super Admin or an Admin makes. This file holds the
// table of logged actions and the pure rules; middleware/activityLog.js writes the
// entries and GET /api/admins/activity (Super Admin only) reads them.
//
// What an entry never holds: an amount of money, a password or a temporary password,
// or a role. An edit lists the names of the fields whose saved value changed
// ("basic pay"), never the values. Nothing here reads the database.
const { toDateKey } = require("./leaveCredits");
const { escapeRegex } = require("./ignoreCase");

const PAGE_SIZE = 50;

// The filter groups ("Kind of action" on the screen), in the order the screen lists them
const GROUPS = [
  { key: "employees", label: "Employees" },
  { key: "signups", label: "Sign-ups" },
  { key: "access", label: "Page access" },
  { key: "attendance", label: "Attendance" },
  { key: "filing", label: "Filing" },
  { key: "company", label: "Company" },
  { key: "lists", label: "Lists" },
  { key: "admins", label: "Admin accounts" },
  { key: "holidays", label: "Holidays" },
];
const GROUP_KEYS = GROUPS.map((group) => group.key);

const MESSAGES = {
  badDate: "Dates must be in YYYY-MM-DD form.",
  fromAfterTo: "The start date is after the end date.",
  notAdmin: "Not an Admin account.",
  notGroup: (group) => `Not a kind of action: ${group}.`,
};

// Trimmed text; "" for a missing value
const text = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

// The longest record name or note an entry keeps; a longer one is cut there
const MAX_TEXT_LENGTH = 200;
const clip = (value) => text(value).slice(0, MAX_TEXT_LENGTH);

// "3 records imported", "1 holiday imported"
const countOf = (count, thing, done) =>
  `${count} ${thing}${count === 1 ? "" : "s"} ${done}`;

// Which list a /api/dropdownOption route changes, as the entry's record
const LIST_NAMES = {
  designations: "Designations",
  departments: "Departments",
  employmentTypes: "Employment types",
  itemCategories: "Item categories",
  unitsOfMeasure: "Units of measure",
};
const listName = (params = {}) =>
  params.department !== undefined
    ? `Positions in ${text(params.department)}`
    : `${LIST_NAMES[params.field] || text(params.field)} list`;

// "Sick Leave, 2026-11-16 to 2026-11-18"; one date for a one-day leave
const leaveNote = (leave) => {
  const start = toDateKey(leave?.startDate);
  const end = toDateKey(leave?.endDate);
  const days = start === end || !end ? start : `${start} to ${end}`;
  return [text(leave?.leaveType), days].filter(Boolean).join(", ");
};

// "Christmas Day, 2026-12-25"
const holidayName = (holiday) =>
  [text(holiday?.name), toDateKey(holiday?.date)].filter(Boolean).join(", ");

// "12 holidays imported", with ", 2 skipped" for dates that already had a holiday
const holidayImportNote = (savedCount, skippedCount = 0) =>
  countOf(savedCount, "holiday", "imported") +
  (skippedCount > 0 ? `, ${skippedCount} skipped` : "");

// Every logged action. The key is stored on the entry; `label` is how the screen names
// it; `group` is its filter group.
// - `param`: the route parameter that holds the account acted on. The entry's record is
//   then that person, named at write time ("Angelica Ramos (AC-008)").
// - `targetName`: a fixed record name, for an action on no account.
// - `changes`: the kind of record (CHANGE_LABELS) whose changed fields are listed, read
//   before and after the route runs.
// - `describe({ params, body })`: the record or note, where the request alone tells it.
// A route gives the rest in `res.locals.activity = { targetId, targetName, changed,
// note }` (the new account's id, a name read before a delete, a count), which wins.
const ACTIONS = {
  "employee.add": { label: "Added employee", group: "employees" },
  "employee.edit": {
    label: "Edited employee",
    group: "employees",
    param: "id",
    changes: "person",
  },
  "employee.resign": {
    label: "Marked as resigned",
    group: "employees",
    param: "userId",
    describe: ({ body }) => ({
      note: `Last working day ${text(body.resignationDate)}`,
    }),
  },
  "employee.reinstate": {
    label: "Reinstated",
    group: "employees",
    param: "userId",
  },
  "employee.delete": { label: "Deleted employee", group: "employees" },
  "employee.details": {
    label: "Edited contact details",
    group: "employees",
    param: "id",
    changes: "person",
  },
  "account.details": {
    label: "Edited own details",
    group: "employees",
    param: "id",
    changes: "person",
  },
  "photo.set": { label: "Changed photo", group: "employees", param: "id" },
  "photo.remove": { label: "Removed photo", group: "employees", param: "id" },

  "signup.approve": { label: "Approved sign-up", group: "signups", param: "id" },

  "access.set": {
    label: "Changed page access",
    group: "access",
    param: "userId",
    describe: ({ body }) => ({
      note: body.reset === true ? "Back to the default" : "Custom ticks",
    }),
  },

  "attendance.edit": {
    label: "Edited attendance",
    group: "attendance",
    param: "id",
    describe: ({ body }) => ({ note: text(body.date) }),
  },
  "attendance.import": {
    label: "Imported from the device",
    group: "attendance",
    targetName: "Biometric device",
  },
  "attendance.blankDay": {
    label: "Added blank attendance day",
    group: "attendance",
  },

  "leave.approve": { label: "Approved leave", group: "filing" },
  "leave.disapprove": { label: "Disapproved leave", group: "filing" },
  "overtime.approve": { label: "Approved overtime", group: "filing" },
  "overtime.disapprove": { label: "Disapproved overtime", group: "filing" },

  "company.edit": {
    label: "Edited company details",
    group: "company",
    targetName: "Company",
    changes: "company",
  },
  "company.logo": {
    label: "Changed company logo",
    group: "company",
    targetName: "Company",
  },
  "company.logoRemove": {
    label: "Removed company logo",
    group: "company",
    targetName: "Company",
  },

  "list.add": {
    label: "Added list item",
    group: "lists",
    describe: ({ params, body }) => ({
      targetName: listName(params),
      note: text(body.option),
    }),
  },
  "list.rename": {
    label: "Renamed list item",
    group: "lists",
    describe: ({ params, body }) => ({
      targetName: listName(params),
      note: `${text(body.oldOption)} to ${text(body.newOption)}`,
    }),
  },
  "list.remove": {
    label: "Removed list item",
    group: "lists",
    describe: ({ params, body }) => ({
      targetName: listName(params),
      note: text(body.option),
    }),
  },

  "admin.create": { label: "Created Admin account", group: "admins" },
  "admin.edit": {
    label: "Edited Admin account",
    group: "admins",
    param: "id",
    changes: "admin",
  },
  "admin.disable": { label: "Disabled Admin", group: "admins", param: "id" },
  "admin.enable": { label: "Enabled Admin", group: "admins", param: "id" },
  "admin.resetPassword": {
    label: "Reset Admin password",
    group: "admins",
    param: "id",
  },

  "holiday.add": { label: "Added holiday", group: "holidays" },
  "holiday.remove": { label: "Removed holiday", group: "holidays" },
  "holiday.import": { label: "Imported holidays", group: "holidays" },
};

// The key for a leave or overtime decision ("leave" or "overtime", and the status sent)
const decisionAction = (kind, status) =>
  `${kind}.${status === "Approved" ? "approve" : "disapprove"}`;

// Settings > General saves the caller's own details or, for an admin, another person's
const detailsAction = (callerId, targetId) =>
  String(callerId) === String(targetId) ? "account.details" : "employee.details";

// The label an edit shows for a set password. No entry ever holds the password.
const PASSWORD_RESET = "password reset";

// The fields an edit may list, per kind of record, in the order they are listed.
// `paths` are read from the record as loaded before and after the save; `as` says how a
// value is compared: "day" (a Date or a "YYYY-MM-DD" text, as its day) or "set" (a list
// whose order doesn't matter). Only the label is ever stored.
const CHANGE_LABELS = {
  // { account, employee, job }: an employee, or an Admin's own account
  person: [
    {
      label: "name",
      paths: [
        "employee.firstName",
        "employee.lastName",
        "account.firstName",
        "account.lastName",
      ],
    },
    { label: "Employee ID", paths: ["employee.employeeId"] },
    { label: "username", paths: ["account.username"] },
    { label: "email", paths: ["account.email", "employee.email"] },
    { label: "gender", paths: ["employee.gender"] },
    { label: "birthday", paths: ["employee.birthday"], as: "day" },
    { label: "contact number", paths: ["employee.contactNumber"] },
    { label: "address", paths: ["employee.address"] },
    { label: "emergency contact", paths: ["employee.emergencyDetails"] },
    { label: "designation", paths: ["job.designation"] },
    { label: "department", paths: ["job.department"] },
    { label: "position", paths: ["job.position"] },
    { label: "employment type", paths: ["job.employmentType"] },
    { label: "start date", paths: ["job.startDate"], as: "day" },
    {
      label: "date of regularization",
      paths: ["job.regularizationDate"],
      as: "day",
    },
    { label: "VL opening balance", paths: ["job.vacationLeaveOpening"] },
    {
      label: "schedule",
      paths: ["job.schedule.timeIn", "job.schedule.timeOut"],
    },
    { label: "basic pay", paths: ["job.basicPay"] },
  ],
  // { account }: an Admin account, as Settings > Admins edits it
  admin: [
    { label: "name", paths: ["account.firstName", "account.lastName"] },
    { label: "email", paths: ["account.email"] },
    { label: "ticks", paths: ["account.pageAccess"], as: "set" },
    { label: "pay list", paths: ["account.payAccess"], as: "set" },
    { label: "linked employee", paths: ["account.linkedEmployeeId"] },
  ],
  // The company record
  company: [
    { label: "name", paths: ["name"] },
    { label: "contact", paths: ["contact"] },
    { label: "date format", paths: ["dateFormat"] },
    { label: "time format", paths: ["timeFormat"] },
  ],
  // One attendance day
  attendance: [
    { label: "time in", paths: ["timeIn"] },
    { label: "time out", paths: ["timeOut"] },
  ],
};

const valueAt = (record, path) =>
  path
    .split(".")
    .reduce((value, key) => (value == null ? undefined : value[key]), record);

// A value as text, so two saved values can be compared: missing, null and "" are the
// same; a Date is its moment; an id is its text; an object is its filled fields in key
// order (an address with blank parts equals one without them).
const comparable = (value, as) => {
  if (as === "day") return toDateKey(value);
  if (as === "set") {
    const list = Array.isArray(value) ? value : [];
    return JSON.stringify(list.map((item) => comparable(item)).sort());
  }
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return String(value.getTime());
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((item) => comparable(item)));
  }
  if (typeof value === "object") {
    if (typeof value.toHexString === "function") return String(value);
    const filled = Object.keys(value)
      .sort()
      .map((key) => [key, comparable(value[key])])
      .filter(([, item]) => item !== "");
    return filled.length === 0 ? "" : JSON.stringify(filled);
  }
  return String(value);
};

// The labels of the fields whose saved value differs between `before` and `after`, in
// the order of `labels` (a CHANGE_LABELS list). No change, or a record that could not
// be read on either side, gives an empty list. Never returns a value.
const changedFields = (before, after, labels) => {
  if (!before || !after || !Array.isArray(labels)) return [];
  return labels
    .filter(({ paths, as }) =>
      paths.some(
        (path) =>
          comparable(valueAt(before, path), as) !==
          comparable(valueAt(after, path), as),
      ),
    )
    .map(({ label }) => label);
};

const joinName = (record) =>
  [text(record?.firstName), text(record?.lastName)].filter(Boolean).join(" ");

// A person as an entry names them: "First Last (Employee ID)" from the employee record,
// then the names on the account (an Admin account has no employee record), then the
// username. `withId: false` leaves the Employee ID out (the "who" of an entry).
const personName = (employee, account, { withId = true } = {}) => {
  const employeeName = joinName(employee);
  if (employeeName) {
    const employeeId = text(employee.employeeId);
    return withId && employeeId ? `${employeeName} (${employeeId})` : employeeName;
  }
  return joinName(account) || text(account?.username) || "Unknown";
};

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// A real calendar day written as "YYYY-MM-DD" (2026-02-30 is not one)
const isDayKey = (value) =>
  typeof value === "string" && DAY_PATTERN.test(value) && toDateKey(value) === value;

const isBlank = (value) =>
  value === undefined || (typeof value === "string" && value.trim() === "");

// A filter as sent: null when it is missing or blank, trimmed when it is text
const sent = (value) => {
  if (isBlank(value)) return null;
  return typeof value === "string" ? value.trim() : value;
};

// The Manila days `from` and `to` (each optional) as moments: { from, to }, from the
// first millisecond of `from` to the last of `to`, both days included; a missing end is
// null. Or { error } for a date not in YYYY-MM-DD form, or a start after the end.
const dayRange = (from, to) => {
  const fromKey = sent(from);
  const toKey = sent(to);
  if (
    (fromKey !== null && !isDayKey(fromKey)) ||
    (toKey !== null && !isDayKey(toKey))
  ) {
    return { error: MESSAGES.badDate };
  }
  if (fromKey !== null && toKey !== null && fromKey > toKey) {
    return { error: MESSAGES.fromAfterTo };
  }
  return {
    from: fromKey === null ? null : new Date(`${fromKey}T00:00:00.000+08:00`),
    to: toKey === null ? null : new Date(`${toKey}T23:59:59.999+08:00`),
  };
};

const ACCOUNT_ID_PATTERN = /^[0-9a-f]{24}$/i;

// A missing or bad page reads as 1
const pageNumber = (value) =>
  typeof value === "string" && /^\d{1,6}$/.test(value) && Number(value) >= 1
    ? Number(value)
    : 1;

// Checks the filters of GET /api/admins/activity. Returns { error } or { by, group,
// from, to, q, page }: `by` is "me", an account id (the route confirms it is an Admin
// account) or undefined; `from` and `to` are moments or null. A blank filter counts as
// not sent. Order of the refusals: the dates, the person, the group.
const checkActivityQuery = (query) => {
  const input = query && typeof query === "object" ? query : {};

  const range = dayRange(input.from, input.to);
  if (range.error) return { error: range.error };

  const by = sent(input.by) ?? undefined;
  if (
    by !== undefined &&
    by !== "me" &&
    !(typeof by === "string" && ACCOUNT_ID_PATTERN.test(by))
  ) {
    return { error: MESSAGES.notAdmin };
  }

  const group = sent(input.group) ?? undefined;
  if (group !== undefined && !GROUP_KEYS.includes(group)) {
    return { error: MESSAGES.notGroup(text(group)) };
  }

  const q = typeof input.q === "string" ? input.q.trim() : "";

  return {
    by,
    group,
    from: range.from,
    to: range.to,
    q,
    page: pageNumber(input.page),
  };
};

// The database filter for checked filters; `currentUserId` is who "me" is. `q` matches
// part of the record's name, in any case, as plain text.
const activityFilter = ({ by, group, from, to, q } = {}, currentUserId) => {
  const filter = {};
  if (by) filter.actorId = by === "me" ? String(currentUserId) : by;
  if (group) filter.group = group;
  if (from || to) {
    filter.at = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  }
  if (q) filter.targetName = { $regex: escapeRegex(q), $options: "i" };
  return filter;
};

// An entry as the screen gets it. The caller's own entries carry `you: true` (the
// screen shows "You"); no role is ever sent.
const toReplyEntry = (entry, currentUserId) => ({
  id: String(entry._id),
  at: entry.at,
  by: {
    id: String(entry.actorId),
    name: entry.actorName || "",
    you: String(entry.actorId) === String(currentUserId),
  },
  action: entry.action,
  label: ACTIONS[entry.action]?.label || entry.action,
  group: entry.group,
  targetName: entry.targetName || "",
  changed: Array.isArray(entry.changed) ? entry.changed : [],
  note: entry.note || "",
});

module.exports = {
  PAGE_SIZE,
  GROUPS,
  GROUP_KEYS,
  MESSAGES,
  ACTIONS,
  CHANGE_LABELS,
  PASSWORD_RESET,
  MAX_TEXT_LENGTH,
  clip,
  decisionAction,
  detailsAction,
  countOf,
  listName,
  leaveNote,
  holidayName,
  holidayImportNote,
  changedFields,
  personName,
  dayRange,
  pageNumber,
  checkActivityQuery,
  activityFilter,
  toReplyEntry,
};
