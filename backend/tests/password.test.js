// The password rule: one for every account, at least 8 characters counted as typed,
// no letter, number or special-character requirement.
const {
  MIN_PASSWORD_LENGTH,
  checkNewPassword,
  forcesPasswordChange,
  TEMPORARY_PASSWORD_LENGTH,
  TEMPORARY_PASSWORD_CHARACTERS,
  generateTemporaryPassword,
} = require("../utils/password");

const SAME = "New password must be different from the current one.";

describe("MIN_PASSWORD_LENGTH", () => {
  it("is 8", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });
});

describe("checkNewPassword, own new password (default wording)", () => {
  it("refuses a blank password as required", () => {
    for (const next of ["", "   ", "        ", "\t\n", undefined, null, 12345678]) {
      expect(checkNewPassword({ next })).toBe("New password is required.");
    }
  });

  it("refuses 7 characters and accepts 8", () => {
    expect(checkNewPassword({ next: "abcdefg" })).toBe(
      "New password must be at least 8 characters.",
    );
    expect(checkNewPassword({ next: "a" })).toBe(
      "New password must be at least 8 characters.",
    );
    expect(checkNewPassword({ next: "abcdefgh" })).toBeNull();
    expect(checkNewPassword({ next: "Rhea2026x" })).toBeNull();
  });

  it("asks for no letter, number or special character", () => {
    expect(checkNewPassword({ next: "12345678" })).toBeNull();
    expect(checkNewPassword({ next: "abcdefgh" })).toBeNull();
    expect(checkNewPassword({ next: "!!!!!!!!" })).toBeNull();
    expect(checkNewPassword({ next: "ññññññññ" })).toBeNull();
  });

  it("counts the length as typed, spaces included (no trimming)", () => {
    expect(checkNewPassword({ next: " abc def" })).toBeNull();
    expect(checkNewPassword({ next: "  abc   " })).toBeNull();
    expect(checkNewPassword({ next: " abc de" })).toBe(
      "New password must be at least 8 characters.",
    );
  });

  it("refuses the current password on change password, after the length", () => {
    expect(
      checkNewPassword({ next: "Rhea2026x", current: "Rhea2026x" }),
    ).toBe(SAME);
    // Too short hears about the length first
    expect(checkNewPassword({ next: "abc", current: "abc" })).toBe(
      "New password must be at least 8 characters.",
    );
    expect(
      checkNewPassword({ next: "Rhea2026y", current: "Rhea2026x" }),
    ).toBeNull();
  });

  it("has no 'different' check without a current password (Forgot password)", () => {
    expect(checkNewPassword({ next: "samesame" })).toBeNull();
  });
});

describe("checkNewPassword, plain wording (sign-up and the admin forms)", () => {
  it("names the field just 'Password'", () => {
    expect(checkNewPassword({ next: "", wording: "plain" })).toBe(
      "Password is required.",
    );
    expect(checkNewPassword({ next: "        ", wording: "plain" })).toBe(
      "Password is required.",
    );
    expect(checkNewPassword({ next: undefined, wording: "plain" })).toBe(
      "Password is required.",
    );
    expect(checkNewPassword({ next: "abcdefg", wording: "plain" })).toBe(
      "Password must be at least 8 characters.",
    );
    expect(checkNewPassword({ next: "abcdefgh", wording: "plain" })).toBeNull();
  });
});

describe("forcesPasswordChange, the forced-change rule", () => {
  const mongoose = require("mongoose");
  const admin = new mongoose.Types.ObjectId();
  const employee = new mongoose.Types.ObjectId();

  it("is true when someone else's password is set (an admin or the Super Admin)", () => {
    expect(forcesPasswordChange({ setBy: admin, account: employee })).toBe(true);
    expect(
      forcesPasswordChange({ setBy: String(admin), account: employee }),
    ).toBe(true);
  });

  it("is false for the person's own password, ObjectId or string", () => {
    expect(forcesPasswordChange({ setBy: admin, account: admin })).toBe(false);
    expect(
      forcesPasswordChange({ setBy: String(admin), account: admin }),
    ).toBe(false);
    expect(
      forcesPasswordChange({ setBy: admin, account: String(admin) }),
    ).toBe(false);
  });

  it("is false when either id is missing (no signed-in setter to blame)", () => {
    expect(forcesPasswordChange({ setBy: undefined, account: employee })).toBe(
      false,
    );
    expect(forcesPasswordChange({ setBy: admin, account: null })).toBe(false);
  });
});

// The temporary password generator (moved from the sample reset script in PR B): a new
// Admin account and the Super Admin's Reset password use it
describe("generateTemporaryPassword", () => {
  const LOOK_ALIKES = ["0", "O", "o", "1", "l", "I"];
  const many = Array.from({ length: 200 }, () => generateTemporaryPassword());

  it("is 12 characters by default", () => {
    expect(TEMPORARY_PASSWORD_LENGTH).toBe(12);
    for (const password of many) expect(password).toHaveLength(12);
  });

  it("always meets the password rule", () => {
    for (const password of many) {
      expect(checkNewPassword({ next: password })).toBeNull();
      expect(checkNewPassword({ next: password, wording: "plain" })).toBeNull();
    }
  });

  it("uses letters and digits only, without look-alikes", () => {
    for (const ch of LOOK_ALIKES) {
      expect(TEMPORARY_PASSWORD_CHARACTERS).not.toContain(ch);
    }
    for (const password of many) {
      expect(password).toMatch(/^[A-Za-z2-9]+$/);
      for (const ch of LOOK_ALIKES) expect(password).not.toContain(ch);
    }
  });

  it("has a lower-case letter, a capital and a digit every time", () => {
    for (const password of many) {
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[2-9]/);
    }
  });

  it("gives a different password each time", () => {
    expect(new Set(many).size).toBe(many.length);
  });

  it("takes another length, never below the minimum", () => {
    expect(generateTemporaryPassword(16)).toHaveLength(16);
    expect(generateTemporaryPassword(4)).toHaveLength(MIN_PASSWORD_LENGTH);
  });
});
