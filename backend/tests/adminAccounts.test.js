// The pure rules behind /api/admins (utils/adminAccounts.js) and the linked-employee
// rule (utils/linkedEmployee.js). The API itself is in admins.test.js.
const mongoose = require("mongoose");

const {
  MESSAGES,
  checkAdminDetails,
  firstMissingEmployee,
  describeAdmin,
} = require("../utils/adminAccounts");
const {
  OWN_RECORD_MESSAGE,
  isOwnLinkedEmployee,
  projectSeat,
  changesOwnProjectSeat,
} = require("../utils/linkedEmployee");
const { ADMIN_DEFAULT_PAGE_KEYS } = require("../config/pages");

const id = () => String(new mongoose.Types.ObjectId());

const NEW_ADMIN = {
  firstName: "Rhea",
  lastName: "Cruz",
  username: "hr.rhea",
  email: "rhea@example.com",
};

describe("checkAdminDetails, creating an Admin", () => {
  it("fills the HR set, an empty pay list and no linked employee by default", () => {
    expect(checkAdminDetails(NEW_ADMIN, { creating: true })).toEqual({
      fields: {
        ...NEW_ADMIN,
        pageAccess: ADMIN_DEFAULT_PAGE_KEYS,
        payAccess: [],
        linkedEmployeeId: null,
      },
      employeeIds: [],
    });
  });

  it("trims the names, username and email", () => {
    const { fields } = checkAdminDetails(
      {
        firstName: " Rhea ",
        lastName: " Cruz",
        username: "hr.rhea ",
        email: " rhea@example.com ",
      },
      { creating: true },
    );
    expect(fields).toMatchObject(NEW_ADMIN);
  });

  it.each(["firstName", "lastName", "username", "email"])(
    "refuses a missing or blank %s",
    (key) => {
      for (const value of [undefined, "", "   ", 5]) {
        const body = { ...NEW_ADMIN, [key]: value };
        expect(checkAdminDetails(body, { creating: true })).toEqual({
          error: "First name, last name, username and email are required.",
        });
      }
    },
  );

  it("refuses an empty or missing body as missing fields", () => {
    for (const body of [undefined, null, {}]) {
      expect(checkAdminDetails(body, { creating: true }).error).toBe(
        MESSAGES.required,
      );
    }
  });

  it("refuses any role key, whatever its value, before anything else (rule 2)", () => {
    for (const role of ["Admin", "Super Admin", "Employee", "", null]) {
      expect(checkAdminDetails({ role }, { creating: true })).toEqual({
        error: "Role can't be changed.",
      });
    }
  });

  it("stores the ticked pages in config order with the fixed ones", () => {
    const { fields } = checkAdminDetails(
      { ...NEW_ADMIN, pages: ["reports", "employees"] },
      { creating: true },
    );
    expect(fields.pageAccess).toEqual([
      "admin-dashboard",
      "employees",
      "reports",
      "admin-settings",
    ]);
  });

  it("keeps only the fixed pages for an empty list", () => {
    const { fields } = checkAdminDetails(
      { ...NEW_ADMIN, pages: [] },
      { creating: true },
    );
    expect(fields.pageAccess).toEqual(["admin-dashboard", "admin-settings"]);
  });

  it("refuses keys that are not admin pages, naming them", () => {
    expect(
      checkAdminDetails(
        { ...NEW_ADMIN, pages: ["employees", "payroll", "nope", "payroll"] },
        { creating: true },
      ),
    ).toEqual({ error: "Not an admin page: payroll, nope" });
  });

  it("refuses pages that are not a list of strings", () => {
    for (const pages of ["employees", [1], null, {}]) {
      expect(
        checkAdminDetails({ ...NEW_ADMIN, pages }, { creating: true }).error,
      ).toBe(MESSAGES.pagesNotList);
    }
  });

  it("asks the route to check the pay list and the linked employee, once each", () => {
    const a = id();
    const b = id();
    const result = checkAdminDetails(
      { ...NEW_ADMIN, payAccess: [a, b, a], linkedEmployeeId: b },
      { creating: true },
    );
    expect(result.fields.payAccess).toEqual([a, b]);
    expect(result.fields.linkedEmployeeId).toBe(b);
    expect(result.employeeIds).toEqual([a, b]);
  });

  it("leaves a malformed id to the route, which refuses it with the other ids", () => {
    const a = id();
    const result = checkAdminDetails(
      { ...NEW_ADMIN, payAccess: [a, "abc"], linkedEmployeeId: "xyz" },
      { creating: true },
    );
    expect(result.error).toBeUndefined();
    expect(result.employeeIds).toEqual([a, "abc", "xyz"]);
    expect(firstMissingEmployee(result.employeeIds, [a])).toBe("abc");
  });

  it("refuses a pay list that is not a list", () => {
    expect(
      checkAdminDetails({ ...NEW_ADMIN, payAccess: id() }, { creating: true })
        .error,
    ).toBe(MESSAGES.payAccessNotList);
  });

  it("takes no status, password, flag or creator from the body", () => {
    const { fields } = checkAdminDetails(
      {
        ...NEW_ADMIN,
        status: "Inactive",
        password: "chosenbyme",
        mustChangePassword: false,
        createdBy: id(),
        pageAccess: ["reports"],
      },
      { creating: true },
    );
    expect(Object.keys(fields).sort()).toEqual(
      [
        "email",
        "firstName",
        "lastName",
        "linkedEmployeeId",
        "pageAccess",
        "payAccess",
        "username",
      ].sort(),
    );
    expect(fields.pageAccess).toEqual(ADMIN_DEFAULT_PAGE_KEYS);
  });
});

describe("checkAdminDetails, editing an Admin", () => {
  it("changes only the keys sent", () => {
    expect(checkAdminDetails({ lastName: "Ruiz" })).toEqual({
      fields: { lastName: "Ruiz" },
      employeeIds: [],
    });
    expect(checkAdminDetails({})).toEqual({ fields: {}, employeeIds: [] });
  });

  it("ignores a username: it can't be changed", () => {
    expect(checkAdminDetails({ username: "someone.else" })).toEqual({
      fields: {},
      employeeIds: [],
    });
  });

  it("refuses a role key", () => {
    expect(checkAdminDetails({ role: "Super Admin" })).toEqual({
      error: "Role can't be changed.",
    });
  });

  it("refuses a blank name or email that is sent", () => {
    for (const key of ["firstName", "lastName", "email"]) {
      expect(checkAdminDetails({ [key]: " " }).error).toBe(MESSAGES.required);
    }
  });

  it("clears the linked employee with null or an empty string", () => {
    expect(checkAdminDetails({ linkedEmployeeId: null }).fields).toEqual({
      linkedEmployeeId: null,
    });
    expect(checkAdminDetails({ linkedEmployeeId: "" }).fields).toEqual({
      linkedEmployeeId: null,
    });
  });

  it("empties the pay list with an empty list", () => {
    expect(checkAdminDetails({ payAccess: [] }).fields).toEqual({
      payAccess: [],
    });
  });
});

describe("firstMissingEmployee", () => {
  it("gives the first id, in order, that was not found", () => {
    const [a, b, c] = [id(), id(), id()];
    expect(firstMissingEmployee([a, b, c], [a, c])).toBe(b);
    expect(firstMissingEmployee([a, b], [new mongoose.Types.ObjectId(a), b])).toBe(
      null,
    );
    expect(firstMissingEmployee([], [])).toBe(null);
  });
});

describe("describeAdmin", () => {
  const ana = id();
  const ben = id();
  const gone = id();
  const people = new Map([
    [ana, { name: "Ana Reyes", employeeId: "AC-001", status: "Active" }],
    [ben, { name: "Ben Cruz", employeeId: "AC-002", status: "Resigned" }],
  ]);
  const admin = {
    _id: new mongoose.Types.ObjectId(),
    firstName: "Rhea",
    lastName: "Cruz",
    username: "hr.rhea",
    email: "rhea@example.com",
    status: "Active",
    mustChangePassword: true,
    pageAccess: ["admin-dashboard", "employees", "admin-settings"],
    payAccess: [new mongoose.Types.ObjectId(ana), ben, gone],
    linkedEmployeeId: new mongoose.Types.ObjectId(ben),
    lastLogin: null,
    password: "hash",
    resetToken: "token",
  };

  it("lists the Admin with names on its pay list and its linked employee", () => {
    expect(describeAdmin(admin, people)).toEqual({
      id: String(admin._id),
      firstName: "Rhea",
      lastName: "Cruz",
      username: "hr.rhea",
      email: "rhea@example.com",
      status: "Active",
      mustChangePassword: true,
      pages: ["admin-dashboard", "employees", "admin-settings"],
      payAccess: [
        { id: ana, name: "Ana Reyes", employeeId: "AC-001", status: "Active" },
        { id: ben, name: "Ben Cruz", employeeId: "AC-002", status: "Resigned" },
      ],
      linkedEmployee: { id: ben, name: "Ben Cruz" },
      lastLogin: null,
    });
  });

  it("never carries the password hash or a reset token", () => {
    const reply = describeAdmin(admin, people);
    expect(reply).not.toHaveProperty("password");
    expect(reply).not.toHaveProperty("resetToken");
  });

  it("gives the fixed pages, an empty pay list and no link when nothing is stored", () => {
    const reply = describeAdmin({ _id: admin._id, status: "Inactive" });
    expect(reply.pages).toEqual(["admin-dashboard", "admin-settings"]);
    expect(reply.payAccess).toEqual([]);
    expect(reply.linkedEmployee).toBeNull();
    expect(reply.mustChangePassword).toBe(false);
  });
});

describe("isOwnLinkedEmployee (rule 16)", () => {
  const linked = new mongoose.Types.ObjectId();
  const other = id();
  const hr = { role: "Admin", linkedEmployeeId: linked };

  it("is true for an Admin and its linked employee, ObjectId or string", () => {
    expect(isOwnLinkedEmployee(hr, linked)).toBe(true);
    expect(isOwnLinkedEmployee(hr, String(linked))).toBe(true);
  });

  it("is false for anyone else's record", () => {
    expect(isOwnLinkedEmployee(hr, other)).toBe(false);
    expect(isOwnLinkedEmployee(hr, undefined)).toBe(false);
  });

  it("is false for an Admin with no linked employee", () => {
    expect(isOwnLinkedEmployee({ role: "Admin" }, other)).toBe(false);
  });

  it("never stops the Super Admin or an Employee", () => {
    expect(
      isOwnLinkedEmployee({ role: "Super Admin", linkedEmployeeId: linked }, linked),
    ).toBe(false);
    expect(
      isOwnLinkedEmployee({ role: "Employee", linkedEmployeeId: linked }, linked),
    ).toBe(false);
    expect(isOwnLinkedEmployee(null, linked)).toBe(false);
  });

  it("has the message the screen shows", () => {
    expect(OWN_RECORD_MESSAGE).toBe("You can't act on your own employee record.");
  });
});

describe("projectSeat and changesOwnProjectSeat (rule 16 in Logistics)", () => {
  const linked = new mongoose.Types.ObjectId();
  const other = new mongoose.Types.ObjectId();
  const hr = { role: "Admin", linkedEmployeeId: linked };
  const empty = { inChargeId: null, documentControllerIds: [] };
  const asInCharge = { inChargeId: linked, documentControllerIds: [other] };
  const asController = { inChargeId: other, documentControllerIds: [String(linked)] };

  it("names the seat a person holds, ObjectId or string", () => {
    expect(projectSeat(linked, asInCharge)).toBe("ProjectInCharge");
    expect(projectSeat(String(linked), asController)).toBe("DocumentController");
    expect(projectSeat(linked, empty)).toBeNull();
    expect(projectSeat(linked, {})).toBeNull();
    expect(projectSeat(linked, { documentControllerIds: "nope" })).toBeNull();
    expect(projectSeat(null, asInCharge)).toBeNull();
  });

  it("is true when the linked employee is seated, unseated or moved", () => {
    expect(changesOwnProjectSeat(hr, {}, asInCharge)).toBe(true);
    expect(changesOwnProjectSeat(hr, empty, asController)).toBe(true);
    expect(changesOwnProjectSeat(hr, asInCharge, empty)).toBe(true);
    expect(changesOwnProjectSeat(hr, asInCharge, asController)).toBe(true);
  });

  it("is false when the linked employee's seat stays as it was", () => {
    expect(changesOwnProjectSeat(hr, asInCharge, { ...asInCharge })).toBe(false);
    expect(changesOwnProjectSeat(hr, empty, { inChargeId: other })).toBe(false);
  });

  it("is false for an unlinked Admin, the Super Admin and an Employee", () => {
    expect(changesOwnProjectSeat({ role: "Admin" }, {}, asInCharge)).toBe(false);
    expect(
      changesOwnProjectSeat(
        { role: "Super Admin", linkedEmployeeId: linked },
        {},
        asInCharge,
      ),
    ).toBe(false);
    expect(
      changesOwnProjectSeat(
        { role: "Employee", linkedEmployeeId: linked },
        {},
        asInCharge,
      ),
    ).toBe(false);
    expect(changesOwnProjectSeat(null, {}, asInCharge)).toBe(false);
  });
});
