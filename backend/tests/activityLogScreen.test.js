// The rules behind Settings > Admins > Activity log (frontend/src/utils/activityLog.js):
// the query string the view sends, the Person and Kind choices, the words in each row
// (Who, When, Details), the paging line and buttons, the empty and warning messages.
// The route itself is proved in activityLogApi.test.js; these tests feed the helper the
// server's own groups and messages (backend/utils/activityLog.js) and entries shaped as
// toReplyEntry sends them.
import {
  EMPTY_FILTERS,
  GROUPS,
  MESSAGES,
  activityQuery,
  changedText,
  checkDates,
  detailLines,
  emptyText,
  hasFilters,
  hasNewer,
  hasOlder,
  kindOptions,
  pageText,
  personOptions,
  whenText,
  whoText,
} from "../../frontend/src/utils/activityLog";

const server = require("../utils/activityLog");

const RHEA = {
  id: "64a000000000000000000009",
  firstName: "Rhea",
  lastName: "Cruz",
  username: "rhea",
  status: "Active",
};
const OLD = {
  id: "64a00000000000000000000a",
  firstName: "",
  lastName: "",
  username: "oldadmin",
  status: "Inactive",
};

describe("the query string", () => {
  it("is empty with no filters on page 1", () => {
    expect(activityQuery(EMPTY_FILTERS)).toBe("");
    expect(activityQuery(EMPTY_FILTERS, 1)).toBe("");
    expect(activityQuery(undefined)).toBe("");
  });

  it("leaves out blank filters and trims the rest", () => {
    expect(
      activityQuery({ ...EMPTY_FILTERS, by: "me", q: "  liza  ", group: " " }),
    ).toBe("?by=me&q=liza");
  });

  it("carries every filter, in a fixed order, and the page after the first", () => {
    const query = activityQuery(
      {
        q: "carlo",
        to: "2026-11-16",
        from: "2026-11-16",
        group: "employees",
        by: RHEA.id,
      },
      3,
    );
    expect(query).toBe(
      `?by=${RHEA.id}&group=employees&from=2026-11-16&to=2026-11-16&q=carlo&page=3`,
    );
  });

  it("escapes the search text", () => {
    expect(activityQuery({ ...EMPTY_FILTERS, q: "Ramos & Co" })).toBe(
      "?q=Ramos+%26+Co",
    );
  });

  it("sends no page for a page that is not a whole number above 1", () => {
    for (const page of [0, -1, 1.5, "2", undefined, null]) {
      expect(activityQuery(EMPTY_FILTERS, page)).toBe("");
    }
  });

  it("is a query the server accepts", () => {
    const params = Object.fromEntries(
      new URLSearchParams(
        activityQuery(
          { by: "me", group: "filing", from: "2026-11-01", to: "2026-11-30", q: "a" },
          2,
        ),
      ),
    );
    const checked = server.checkActivityQuery(params);
    expect(checked.error).toBeUndefined();
    expect(checked).toMatchObject({ by: "me", group: "filing", q: "a", page: 2 });
  });

  it("knows whether any filter is on", () => {
    expect(hasFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasFilters({ ...EMPTY_FILTERS, q: "   " })).toBe(false);
    expect(hasFilters({ ...EMPTY_FILTERS, by: "me" })).toBe(true);
    expect(hasFilters({ ...EMPTY_FILTERS, to: "2026-11-01" })).toBe(true);
  });
});

describe("the Person and Kind choices", () => {
  it("lists Everyone, You, then each Admin, a disabled one marked", () => {
    expect(personOptions([RHEA, OLD])).toEqual([
      { value: "", label: "Everyone" },
      { value: "me", label: "You" },
      { value: RHEA.id, label: "Rhea Cruz" },
      { value: OLD.id, label: "oldadmin (disabled)" },
    ]);
  });

  it("offers Everyone and You before the Admin list loads", () => {
    expect(personOptions(undefined).map((option) => option.label)).toEqual([
      "Everyone",
      "You",
    ]);
  });

  it("lists All, then the server's groups in the server's order", () => {
    expect(GROUPS).toEqual(server.GROUPS);
    expect(kindOptions()).toEqual([
      { value: "", label: "All" },
      { value: "employees", label: "Employees" },
      { value: "signups", label: "Sign-ups" },
      { value: "access", label: "Page access" },
      { value: "attendance", label: "Attendance" },
      { value: "filing", label: "Filing" },
      { value: "company", label: "Company" },
      { value: "lists", label: "Lists" },
      { value: "admins", label: "Admin accounts" },
      { value: "holidays", label: "Holidays" },
      { value: "deductions", label: "Deductions" },
    ]);
    for (const option of kindOptions().slice(1)) {
      expect(server.checkActivityQuery({ group: option.value }).error).toBeUndefined();
    }
  });
});

describe("an entry", () => {
  const entry = server.toReplyEntry(
    {
      _id: "65a000000000000000000001",
      at: new Date("2026-11-13T06:05:00Z"),
      actorId: "64a000000000000000000001",
      actorName: "Ayber Admin",
      action: "employee.edit",
      group: "employees",
      targetName: "Angelica Ramos (AC-008)",
      changed: ["position", "basic pay"],
      note: "",
    },
    "64a000000000000000000001",
  );

  it('says "You" for the caller\'s own entries', () => {
    expect(whoText(entry.by)).toBe("You");
  });

  it("names an Admin as stored, never \"undefined\"", () => {
    expect(whoText({ id: RHEA.id, name: "Rhea Cruz", you: false })).toBe("Rhea Cruz");
    expect(whoText({ name: "", you: false })).toBe("Unknown");
    expect(whoText(undefined)).toBe("Unknown");
  });

  it("writes the time in Manila", () => {
    expect(whenText(entry.at)).toBe("Nov 13, 2026 2:05 PM");
    expect(whenText("2026-11-13T06:05:00.000Z")).toBe("Nov 13, 2026 2:05 PM");
    // 2026-11-15 16:30 UTC is the next morning in Manila
    expect(whenText("2026-11-15T16:30:00.000Z")).toBe("Nov 16, 2026 12:30 AM");
    expect(whenText("2026-11-16T04:00:00.000Z")).toBe("Nov 16, 2026 12:00 PM");
  });

  it("writes nothing for a missing or bad time", () => {
    for (const at of [undefined, null, "", "not a date"]) {
      expect(whenText(at)).toBe("");
    }
  });

  it('lists the changed fields as "Changed: ..."', () => {
    expect(changedText(entry.changed)).toBe("Changed: position, basic pay");
    expect(changedText(["contact number"])).toBe("Changed: contact number");
    expect(changedText([])).toBe("");
    expect(changedText(undefined)).toBe("");
  });

  it("puts the changed fields, then the note, in Details", () => {
    expect(detailLines(entry)).toEqual(["Changed: position, basic pay"]);
    expect(
      detailLines({ changed: ["time in"], note: "2026-11-12" }),
    ).toEqual(["Changed: time in", "2026-11-12"]);
    expect(
      detailLines({ changed: [], note: "Last working day 2026-10-16" }),
    ).toEqual(["Last working day 2026-10-16"]);
    expect(detailLines({ changed: [], note: "" })).toEqual([]);
  });
});

describe("paging", () => {
  it('says "Showing 51 to 100 of 312" on page 2', () => {
    expect(pageText({ page: 2, pageSize: 50, total: 312, count: 50 })).toBe(
      "Showing 51 to 100 of 312",
    );
  });

  it("counts a short last page", () => {
    expect(pageText({ page: 7, pageSize: 50, total: 312, count: 12 })).toBe(
      "Showing 301 to 312 of 312",
    );
    expect(pageText({ page: 1, pageSize: 50, total: 1, count: 1 })).toBe(
      "Showing 1 to 1 of 1",
    );
  });

  it("says nothing on an empty page", () => {
    expect(pageText({ page: 1, pageSize: 50, total: 0, count: 0 })).toBe("");
    expect(pageText({ page: 9, pageSize: 50, total: 60, count: 0 })).toBe("");
  });

  it("offers Newer after the first page and Older while entries are left", () => {
    expect(hasNewer(1)).toBe(false);
    expect(hasNewer(2)).toBe(true);
    expect(hasOlder({ page: 1, pageSize: 50, total: 60 })).toBe(true);
    expect(hasOlder({ page: 2, pageSize: 50, total: 60 })).toBe(false);
    expect(hasOlder({ page: 1, pageSize: 50, total: 50 })).toBe(false);
    expect(hasOlder({ page: 1, pageSize: 50, total: 0 })).toBe(false);
  });

  it("uses the server's page size", () => {
    expect(server.PAGE_SIZE).toBe(50);
  });
});

describe("messages", () => {
  it("catches a From after To with the server's own words", () => {
    expect(checkDates({ from: "2026-11-20", to: "2026-11-01" })).toBe(
      "The start date is after the end date.",
    );
    expect(MESSAGES.fromAfterTo).toBe(server.MESSAGES.fromAfterTo);
    expect(server.dayRange("2026-11-20", "2026-11-01").error).toBe(
      MESSAGES.fromAfterTo,
    );
  });

  it("lets the same day, an open end or no dates through", () => {
    expect(checkDates({ from: "2026-11-16", to: "2026-11-16" })).toBe("");
    expect(checkDates({ from: "2026-11-20", to: "" })).toBe("");
    expect(checkDates({ from: "", to: "2026-11-01" })).toBe("");
    expect(checkDates(EMPTY_FILTERS)).toBe("");
    expect(checkDates(undefined)).toBe("");
  });

  it("says the log is empty only when no filter is on", () => {
    expect(emptyText({ filtered: false, total: 0 })).toBe(
      "Nothing recorded yet. Changes made by you and the Admins appear here.",
    );
    expect(emptyText({ filtered: true, total: 0 })).toBe(
      "No activity matches these filters.",
    );
  });

  it("has the loading and failure words", () => {
    expect(MESSAGES.loading).toBe("Loading...");
    expect(MESSAGES.loadFailed).toBe("Could not load the activity log.");
  });

  it('never says "Super Admin"', () => {
    const texts = [
      ...Object.values(MESSAGES),
      ...personOptions([RHEA, OLD]).map((option) => option.label),
      ...kindOptions().map((option) => option.label),
      ...Object.values(server.ACTIONS).map((action) => action.label),
      whoText({ you: true }),
    ];
    for (const text of texts) expect(text).not.toMatch(/super\s*admin/i);
  });
});
