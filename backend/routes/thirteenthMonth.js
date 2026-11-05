const express = require("express");
const mongoose = require("mongoose");

const { requireAdmin } = require("../middleware/accessMiddleware");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const BasicPayChange = require("../models/basicPayChange");
const { PAY_HISTORY_START } = require("../config/payroll");
const { manilaToday, toDateKey } = require("../utils/leaveCredits");
const {
  yearColumns,
  isListed,
  thirteenthMonth,
  reportTotals,
  checkYear,
} = require("../utils/thirteenthMonth");

// 13th month pay report, worked out for the whole calendar year. Admins only: it shows
// basic pay.
const router = express.Router();

const LISTED_STATUSES = ["Active", "Resigned"];
const NOT_FOUND = "Employee not found.";

const HISTORY_FIELDS = "userId amount effectiveFrom changedAt";

// What every response starts with: the year, today, the day pay history began and the
// 25 column headers
const reportHeader = (year, todayKey) => ({
  year,
  asOf: todayKey,
  payHistoryStart: PAY_HISTORY_START,
  cutoffs: yearColumns(year),
});

// One report row from the account, its Employee record, its job description and its
// basic pay history
const buildRow = (account, employee, job, history, year, todayKey) => {
  const { status } = account;
  const name =
    [employee?.firstName, employee?.lastName].filter(Boolean).join(" ") ||
    account.username ||
    "";

  return {
    userId: account._id,
    employeeId: employee?.employeeId || "",
    name,
    employmentType: job.employmentType || "",
    status,
    startDate: toDateKey(job.startDate) || null,
    lastWorkingDay:
      status === "Resigned" ? toDateKey(job.resignationDate) || null : null,
    monthlyBasic: job.basicPay ?? null,
    ...thirteenthMonth(job, { year, todayKey, status, history }),
  };
};

// Loads one Employee account's row with its job and pay history, or null when it isn't
// in the report for `year` (no account, an admin, Pending or Inactive, or not listed)
const loadRow = async (userId, year, todayKey) => {
  const account = await User.findById(userId)
    .select("username role status")
    .lean();
  if (
    !account ||
    account.role !== "Employee" ||
    !LISTED_STATUSES.includes(account.status)
  ) {
    return null;
  }

  const [employee, settings, history] = await Promise.all([
    Employee.findOne({ userId }).select("firstName lastName employeeId").lean(),
    Settings.findOne({ userId }).select("general.jobDescription").lean(),
    BasicPayChange.find({ userId }).select(HISTORY_FIELDS).lean(),
  ]);
  const job = settings?.general?.jobDescription || {};
  if (!isListed(account, job, year)) return null;

  return buildRow(account, employee, job, history, year, todayKey);
};

// By Employee ID, numbers compared as numbers (AC-2 before AC-10), Active and Resigned
// mixed; rows with no Employee ID last, by name
const byEmployeeId = (a, b) => {
  const options = { numeric: true, sensitivity: "base" };
  if (a.employeeId && b.employeeId) {
    return a.employeeId.localeCompare(b.employeeId, "en", options);
  }
  if (a.employeeId) return -1;
  if (b.employeeId) return 1;
  return a.name.localeCompare(b.name, "en", options);
};

// GET /api/thirteenth-month?year=2026: every listed employee's 13th month for the year
router.get("/", requireAdmin, async (req, res) => {
  try {
    const todayKey = manilaToday();
    const checked = checkYear(req.query.year, Number(todayKey.slice(0, 4)));
    if (checked.error) {
      return res.status(400).json({ message: checked.error });
    }
    const { year } = checked;

    const accounts = await User.find({
      role: "Employee",
      status: { $in: LISTED_STATUSES },
    })
      .select("username role status")
      .lean();
    const ids = accounts.map((account) => account._id);

    const [employees, settings, changes] = await Promise.all([
      Employee.find({ userId: { $in: ids } })
        .select("userId firstName lastName employeeId")
        .lean(),
      Settings.find({ userId: { $in: ids } })
        .select("userId general.jobDescription")
        .lean(),
      BasicPayChange.find({ userId: { $in: ids } })
        .select(HISTORY_FIELDS)
        .lean(),
    ]);
    const byUser = (docs) =>
      new Map(docs.map((doc) => [String(doc.userId), doc]));
    const employeeOf = byUser(employees);
    const settingsOf = byUser(settings);
    const historyOf = new Map();
    for (const change of changes) {
      const id = String(change.userId);
      historyOf.set(id, [...(historyOf.get(id) || []), change]);
    }

    const rows = accounts
      .map((account) => {
        const id = String(account._id);
        const job = settingsOf.get(id)?.general?.jobDescription || {};
        if (!isListed(account, job, year)) return null;
        return buildRow(
          account,
          employeeOf.get(id),
          job,
          historyOf.get(id) || [],
          year,
          todayKey,
        );
      })
      .filter(Boolean)
      .sort(byEmployeeId);

    const header = reportHeader(year, todayKey);
    res.status(200).json({
      ...header,
      rows,
      totals: reportTotals(rows, header.cutoffs.length),
      incomplete: rows.filter((row) => row.total === null).length,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching 13th month pay", error: err.message });
  }
});

// GET /api/thirteenth-month/:userId?year=2026: one employee's row
router.get("/:userId", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }

    const todayKey = manilaToday();
    const checked = checkYear(req.query.year, Number(todayKey.slice(0, 4)));
    if (checked.error) {
      return res.status(400).json({ message: checked.error });
    }
    const { year } = checked;

    const row = await loadRow(userId, year, todayKey);
    if (!row) {
      return res.status(404).json({ message: NOT_FOUND });
    }

    res.status(200).json({ ...reportHeader(year, todayKey), row });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching 13th month pay", error: err.message });
  }
});

module.exports = router;
