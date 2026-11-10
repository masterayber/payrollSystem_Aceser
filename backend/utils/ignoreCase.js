// Case-insensitive "is this username or email already used?" lookups. Stored values
// keep the case they were typed in and login still matches exactly; only the
// uniqueness checks treat `Test.Admin@aceserph.com` and `test.admin@aceserph.com` as
// the same.

// `text` with every regular-expression character escaped, so it matches literally
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A query condition matching exactly `value`, ignoring case (anchored, so `ana` does
// not match `ana.cruz`). A value that is not a string is returned as it is, so a
// route's existing behaviour for a missing or odd value does not change.
const ignoreCase = (value) =>
  typeof value === "string"
    ? { $regex: `^${escapeRegex(value)}$`, $options: "i" }
    : value;

module.exports = { escapeRegex, ignoreCase };
