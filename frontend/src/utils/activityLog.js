// Settings > Admins > Activity log: the plain rules behind the view. No React here, so
// Jest can test it (backend/tests/activityLogScreen.test.js).
//
// The entries come from GET /api/admins/activity (Super Admin only), newest first, 50 a
// page. An entry never holds an amount of money or a role, and the screen adds none:
// the caller's own entries say "You", an Admin is named, and the action's words are the
// server's `label`.
import { adminName, isDisabled } from "./adminAccounts";

// ---- Filters ----

// The kinds of action, in the server's order (backend/utils/activityLog.js GROUPS)
export const GROUPS = [
  { key: "employees", label: "Employees" },
  { key: "signups", label: "Sign-ups" },
  { key: "access", label: "Page access" },
  { key: "attendance", label: "Attendance" },
  { key: "filing", label: "Filing" },
  { key: "company", label: "Company" },
  { key: "lists", label: "Lists" },
  { key: "admins", label: "Admin accounts" },
  { key: "holidays", label: "Holidays" },
  { key: "deductions", label: "Deductions" },
];

// `by`: "" (everyone), "me" or an Admin account id; `group`: "" or a GROUPS key;
// `from`, `to`: "" or a Manila day as YYYY-MM-DD; `q`: part of the record's name
export const EMPTY_FILTERS = { by: "", group: "", from: "", to: "", q: "" };

const FILTER_KEYS = Object.keys(EMPTY_FILTERS);

const text = (value) => (typeof value === "string" ? value.trim() : "");

// True when any filter is set
export const hasFilters = (filters) =>
  FILTER_KEYS.some((key) => text(filters?.[key]) !== "");

// The query string of GET /api/admins/activity ("" or "?by=me&page=2"): blank filters
// are left out, and so is page 1
export const activityQuery = (filters, page = 1) => {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = text(filters?.[key]);
    if (value !== "") params.set(key, value);
  }
  if (Number.isInteger(page) && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
};

// The Person choices: Everyone, You, then each Admin by name from GET /api/admins, a
// disabled one marked "(disabled)"
export const personOptions = (admins) => [
  { value: "", label: "Everyone" },
  { value: "me", label: "You" },
  ...(Array.isArray(admins) ? admins : [])
    .filter((admin) => admin?.id)
    .map((admin) => ({
      value: String(admin.id),
      label: `${adminName(admin)}${isDisabled(admin) ? " (disabled)" : ""}`,
    })),
];

// The Kind choices: All, then the groups
export const kindOptions = () => [
  { value: "", label: "All" },
  ...GROUPS.map((group) => ({ value: group.key, label: group.label })),
];

export const MESSAGES = {
  loading: "Loading...",
  nothingYet:
    "Nothing recorded yet. Changes made by you and the Admins appear here.",
  noMatch: "No activity matches these filters.",
  loadFailed: "Could not load the activity log.",
  // The server's own words (backend/utils/activityLog.js MESSAGES.fromAfterTo)
  fromAfterTo: "The start date is after the end date.",
};

// The yellow message to show instead of asking, or "" when the dates can be sent. The
// date boxes give YYYY-MM-DD, so the days compare as text.
export const checkDates = (filters) => {
  const from = text(filters?.from);
  const to = text(filters?.to);
  return from !== "" && to !== "" && from > to ? MESSAGES.fromAfterTo : "";
};

// ---- An entry ----

// "You" for the caller's own entries, else the name stored with the entry
export const whoText = (by) => {
  if (by?.you === true) return "You";
  return text(by?.name) || "Unknown";
};

const MANILA_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

// "Nov 13, 2026 2:05 PM" in Manila time, or "" for a missing or bad moment
export const whenText = (at) => {
  const date = at ? new Date(at) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  const part = Object.fromEntries(
    MANILA_TIME.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${part.month} ${part.day}, ${part.year} ${part.hour}:${part.minute} ${part.dayPeriod.toUpperCase()}`;
};

// "Changed: position, basic pay", or "" when nothing is listed
export const changedText = (changed) => {
  const names = (Array.isArray(changed) ? changed : [])
    .map(text)
    .filter(Boolean);
  return names.length > 0 ? `Changed: ${names.join(", ")}` : "";
};

// The Details cell, one line each: the changed fields, then the note
export const detailLines = (entry) =>
  [changedText(entry?.changed), text(entry?.note)].filter(Boolean);

// ---- Paging ----

// "Showing 51 to 100 of 312" for the entries on this page, or "" when there are none
export const pageText = ({ page, pageSize, total, count }) => {
  if (!(count > 0) || !(total > 0)) return "";
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(first + count - 1, total);
  return `Showing ${first} to ${last} of ${total}`;
};

// Newer: an earlier page exists; Older: entries are left past this page
export const hasNewer = (page) => page > 1;
export const hasOlder = ({ page, pageSize, total }) => page * pageSize < total;

// The words when the page has no entries: an empty log, or filters that match nothing
export const emptyText = ({ filtered, total }) =>
  !filtered && !(total > 0) ? MESSAGES.nothingYet : MESSAGES.noMatch;
