const DocumentCounter = require("../models/documentCounter");
const { manilaToday } = require("./leaveCredits");

const DOCUMENT_PREFIXES = ["MR", "DR", "WS", "TR"];

const counterKey = (prefix, projectCode, year) =>
  projectCode ? `${prefix}-${projectCode}-${year}` : `${prefix}-${year}`;

const bump = (key) =>
  DocumentCounter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );

// Next number in a series, e.g. "MR-ACE01-2026-0001" or "PO-2026-0001" (no
// project code). One atomic $inc per call, so two requests at the same time get
// different numbers. The only race is the first upsert on a new key, which can
// throw E11000; that is retried once. The year is the Manila year of creation.
const nextDocumentNumber = async (prefix, projectCode, year) => {
  const key = counterKey(prefix, projectCode, year ?? manilaToday().slice(0, 4));
  let counter;
  try {
    counter = await bump(key);
  } catch (err) {
    if (err?.code !== 11000) throw err;
    counter = await bump(key);
  }
  return `${key}-${String(counter.seq).padStart(4, "0")}`;
};

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Matches every counter key that belongs to a project code (MR, DR, WS, TR
// series). Used to check whether any document already uses the code before the
// code is changed.
const counterKeysForProject = (code) =>
  new RegExp(`^(${DOCUMENT_PREFIXES.join("|")})-${escapeRegExp(code)}-`);

module.exports = { nextDocumentNumber, counterKeysForProject };
