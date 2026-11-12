const express = require("express");
const mongoose = require("mongoose");

const {
  requireAuthenticated,
  requireAdminPage,
} = require("../middleware/accessMiddleware");
const Holiday = require("../models/holiday");
const { isHolidayType } = require("../config/holidays");
const { toDateKey } = require("../utils/leaveCredits");

// The company holiday list. Everyone signed in reads it (the Calendar screens, the
// attendance sheet, and later the pay computation); only an admin with the Calendar tick
// ("admin-calendar"; the highest admin role always) adds or removes a holiday. One
// holiday per date. A non-working holiday on a Monday-to-Friday day is a paid day and
// never LWOP (utils/payDays.js); nothing here changes attendance rows.
const router = express.Router();

const requireCalendar = requireAdminPage("admin-calendar");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_PATTERN = /^\d{4}$/;

const ALREADY_A_HOLIDAY = "That date already has a holiday.";
const NOT_FOUND = "Holiday not found.";

// The unique index on `date` refused the save: two requests for the same date at once
const isDuplicateKey = (err) => err?.code === 11000;

// A "YYYY-MM-DD" string that is a real calendar day ("2026-02-30" is not: read as a date
// it rolls over to March 2, so the key has to come back unchanged)
const isCalendarDay = (value) =>
  typeof value === "string" &&
  DATE_PATTERN.test(value) &&
  toDateKey(`${value}T00:00:00Z`) === value;

// Checks a new holiday, in the order the form lists its fields. Returns { error } or
// { fields } ready to save, the date as the Manila day at 00:00 UTC.
const checkHoliday = ({ date, name, type } = {}) => {
  if (!isCalendarDay(date)) {
    return { error: "Enter the date as a valid date." };
  }
  if (typeof name !== "string" || !name.trim()) {
    return { error: "Name the holiday." };
  }
  if (!isHolidayType(type)) {
    return { error: "Choose a holiday type." };
  }
  return {
    fields: { date: new Date(`${date}T00:00:00Z`), name: name.trim(), type },
  };
};

// A holiday as the screens get it: the date as its "YYYY-MM-DD" key
const toReply = (holiday) => ({
  id: String(holiday._id),
  date: toDateKey(holiday.date),
  name: holiday.name,
  type: holiday.type,
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
      filter.date = {
        $gte: new Date(`${year}-01-01T00:00:00Z`),
        $lte: new Date(`${year}-12-31T00:00:00Z`),
      };
    }

    const holidays = await Holiday.find(filter)
      .select("date name type")
      .sort({ date: 1 })
      .lean();
    res.status(200).json(holidays.map(toReply));
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching holidays", error: err.message });
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

// DELETE /api/holidays/:id: removes a holiday
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
