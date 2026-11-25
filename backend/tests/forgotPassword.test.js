// Forgot password (routes/auth.js): POST /api/auth/forgot-password, /otp and
// /reset-password.
// - forgot-password answers the same for a registered and an unknown email: status,
//   message, keys and the one-minute wait. Only the email itself differs: it is sent
//   when an account has the address, and the reply does not wait for it.
// - otp only reads the code store, so it answers the same for both as well.
// - reset-password refuses an account that may not sign in (Inactive, Resigned,
//   Pending) with sign-in's own words, answers a token for an email without an account
//   as a bad token, and answers a database fault as a server error, not as a bad token.
jest.mock("../utils/nodemailer", () => jest.fn().mockResolvedValue());

const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const sendEmail = require("../utils/nodemailer");
const { clearCodes, MAX_ATTEMPTS } = require("../utils/otpStore");

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  jest.restoreAllMocks();
  await User.deleteMany({});
  clearCodes();
  sendEmail.mockClear();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const PASSWORD = "Password123!";
const NEW_PASSWORD = "NewPass123!";
const EMAIL = "ana@example.com";
const UNKNOWN_EMAIL = "nobody@example.com";
const RAW_DETAIL = "raw-database-detail-xyz";
const FIVE_MINUTES = 5 * 60 * 1000;
// Codes run from 100000 to 999999, so this one is never the right code
const WRONG_CODE = "000000";

const SENT = "If that email is registered, a 6-digit code has been sent to it.";
const WAIT = "Please wait a minute before requesting another code.";
const BAD_TOKEN = "Invalid or expired token";
const SERVER_ERROR = "Server error. Please try again later";
const RESET_DONE =
  "Password has been reset successfully. Please log in with your new password.";

// The pre-save hook hashes the password, so tests pass it in plain text
const createUser = (overrides = {}) =>
  User.create({
    username: "ana",
    password: PASSWORD,
    email: EMAIL,
    role: "Employee",
    status: "Active",
    ...overrides,
  });

const forgot = (email) =>
  request(app).post("/api/auth/forgot-password").send({ email });

const sendOtp = (email, otp) =>
  request(app).post("/api/auth/otp").send({ email, otp });

const resetWith = (resetToken, password = NEW_PASSWORD) =>
  request(app).post("/api/auth/reset-password").send({ resetToken, password });

// The same token POST /api/auth/otp signs after a correct code
const resetTokenFor = (email, options = { expiresIn: "5m" }) =>
  jwt.sign({ email, purpose: "reset" }, process.env.JWT_SECRET, options);

const login = (password) =>
  request(app).post("/api/auth/login").send({ username: "ana", password });

const stored = (user) => User.collection.findOne({ _id: user._id });

const quietLog = () => jest.spyOn(console, "error").mockImplementation(() => {});

const loggedRawDetail = (logSpy) =>
  logSpy.mock.calls.some((args) =>
    args.some((arg) => String(arg?.message ?? arg).includes(RAW_DETAIL)),
  );

describe("POST /api/auth/forgot-password: one reply for every email", () => {
  it("answers a registered and an unknown email the same, and emails only the registered one", async () => {
    await createUser();

    const before = Date.now();
    const known = await forgot(EMAIL);
    const unknown = await forgot(UNKNOWN_EMAIL);
    const after = Date.now();

    for (const res of [known, unknown]) {
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: SENT, expiresAt: expect.any(Number) });
      // About 5 minutes ahead, from the code store in both cases
      expect(res.body.expiresAt).toBeGreaterThanOrEqual(before + FIVE_MINUTES);
      expect(res.body.expiresAt).toBeLessThanOrEqual(after + FIVE_MINUTES);
      expect(res.body).not.toHaveProperty("otp");
    }
    expect(unknown.status).toBe(known.status);
    expect(Object.keys(unknown.body).sort()).toEqual(
      Object.keys(known.body).sort(),
    );
    expect(unknown.body.message).toBe(known.body.message);
    expect(unknown.headers["content-type"]).toBe(known.headers["content-type"]);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(EMAIL, expect.stringMatching(/^\d{6}$/));
  });

  it("makes both wait a minute before another code, with the same 429", async () => {
    await createUser();
    expect((await forgot(EMAIL)).status).toBe(200);
    expect((await forgot(UNKNOWN_EMAIL)).status).toBe(200);

    const known = await forgot(EMAIL);
    const unknown = await forgot(UNKNOWN_EMAIL);

    for (const res of [known, unknown]) {
      expect(res.status).toBe(429);
      expect(res.body).toEqual({ message: WAIT });
    }
    expect(unknown.body).toEqual(known.body);
    // No second email for the registered one, none at all for the unknown one
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("still answers 200 when the email cannot be sent, and logs the fault", async () => {
    await createUser();
    const log = quietLog();
    sendEmail.mockRejectedValueOnce(new Error(RAW_DETAIL));

    const res = await forgot(EMAIL);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: SENT, expiresAt: expect.any(Number) });
    expect(JSON.stringify(res.body)).not.toContain(RAW_DETAIL);
    // The route's own catch ran, so the rejection was handled, not left hanging
    expect(log).toHaveBeenCalledWith(
      "Forgot password email error:",
      expect.objectContaining({ message: RAW_DETAIL }),
    );
  });

  it("still answers 200 when the mailer throws straight away", async () => {
    await createUser();
    const log = quietLog();
    sendEmail.mockImplementationOnce(() => {
      throw new Error(RAW_DETAIL);
    });

    const res = await forgot(EMAIL);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: SENT, expiresAt: expect.any(Number) });
    expect(loggedRawDetail(log)).toBe(true);
  });

  it("does not wait for the email before answering", async () => {
    await createUser();
    // A send that never finishes
    sendEmail.mockImplementationOnce(() => new Promise(() => {}));

    const res = await forgot(EMAIL);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(SENT);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it.each(["Inactive", "Resigned", "Pending"])(
    "still emails a code to a registered %s account, with the same reply",
    async (status) => {
      await createUser({ status });

      const res = await forgot(EMAIL);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: SENT, expiresAt: expect.any(Number) });
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendEmail).toHaveBeenCalledWith(
        EMAIL,
        expect.stringMatching(/^\d{6}$/),
      );
    },
  );
});

describe("POST /api/auth/forgot-password: refusals", () => {
  it("needs an email as filled text", async () => {
    await createUser();

    for (const email of [undefined, "", "   ", 12345, { $ne: null }, [EMAIL]]) {
      const res = await forgot(email);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: "Email is required" });
    }
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refuses an email over 254 characters and keeps no code for it", async () => {
    const longest = `${"a".repeat(242)}@example.com`;
    const tooLong = `a${longest}`;
    expect(longest).toHaveLength(254);

    const refused = await forgot(tooLong);
    expect(refused.status).toBe(400);
    expect(refused.body).toEqual({ message: "Enter a valid email address." });
    // No code was stored: the code check answers as it does when none was requested
    expect((await sendOtp(tooLong, WRONG_CODE)).body.message).toBe(
      "This code has expired. Please request a new one.",
    );

    // 254 characters is still answered like any other email
    const accepted = await forgot(longest);
    expect(accepted.status).toBe(200);
    expect(accepted.body).toEqual({ message: SENT, expiresAt: expect.any(Number) });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("answers a database fault 500 with the plain message, and issues no code", async () => {
    await createUser();
    const log = quietLog();
    jest.spyOn(User, "findOne").mockRejectedValueOnce(new Error(RAW_DETAIL));

    const res = await forgot(EMAIL);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: SERVER_ERROR });
    expect(res.body).not.toHaveProperty("error");
    expect(JSON.stringify(res.body)).not.toContain(RAW_DETAIL);
    expect(loggedRawDetail(log)).toBe(true);
    expect(sendEmail).not.toHaveBeenCalled();

    // The fault used up no code, so trying again at once is not told to wait
    const again = await forgot(EMAIL);
    expect(again.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/auth/otp: the same for a registered and an unknown email", () => {
  it("answers a wrong code the same for both, up to the lock", async () => {
    await createUser();
    expect((await forgot(EMAIL)).status).toBe(200);
    expect((await forgot(UNKNOWN_EMAIL)).status).toBe(200);

    for (let wrongTries = 1; wrongTries <= MAX_ATTEMPTS; wrongTries += 1) {
      const known = await sendOtp(EMAIL, WRONG_CODE);
      const unknown = await sendOtp(UNKNOWN_EMAIL, WRONG_CODE);

      const locked = wrongTries === MAX_ATTEMPTS;
      expect(known.status).toBe(locked ? 429 : 400);
      expect(unknown.status).toBe(known.status);
      expect(unknown.body).toEqual(known.body);
    }
    expect((await sendOtp(UNKNOWN_EMAIL, WRONG_CODE)).body).toEqual({
      message: "Too many incorrect codes. Please request a new one.",
    });
  });

  it("says how many tries are left to both", async () => {
    await createUser();
    await forgot(EMAIL);
    await forgot(UNKNOWN_EMAIL);

    for (const email of [EMAIL, UNKNOWN_EMAIL]) {
      const res = await sendOtp(email, WRONG_CODE);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: `Incorrect code. ${MAX_ATTEMPTS - 1} tries left.`,
      });
    }
  });

  it("answers the same for both when no code was requested, and for a badly formed code", async () => {
    await createUser();

    const noCode = await Promise.all([
      sendOtp(EMAIL, WRONG_CODE),
      sendOtp(UNKNOWN_EMAIL, WRONG_CODE),
    ]);
    for (const res of noCode) {
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: "This code has expired. Please request a new one.",
      });
    }

    for (const email of [EMAIL, UNKNOWN_EMAIL]) {
      const res = await sendOtp(email, "12ab");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: "Enter the 6-digit code from your email.",
      });
    }
  });
});

describe("POST /api/auth/reset-password: the account's status", () => {
  it.each([
    ["Inactive", "This account is disabled."],
    ["Resigned", "This account is no longer active."],
    ["Pending", "Account is pending approval."],
  ])(
    "refuses a %s account with sign-in's message and changes nothing",
    async (status, message) => {
      const user = await createUser({ status, mustChangePassword: true });
      const before = await stored(user);

      const res = await resetWith(resetTokenFor(EMAIL));

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message });
      // The same words sign-in uses for this account
      const signIn = await login(PASSWORD);
      expect(signIn.status).toBe(403);
      expect(signIn.body).toEqual({ message });

      const after = await stored(user);
      expect(after.password).toBe(before.password);
      expect(await bcrypt.compare(PASSWORD, after.password)).toBe(true);
      expect(after.mustChangePassword).toBe(true);
      expect(after.status).toBe(status);
    },
  );

  it("refuses an Inactive account at the last step of the whole flow (emailed code, then reset)", async () => {
    const user = await createUser({ status: "Inactive" });
    const before = await stored(user);

    expect((await forgot(EMAIL)).status).toBe(200);
    const otp = sendEmail.mock.calls.at(-1)[1];
    const verified = await sendOtp(EMAIL, otp);
    expect(verified.status).toBe(200);

    const res = await resetWith(verified.body.resetToken);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "This account is disabled." });
    expect((await stored(user)).password).toBe(before.password);
  });

  it("still resets an Active account through the whole flow and clears mustChangePassword", async () => {
    const user = await createUser({ mustChangePassword: true });

    expect((await forgot(EMAIL)).status).toBe(200);
    const otp = sendEmail.mock.calls.at(-1)[1];
    const verified = await sendOtp(EMAIL, otp);
    expect(verified.status).toBe(200);
    expect(verified.body).toEqual({
      message: "OTP verified.",
      resetToken: expect.any(String),
    });

    const res = await resetWith(verified.body.resetToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: RESET_DONE });
    const after = await stored(user);
    expect(await bcrypt.compare(NEW_PASSWORD, after.password)).toBe(true);
    expect(after.mustChangePassword).toBe(false);
    expect((await login(NEW_PASSWORD)).status).toBe(200);
    expect((await login(PASSWORD)).status).toBe(401);
  });

  it("changes only the token's own account", async () => {
    const ana = await createUser();
    const ben = await createUser({ username: "ben", email: "ben@example.com" });
    const benBefore = await stored(ben);

    expect((await resetWith(resetTokenFor(EMAIL))).status).toBe(200);

    expect(await bcrypt.compare(NEW_PASSWORD, (await stored(ana)).password)).toBe(
      true,
    );
    expect((await stored(ben)).password).toBe(benBefore.password);
  });
});

describe("POST /api/auth/reset-password: tokens", () => {
  it("answers a token for an email without an account as a bad token, not 404", async () => {
    await createUser();

    const res = await resetWith(resetTokenFor(UNKNOWN_EMAIL));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: BAD_TOKEN });
  });

  it("still refuses an expired, garbage, wrongly signed or wrong-purpose token and changes nothing", async () => {
    const user = await createUser();
    const before = await stored(user);
    quietLog();

    const tokens = {
      expired: resetTokenFor(EMAIL, { expiresIn: -10 }),
      garbage: "not-a-real-token",
      wronglySigned: jwt.sign(
        { email: EMAIL, purpose: "reset" },
        "another-secret-that-is-at-least-32-characters",
        { expiresIn: "5m" },
      ),
      signupPurpose: jwt.sign(
        { email: EMAIL, userId: user._id, purpose: "signup" },
        process.env.JWT_SECRET,
        { expiresIn: "5m" },
      ),
      signIn: jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "24h" },
      ),
      noEmail: jwt.sign({ purpose: "reset" }, process.env.JWT_SECRET, {
        expiresIn: "5m",
      }),
    };

    for (const [label, token] of Object.entries(tokens)) {
      const res = await resetWith(token);
      expect([label, res.status]).toEqual([label, 400]);
      expect(res.body).toEqual({ message: BAD_TOKEN });
    }
    expect((await stored(user)).password).toBe(before.password);
  });

  it("answers a bad token the same whatever the account's status (no status without a valid token)", async () => {
    await createUser({ status: "Inactive" });
    quietLog();

    const res = await resetWith("not-a-real-token");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: BAD_TOKEN });
  });

  it("keeps the order: missing token, then the password rule, then the token", async () => {
    await createUser();

    const noToken = await resetWith(undefined, "short");
    expect(noToken.status).toBe(400);
    expect(noToken.body).toEqual({ message: "Reset token is required" });

    const shortPassword = await resetWith("not-a-real-token", "abcdefg");
    expect(shortPassword.status).toBe(400);
    expect(shortPassword.body).toEqual({
      message: "New password must be at least 8 characters.",
    });
  });
});

describe("POST /api/auth/reset-password: a database fault is a server error", () => {
  it("answers 500, not 'Invalid or expired token', when the lookup fails", async () => {
    const user = await createUser();
    const before = await stored(user);
    const log = quietLog();
    jest.spyOn(User, "findOne").mockRejectedValueOnce(new Error(RAW_DETAIL));

    const res = await resetWith(resetTokenFor(EMAIL));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: SERVER_ERROR });
    expect(res.body).not.toHaveProperty("error");
    expect(JSON.stringify(res.body)).not.toContain(RAW_DETAIL);
    expect(loggedRawDetail(log)).toBe(true);
    expect((await stored(user)).password).toBe(before.password);
  });

  it("answers 500 when the save fails, and the old password still works", async () => {
    await createUser();
    const log = quietLog();
    jest.spyOn(User, "updateOne").mockRejectedValueOnce(new Error(RAW_DETAIL));

    const res = await resetWith(resetTokenFor(EMAIL));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: SERVER_ERROR });
    expect(JSON.stringify(res.body)).not.toContain(RAW_DETAIL);
    expect(loggedRawDetail(log)).toBe(true);
    expect((await login(PASSWORD)).status).toBe(200);
    expect((await login(NEW_PASSWORD)).status).toBe(401);
  });
});
