// Password-reset codes, kept in memory. A code lasts 5 minutes and allows 5 wrong
// tries; a new one can be requested once a minute per email.
const crypto = require("crypto");

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_WAIT_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

const codes = new Map(); // email -> { otp, expiresAt, sentAt, attempts, locked }

const removeExpired = (now) => {
  for (const [email, entry] of codes) {
    if (now > entry.expiresAt) codes.delete(email);
  }
};

// A new code { otp, expiresAt }, or { retryAfterMs } while the last one is under a minute old
const issueCode = (email, now = Date.now()) => {
  removeExpired(now);

  const current = codes.get(email);
  if (current && now - current.sentAt < RESEND_WAIT_MS) {
    return { retryAfterMs: RESEND_WAIT_MS - (now - current.sentAt) };
  }

  const entry = {
    otp: String(crypto.randomInt(100000, 1000000)),
    expiresAt: now + OTP_TTL_MS,
    sentAt: now,
    attempts: 0,
    locked: false,
  };
  codes.set(email, entry);
  return { otp: entry.otp, expiresAt: entry.expiresAt };
};

// { result: "ok" }, { result: "wrong", triesLeft }, { result: "expired" } (none
// requested, or older than 5 minutes) or { result: "locked" } (too many wrong tries)
const checkCode = (email, otp, now = Date.now()) => {
  const entry = codes.get(email);
  if (!entry || now > entry.expiresAt) return { result: "expired" };
  if (entry.locked) return { result: "locked" };

  if (entry.otp !== otp) {
    entry.attempts += 1;
    const triesLeft = MAX_ATTEMPTS - entry.attempts;
    if (triesLeft > 0) return { result: "wrong", triesLeft };
    // Kept until it expires, so the one-minute wait still applies to a new code
    entry.locked = true;
    return { result: "locked" };
  }

  codes.delete(email);
  return { result: "ok" };
};

// For tests
const clearCodes = () => codes.clear();

module.exports = { issueCode, checkCode, clearCodes, MAX_ATTEMPTS };
