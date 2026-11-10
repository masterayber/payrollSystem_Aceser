// utils/ignoreCase.js: the case-insensitive match behind the "already taken" and
// "already registered" checks. The routes using it are in admins.test.js and
// app.test.js.
const { escapeRegex, ignoreCase } = require("../utils/ignoreCase");

// What MongoDB would do with the condition, in plain JavaScript
const matches = (condition, stored) =>
  new RegExp(condition.$regex, condition.$options).test(stored);

describe("ignoreCase", () => {
  it("matches the same text in any case", () => {
    const condition = ignoreCase("Test.Admin@aceserph.com");
    expect(matches(condition, "test.admin@aceserph.com")).toBe(true);
    expect(matches(condition, "TEST.ADMIN@ACESERPH.COM")).toBe(true);
    expect(matches(condition, "Test.Admin@aceserph.com")).toBe(true);
  });

  it("matches the whole value only", () => {
    const condition = ignoreCase("ana");
    expect(matches(condition, "ana.cruz")).toBe(false);
    expect(matches(condition, "hana")).toBe(false);
  });

  it("takes regular-expression characters literally", () => {
    const condition = ignoreCase("a.b+c@x.com");
    expect(matches(condition, "a.b+c@x.com")).toBe(true);
    expect(matches(condition, "aXbbbc@xYcom")).toBe(false);
    expect(matches(ignoreCase(".*"), "anything")).toBe(false);
  });

  it("returns a value that is not a string as it is", () => {
    expect(ignoreCase(undefined)).toBeUndefined();
    expect(ignoreCase(null)).toBeNull();
    expect(ignoreCase(5)).toBe(5);
  });
});

describe("escapeRegex", () => {
  it("escapes every special character", () => {
    expect(escapeRegex(".*+?^${}()|[]\\")).toBe(
      "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\",
    );
    expect(escapeRegex("plain-text_1")).toBe("plain-text_1");
  });
});
