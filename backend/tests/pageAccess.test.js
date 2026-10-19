const { getAllowedPages } = require("../utils/pageAccess");

describe("getAllowedPages", () => {
  it("leaves logistics off for an employee by default", () => {
    expect(getAllowedPages({ role: "Employee" })).not.toContain("logistics");
  });

  it("includes logistics once an admin grants it", () => {
    expect(
      getAllowedPages({ role: "Employee", pageAccess: ["logistics"] }),
    ).toContain("logistics");
  });

  it("always includes logistics for an admin", () => {
    expect(getAllowedPages({ role: "Admin" })).toContain("logistics");
  });
});
