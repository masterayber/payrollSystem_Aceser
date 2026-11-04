const {
  normalize,
  headOfficeRoles,
  siteRole,
  rolesOnProject,
  hasLogisticsRole,
  isReservedDropdownValue,
  positionMessage,
  memberMessage,
  positionMatches,
} = require("../utils/logisticsAccess");

const USER = "64a000000000000000000001";
const OTHER = "64a000000000000000000002";

const project = (overrides = {}) => ({
  code: "ACE01",
  inChargeId: null,
  documentControllerIds: [],
  ...overrides,
});

describe("normalize", () => {
  it("trims and lower-cases, and treats null as empty", () => {
    expect(normalize("  Project In-charge ")).toBe("project in-charge");
    expect(normalize(null)).toBe("");
    expect(normalize(undefined)).toBe("");
  });
});

describe("headOfficeRoles", () => {
  it("matches positions after trim and case-insensitively", () => {
    expect([...headOfficeRoles({ position: "  procurement STAFF " })]).toEqual([
      "ProcurementStaff",
    ]);
    expect([...headOfficeRoles({ position: "Procurement Head" })]).toEqual([
      "ProcurementHead",
    ]);
  });

  it("matches the Accounting department", () => {
    expect([...headOfficeRoles({ department: " accounting " })]).toEqual([
      "Accounting",
    ]);
  });

  it("gives both roles to a Procurement Staff in department Accounting", () => {
    const roles = headOfficeRoles({
      position: "Procurement Staff",
      department: "Accounting",
    });
    expect(roles.has("ProcurementStaff")).toBe(true);
    expect(roles.has("Accounting")).toBe(true);
    expect(roles.size).toBe(2);
  });

  it("gives nothing for other positions or a missing job description", () => {
    expect(headOfficeRoles({ position: "Project Manager" }).size).toBe(0);
    expect(headOfficeRoles({ position: "Procurement" }).size).toBe(0);
    expect(headOfficeRoles(null).size).toBe(0);
    expect(headOfficeRoles(undefined).size).toBe(0);
  });
});

describe("siteRole", () => {
  it("matches after trim and case-insensitively", () => {
    expect(siteRole({ position: "  project in-charge " })).toBe("ProjectInCharge");
    expect(siteRole({ position: "DOCUMENT CONTROLLER" })).toBe(
      "DocumentController",
    );
  });

  it("does not match near misses", () => {
    expect(siteRole({ position: "Project Manager" })).toBeNull();
    expect(siteRole({ position: "Project Incharge" })).toBeNull();
    expect(siteRole({ position: "Procurement Staff" })).toBeNull();
    expect(siteRole(null)).toBeNull();
  });
});

describe("rolesOnProject", () => {
  it("returns ProjectInCharge only when inChargeId matches and the position is Project In-charge", () => {
    const job = { position: "Project In-charge" };
    expect(
      rolesOnProject(USER, job, project({ inChargeId: USER })).has(
        "ProjectInCharge",
      ),
    ).toBe(true);
    expect(
      rolesOnProject(USER, job, project({ inChargeId: OTHER })).has(
        "ProjectInCharge",
      ),
    ).toBe(false);
    expect(
      rolesOnProject(
        USER,
        { position: "Document Controller" },
        project({ inChargeId: USER }),
      ).has("ProjectInCharge"),
    ).toBe(false);
  });

  it("returns DocumentController when listed and the position matches", () => {
    const roles = rolesOnProject(
      USER,
      { position: "Document Controller" },
      project({ documentControllerIds: [OTHER, USER] }),
    );
    expect(roles.has("DocumentController")).toBe(true);
    expect(roles.size).toBe(1);
  });

  it("compares ids as strings", () => {
    const roles = rolesOnProject(
      { toString: () => USER },
      { position: "Document Controller" },
      project({ documentControllerIds: [{ toString: () => USER }] }),
    );
    expect(roles.has("DocumentController")).toBe(true);
  });

  it("drops a DC whose position changed to Procurement Staff but keeps ProcurementStaff", () => {
    const roles = rolesOnProject(
      USER,
      { position: "Procurement Staff" },
      project({ documentControllerIds: [USER] }),
    );
    expect(roles.has("DocumentController")).toBe(false);
    expect(roles.has("ProcurementStaff")).toBe(true);
  });

  it("returns only head-office roles when there is no project", () => {
    const roles = rolesOnProject(USER, { position: "Procurement Head" }, null);
    expect([...roles]).toEqual(["ProcurementHead"]);
    expect(
      rolesOnProject(USER, { position: "Project In-charge" }, null).size,
    ).toBe(0);
  });
});

describe("hasLogisticsRole", () => {
  it("passes Admin whatever the roles", () => {
    expect(
      hasLogisticsRole({ userId: USER, isAdmin: true }, ["ProjectInCharge"]),
    ).toBe(true);
  });

  it("refuses a site role without a project", () => {
    expect(
      hasLogisticsRole(
        { userId: USER, jobDescription: { position: "Project In-charge" } },
        ["ProjectInCharge"],
      ),
    ).toBe(false);
  });

  it("refuses a site role without membership on the project", () => {
    expect(
      hasLogisticsRole(
        { userId: USER, jobDescription: { position: "Document Controller" } },
        ["DocumentController"],
        project({ documentControllerIds: [OTHER] }),
      ),
    ).toBe(false);
  });

  it("passes a site role with membership", () => {
    expect(
      hasLogisticsRole(
        { userId: USER, jobDescription: { position: "Document Controller" } },
        ["DocumentController"],
        project({ documentControllerIds: [USER] }),
      ),
    ).toBe(true);
  });

  it("passes a head-office role without a project", () => {
    expect(
      hasLogisticsRole(
        { userId: USER, jobDescription: { position: "Procurement Staff" } },
        ["ProcurementStaff", "ProcurementHead"],
      ),
    ).toBe(true);
    expect(
      hasLogisticsRole(
        { userId: USER, jobDescription: { department: "Accounting" } },
        "Accounting",
      ),
    ).toBe(true);
  });

  it("refuses a head-office role the person does not hold", () => {
    expect(
      hasLogisticsRole(
        { userId: USER, jobDescription: { position: "Procurement Staff" } },
        ["ProcurementHead"],
      ),
    ).toBe(false);
  });
});

describe("isReservedDropdownValue", () => {
  it("recognises reserved positions, case-insensitively", () => {
    expect(isReservedDropdownValue("positions", "Project In-charge")).toBe(true);
    expect(isReservedDropdownValue("positions", "  project in-charge ")).toBe(
      true,
    );
    expect(isReservedDropdownValue("position", "DOCUMENT CONTROLLER")).toBe(
      true,
    );
    expect(isReservedDropdownValue("positions", "Procurement Staff")).toBe(true);
    expect(isReservedDropdownValue("positions", "Procurement Head")).toBe(true);
  });

  it("recognises reserved departments", () => {
    expect(isReservedDropdownValue("departments", "accounting")).toBe(true);
    expect(isReservedDropdownValue("department", "Accounting")).toBe(true);
  });

  it("is false for other values, the wrong kind, or an unknown kind", () => {
    expect(isReservedDropdownValue("positions", "Project Manager")).toBe(false);
    expect(isReservedDropdownValue("positions", "Accounting")).toBe(false);
    expect(isReservedDropdownValue("departments", "Project In-charge")).toBe(
      false,
    );
    expect(isReservedDropdownValue("designations", "Accounting")).toBe(false);
    expect(isReservedDropdownValue("positions", null)).toBe(false);
  });
});

describe("positionMessage", () => {
  it("names one position", () => {
    expect(positionMessage(["ProjectInCharge"])).toBe(
      "This needs the position Project In-charge.",
    );
  });

  it("joins positions with or", () => {
    expect(positionMessage(["ProcurementStaff", "ProcurementHead"])).toBe(
      "This needs the position Procurement Staff or Procurement Head.",
    );
  });

  it("names the department for Accounting", () => {
    expect(positionMessage(["Accounting"])).toBe(
      "This needs the department Accounting.",
    );
  });

  it("appends the department after the positions", () => {
    expect(
      positionMessage(["ProcurementStaff", "ProcurementHead", "Accounting"]),
    ).toBe(
      "This needs the position Procurement Staff or Procurement Head, or the department Accounting.",
    );
  });
});

describe("memberMessage", () => {
  it("names the project code", () => {
    expect(memberMessage({ code: "ACE01" })).toBe(
      "You are not assigned to project ACE01.",
    );
  });
});

describe("positionMatches", () => {
  it("matches the role's position label", () => {
    expect(
      positionMatches({ position: " document controller " }, "DocumentController"),
    ).toBe(true);
    expect(positionMatches({ position: "Project In-charge" }, "ProjectInCharge")).toBe(
      true,
    );
    expect(positionMatches({ position: "Procurement Staff" }, "ProjectInCharge")).toBe(
      false,
    );
  });

  it("matches the department for Accounting", () => {
    expect(positionMatches({ department: "Accounting" }, "Accounting")).toBe(true);
    expect(positionMatches({ position: "Accounting" }, "Accounting")).toBe(false);
  });

  it("is false for an unknown role or a missing job description", () => {
    expect(positionMatches({ position: "Project In-charge" }, "Nobody")).toBe(false);
    expect(positionMatches(null, "ProjectInCharge")).toBe(false);
  });
});
