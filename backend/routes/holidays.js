const express = require("express");
const mongoose = require("mongoose");

const {
  requireAuthenticated,
  requireAdminPage,
} = require("../middleware/accessMiddleware");
const Holiday = require("../models/holiday");
const { HOLIDAY_SOURCES } = require("../config/regularHolidays");
const { toDateKey } = require("../utils/leaveCredits");
const {
  checkHoliday,
  checkImportYear,
  fetchSourceHolidays,
  buildPreview,
  checkImport,
  importMessage,
} = require("../utils/holidayImport");

// The company holiday list. Everyone signed in reads it (the Calendar screens, the
// attendance sheet, and later the pay computation); only an admin with the Calendar tick
// ("admin-calendar"; the highest admin role always) adds or removes a holiday, or imports
// a year's holidays from Nager.Date (a preview first; nothing is saved until Save). One
// holiday per date. A non-working holiday on a Monday-to-Friday day is a paid day and
// never LWOP (utils/payDays.js); nothing here changes attendance rows.
const router = express.Router();

const requireCalendar = requireAdminPage("admin-calendar");

const YEAR_PATTERN = /^\d{4}$/;

const ALREADY_A_HOLIDAY = "That date already has a holiday.";
const NOT_FOUND = "Holiday not found.";
const SOURCE_DOWN =
  "Could not get the holidays from Nager.Date. Try again later, or add them by hand.";
const ALL_TAKEN = "Every ticked date already has a holiday. Nothing was saved.";

// The unique index on `date` refused the save: two requests for the same date at once
const isDuplicateKey = (err) => err?.code === 11000;

// The dates of one calendar year, January 1 and December 31 included
const inYear = (year) => ({
  $gte: new Date(`${year}-01-01T00:00:00Z`),
  $lte: new Date(`${year}-12-31T00:00:00Z`),
});

// A holiday as the screens get it: the date as its "YYYY-MM-DD" key. A holiday saved
// before the import existed has no `source` and reads as "Manual".
const toReply = (holiday) => ({
  id: String(holiday._id),
  date: toDateKey(holiday.date),
  name: holiday.name,
  type: holiday.type,
  source:
    holiday.source === HOLIDAY_SOURCES.IMPORTED
      ? HOLIDAY_SOURCES.IMPORTED
      : HOLIDAY_SOURCES.MANUAL,
});

// GET /api/holidays?year=2026: the holidays of one calendar year, oldest first; with no
// `year`, every holiday (a cut-off that crosses New Year needs both years)
router.get("/", requireAuthenticated, async (req, res) => {
  try {
    const { year } = req.query;
    const filter = {};
    if (year !== undefined) {
      if (typeof year !== "string" || !YEAR_PATTERN.test(year)) {
        return res
          .status(400)
          .json({ message: "Enter the year as four digits." });
      }
      filter.date = inYear(year);
    }

    const holidays = await Holiday.find(filter)
      .select("date name type source")
      .sort({ date: 1 })
      .lean();
    res.status(200).json(holidays.map(toReply));
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching holidays", error: err.message });
  }
});

// GET /api/holidays/import-preview?year=2027: the year's Philippine holidays as Nager.Date
// lists them, each with a preset name and type and whether its date already has a
// holiday. Only this Manila year and the next. Asks the source once and saves nothing.
// Who is asking and the year are checked before anything goes out.
router.get("/import-preview", requireCalendar, async (req, res) => {
  try {
    const checked = checkImportYear(req.query.year);
    if (checked.error) {
      return res.status(400).json({ message: checked.error });
    }
    const { year } = checked;

    let reply;
    try {
      reply = await fetchSourceHolidays(year);
    } catch (err) {
      console.error("Holiday import, source down:", err);
      return res.status(502).json({ message: SOURCE_DOWN });
    }

    const listed = await Holiday.find({ date: inYear(year) })
      .select("date name type")
      .lean();
    res.status(200).json(buildPreview({ year, reply, listed }));
  } catch (err) {
    console.error("Error reading the holidays:", err);
    res.status(500).json({ message: "Error reading the holidays" });
  }
});

// POST /api/holidays/import { year, holidays: [{ date: "YYYY-MM-DD", name, type }] }:
// saves the rows the Admin ticked in the preview, each marked "Imported". Any bad row
// refuses the whole request (utils/holidayImport.js: checkImport). A date that already
// has a holiday is skipped and named in the message, also one taken at the same moment
// by another request (the unique index on the date); when every date is taken nothing is
// saved. Does not ask Nager.Date again: the Admin's rows are trusted as the Add form's.
router.post("/import", requireCalendar, async (req, res) => {
  try {
    const checked = checkImport(req.body);
    if (checked.error) {
      return res.status(400).json({ message: checked.error });
    }
    const { year, rows } = checked;

    const taken = await Holiday.find({
      date: { $in: rows.map(({ date }) => date) },
    })
      .select("date")
      .lean();
    const takenKeys = new Set(taken.map(({ date }) => toDateKey(date)));

    // One at a time, oldest first, so a date the index refuses is skipped on its own
    const saved = [];
    const skipped = [];
    for (const { key, ...fields } of rows) {
      if (takenKeys.has(key)) {
        skipped.push(key);
        continue;
      }
      try {
        saved.push(
          await Holiday.create({
            ...fields,
            source: HOLIDAY_SOURCES.IMPORTED,
            createdBy: req.user.userId,
          }),
        );
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
        skipped.push(key);
      }
    }

    if (saved.length === 0) {
      return res.status(409).json({ message: ALL_TAKEN });
    }
    res.status(201).json({
      message: importMessage(year, saved.length, skipped),
      saved: saved.map(toReply),
      skipped,
    });
  } catch (err) {
    console.error("Error saving the holidays:", err);
    res.status(500).json({ message: "Error saving the holidays" });
  }
});

// POST /api/holidays { date: "YYYY-MM-DD", name, type }: adds a holiday
router.post("/", requireCalendar, async (req, res) => {
  try {
    const checked = checkHoliday(req.body);
    if (checked.error) {
      return res.status(400).json({ message: checked.error });
    }

    if (await Holiday.exists({ date: checked.fields.date })) {
      return res.status(409).json({ message: ALREADY_A_HOLIDAY });
    }

    const holiday = await Holiday.create({
      ...checked.fields,
      source: HOLIDAY_SOURCES.MANUAL,
      createdBy: req.user.userId,
    });
    res
      .status(201)
      .json({ message: "Holiday saved.", holiday: toReply(holiday) });
  } catch (err) {
    if (isDuplicateKey(err)) {
      return res.status(409).json({ message: ALREADY_A_HOLIDAY });
    }
    res
      .status(500)
      .json({ message: "Error saving the holiday", error: err.message });
  }
});

// DELETE /api/holidays/:id: removes a holiday. Keep the "/import..." routes above any
// "/:id" route, so their names are never read as an id.
router.delete("/:id", requireCalendar, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: NOT_FOUND });
    }

    const removed = await Holiday.findByIdAndDelete(id);
    if (!removed) {
      return res.status(404).json({ message: NOT_FOUND });
    }

    res.status(200).json({ message: "Holiday removed." });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error removing the holiday", error: err.message });
  }
});

module.exports = router;
