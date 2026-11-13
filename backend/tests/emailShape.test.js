// The server's email-shape check (utils/emailShape.js) and its use in checkAdminDetails
// (utils/adminAccounts.js). Friday batch, Group 2, decision 3: Admin accounts and an
// Admin's own Settings > General refuse an email without the shape, with the screen's
// own words "Enter a valid email address.". The routes are proved in admins.test.js and
// adminGeneralSettings.test.js.
import { checkAdminForm } from "../../frontend/src/utils/adminAccounts";

const {
  EMAIL_SHAPE_MESSAGE,
  isEmailShape,
} = require("../utils/emailShape");
const { MESSAGES, checkAdminDetails } = require("../utils/adminAccounts");

const GOOD = [
  "rhea@example.com",
  "rhea.cruz@example.com.ph",
  "HR.Rhea@Example.com",
  "a+b@c.co",
  " rhea@example.com ",
];
const BAD = [
  "rhea",
  "rhea@",
  "@example.com",
  "rhea@example",
  "rhea cruz@example.com",
  "rhea@@example.com",
  "rhea@exa mple.com",
  "",
  "   ",
];

describe("isEmailShape", () => {
  it.each(GOOD)("accepts %j", (email) => {
    expect(isEmailShape(email)).toBe(true);
  });

  it.each(BAD)("refuses %j", (email) => {
    expect(isEmailShape(email)).toBe(false);
  });

  it("refuses a value that is not text", () => {
    for (const value of [undefined, null, 5, {}, ["a@b.co"]]) {
      expect(isEmailShape(value)).toBe(false);
    }
  });

  it("uses the screen's words", () => {
    expect(EMAIL_SHAPE_MESSAGE).toBe("Enter a valid email address.");
  });
});

describe("the server and the Settings > Admins form agree", () => {
  const filled = {
    firstName: "Rhea",
    lastName: "Cruz",
    username: "hr.rhea",
  };

  it.each([...GOOD, ...BAD.filter((email) => email.trim() !== "")])(
    "gives the same answer for %j",
    (email) => {
      const screen = checkAdminForm({ ...filled, email });
      const server = checkAdminDetails({ ...filled, email }, { creating: true });
      expect(server.error ?? "").toBe(screen);
    },
  );
});

describe("checkAdminDetails checks the email's shape", () => {
  const NEW_ADMIN = {
    firstName: "Rhea",
    lastName: "Cruz",
    username: "hr.rhea",
    email: "rhea@example.com",
  };

  it("refuses a badly shaped email on create", () => {
    expect(
      checkAdminDetails({ ...NEW_ADMIN, email: "rhea@example" }, { creating: true }),
    ).toEqual({ error: "Enter a valid email address." });
    expect(MESSAGES.emailShape).toBe(EMAIL_SHAPE_MESSAGE);
  });

  it("refuses a badly shaped email on edit", () => {
    expect(checkAdminDetails({ email: "rhea" })).toEqual({
      error: "Enter a valid email address.",
    });
  });

  it("does not ask for the email's shape on an edit that leaves the email out", () => {
    expect(checkAdminDetails({ lastName: "Ruiz" })).toEqual({
      fields: { lastName: "Ruiz" },
      employeeIds: [],
    });
  });

  it("asks for the blanks before the email's shape, as the screen does", () => {
    expect(
      checkAdminDetails(
        { ...NEW_ADMIN, firstName: "", email: "bad" },
        { creating: true },
      ),
    ).toEqual({ error: MESSAGES.required });
  });

  it("checks the shape before the page keys", () => {
    expect(
      checkAdminDetails(
        { ...NEW_ADMIN, email: "bad", pages: ["nope"] },
        { creating: true },
      ),
    ).toEqual({ error: "Enter a valid email address." });
  });

  it("stores the trimmed email when the shape is right", () => {
    const { fields } = checkAdminDetails(
      { ...NEW_ADMIN, email: "  rhea@example.com " },
      { creating: true },
    );
    expect(fields.email).toBe("rhea@example.com");
  });
});
