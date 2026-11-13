// The message kept for the sign-in page (frontend/src/utils/session.js): a forced
// sign-out (account no longer active, role changed), inactivity or a password reset
// stores { type, text } for exactly one page load; the sign-in page takes it (reads and
// removes it) and shows it in the feedback box (yellow, or green after a reset). Blocked
// or broken storage never throws. The screens themselves are checked by hand.

import {
  ACCOUNT_INACTIVE_MESSAGE,
  ROLE_CHANGED_MESSAGE,
  SESSION_INACTIVE_MESSAGE,
  SIGN_IN_NOTICE_KEY,
  endSession,
  keepSignInNotice,
  takeSignInNotice,
} from "../../frontend/src/utils/session";

// A small in-memory Storage (the tests run in Node, which has none)
const makeStorage = () => {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
    has: (key) => items.has(key),
  };
};

// Storage that refuses every call, as in a browser with storage blocked
const blockedStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

let replacedTo;

beforeEach(() => {
  global.sessionStorage = makeStorage();
  global.localStorage = makeStorage();
  replacedTo = [];
  global.window = { location: { replace: (path) => replacedTo.push(path) } };
});

afterAll(() => {
  delete global.sessionStorage;
  delete global.localStorage;
  delete global.window;
});

describe("keepSignInNotice and takeSignInNotice", () => {
  test("a kept message is yellow by default and is taken exactly once", () => {
    keepSignInNotice(ACCOUNT_INACTIVE_MESSAGE);

    expect(takeSignInNotice()).toEqual({
      type: "warning",
      text: "Your account is no longer active.",
    });
    // Removed as it was read: the next page load shows nothing
    expect(global.sessionStorage.has(SIGN_IN_NOTICE_KEY)).toBe(false);
    expect(takeSignInNotice()).toBeNull();
  });

  test("the type is kept with the text (green after a password reset)", () => {
    keepSignInNotice("Password has been reset successfully.", "success");
    expect(takeSignInNotice()).toEqual({
      type: "success",
      text: "Password has been reset successfully.",
    });
  });

  test("an unknown type falls back to yellow", () => {
    keepSignInNotice("Something to say.", "purple");
    expect(takeSignInNotice()).toEqual({
      type: "warning",
      text: "Something to say.",
    });
  });

  test("a newer message replaces an older one", () => {
    keepSignInNotice(SESSION_INACTIVE_MESSAGE);
    keepSignInNotice(ROLE_CHANGED_MESSAGE);
    expect(takeSignInNotice()).toEqual({
      type: "warning",
      text: "Your role has changed. Please sign in again.",
    });
  });

  test("empty or non-text messages are not kept", () => {
    keepSignInNotice("");
    keepSignInNotice(undefined);
    keepSignInNotice({ text: "not a string" });
    expect(global.sessionStorage.has(SIGN_IN_NOTICE_KEY)).toBe(false);
    expect(takeSignInNotice()).toBeNull();
  });

  test("nothing kept gives null", () => {
    expect(takeSignInNotice()).toBeNull();
  });

  test("a broken stored value gives null and is removed", () => {
    global.sessionStorage.setItem(SIGN_IN_NOTICE_KEY, "{not json");
    expect(takeSignInNotice()).toBeNull();
    expect(global.sessionStorage.has(SIGN_IN_NOTICE_KEY)).toBe(false);

    global.sessionStorage.setItem(SIGN_IN_NOTICE_KEY, JSON.stringify({ type: "warning" }));
    expect(takeSignInNotice()).toBeNull();
  });

  test("blocked storage never throws", () => {
    global.sessionStorage = blockedStorage;
    expect(() => keepSignInNotice(ACCOUNT_INACTIVE_MESSAGE)).not.toThrow();
    expect(takeSignInNotice()).toBeNull();
  });

  test("no storage at all never throws", () => {
    delete global.sessionStorage;
    expect(() => keepSignInNotice(ACCOUNT_INACTIVE_MESSAGE)).not.toThrow();
    expect(takeSignInNotice()).toBeNull();
  });
});

describe("endSession keeps the message for the sign-in page", () => {
  test("inactivity keeps the yellow inactivity message and goes to sign-in", () => {
    global.localStorage.setItem("token", "t");
    global.localStorage.setItem("userData", "{}");
    global.localStorage.setItem("lastActivity", "1");

    endSession("inactive");

    expect(takeSignInNotice()).toEqual({
      type: "warning",
      text: "Session ended due to inactivity.",
    });
    expect(global.localStorage.has("token")).toBe(false);
    expect(global.localStorage.has("userData")).toBe(false);
    expect(global.localStorage.has("lastActivity")).toBe(false);
    expect(replacedTo).toEqual(["/"]);
  });

  test("a plain sign-out keeps no message", () => {
    endSession();
    expect(takeSignInNotice()).toBeNull();
    expect(replacedTo).toEqual(["/"]);
  });

  test("blocked storage still ends the session", () => {
    global.sessionStorage = blockedStorage;
    expect(() => endSession("inactive")).not.toThrow();
    expect(replacedTo).toEqual(["/"]);
  });

  // Last on purpose: a forced sign-out sets a once-per-page-load flag in session.js,
  // so later forced sign-outs in this file would do nothing
  test("account no longer active keeps its message once, even when several requests fail", () => {
    endSession("accountInactive");
    endSession("roleChanged");

    expect(takeSignInNotice()).toEqual({
      type: "warning",
      text: "Your account is no longer active.",
    });
    expect(replacedTo).toEqual(["/"]);
  });
});
