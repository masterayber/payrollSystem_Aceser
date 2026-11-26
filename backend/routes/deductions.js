const express = require("express");
const mongoose = require("mongoose");

const {
  requireAdminPage,
  requireSuperAdmin,
} = require("../middleware/accessMiddleware");
const { logActivity } = require("../middleware/activityLog");
const DeductionTable = require("../models/deductionTable");
const CompanySettings = require("../models/companySettings");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const { manilaToday, toDateKey } = require("../utils/leaveCredits");
const {
  STATUS,
  MESSAGES,
  checkTable,
  checkKinds,
  checkCheckedWith,
  kindsIn,
  tableReply,
  kindSummaries,
} = require("../utils/deductionTables");
const {
  CHANGE_LABELS,
  changedFields,
  personName,
  tableName,
  statutoryOffNote,
} = require("../utils/activityLog");

// The statutory deduction tables: SSS, PhilHealth, Pag-IBIG and withholding tax (DED-3;
// the rules are in utils/deductionTables.js). An admin with the Deductions tick
// ("deductions"; the Super Admin always) reads them. Only the Super Admin writes: a new
// version is saved as a Draft, a Draft can be edited or deleted, and confirming it (with
// the name of who checked it against the official table) makes it usable for pay and
// locks it. The Super Admin can also switch a kind off for the company. Every write is
// recorded in the activity log, by the table's kind and date, never by a figure in it.
// Nothing here computes pay, and the code holds no rate.
const router = express.Router();

const requireDeductions = requireAdminPage("deductions");

// A change to the tables: the Super Admin only, then an entry in the activity log
const changesTables = (action) => [requireSuperAdmin, logActivity(action)];

// The unique index on kind + effectiveFrom refused the save: two requests at once
const isDuplicateKey = (err) => err?.code === 11000;

const refuse = (res, status, message) => res.status(status).json({ message });

const serverError = (res, err, message) => {
  console.error(`${message}:`, err);
  res.status(500).json({ message });
};

// Today in Manila as the Date a day is stored as (00:00 UTC of that day)
const todayAsDate = () => new Date(`${manilaToday()}T00:00:00Z`);

// The table with this id as a plain record, or null (also for an id that is not one)
const findTable = (id) =>
  mongoose.isValidObjectId(id) ? DeductionTable.findById(id).lean() : null;

// Who typed in, confirmed or checked these tables, by name: a function from an account
// id to "First Last" (the username for an account with no name), "" for no id
const namesFor = async (tables) => {
  const ids = [
    ...new Set(
      tables
        .flatMap((table) => [
          table.confirmedBy,
          table.lastCheckedBy,
          table.createdBy,
        ])
        .filter(Boolean)
        .map(String),
    ),
  ];
  if (ids.length === 0) return () => "";

  const [accounts, employees] = await Promise.all([
    User.find({ _id: { $in: ids } })
      .select("username firstName lastName")
      .lean(),
    Employee.find({ userId: { $in: ids } })
      .select("userId firstName lastName")
      .lean(),
  ]);
  const accountOf = new Map(accounts.map((one) => [String(one._id), one]));
  const employeeOf = new Map(employees.map((one) => [String(one.userId), one]));

  return (id) =>
    id
      ? personName(employeeOf.get(String(id)), accountOf.get(String(id)), {
          withId: false,
        })
      : "";
};

// One table as the screen gets it
const replyFor = async (table) => tableReply(table, await namesFor([table]));

// The kinds switched off for the company. The field is left out of every other read of
// the company record (models/companySettings.js), so it is asked for by name.
const readStatutoryOff = async () => {
  const company = await CompanySettings.findOne({ key: "company" })
    .select("+statutoryOff")
    .lean();
  return kindsIn(company?.statutoryOff);
};

// GET /api/deductions/tables: the Government-Mandated card. One entry per kind, in the
// order SSS, PhilHealth, Pag-IBIG, Withholding tax: { kind, label, off, current, drafts,
// upcoming, history, lastCheckedOn, checkOverdue, blocksPayslips } (utils/deductionTables.js:
// kindSummaries). "Today" is today in Manila.
router.get("/tables", requireDeductions, async (req, res) => {
  try {
    const [tables, off] = await Promise.all([
      DeductionTable.find().lean(),
      readStatutoryOff(),
    ]);
    res.status(200).json(
      kindSummaries(tables, {
        todayKey: manilaToday(),
        off,
        nameOf: await namesFor(tables),
      }),
    );
  } catch (err) {
    serverError(res, err, "Error reading the deduction tables");
  }
});

// POST /api/deductions/tables { kind, effectiveFrom: "YYYY-MM-DD", source, base?,
// deductOn?, rows: [{ over, upTo?, employeeFixed?, employeeRate?, employerFixed?,
// employerRate?, excessOver? }] }: saves a new version as a Draft. One version per kind
// per day.
router.post("/tables", changesTables("table.add"), async (req, res) => {
  let fields;
  try {
    const checked = checkTable(req.body);
    if (checked.error) return refuse(res, 400, checked.error);
    ({ fields } = checked);

    const { kind, effectiveFrom } = fields;
    if (await DeductionTable.exists({ kind, effectiveFrom })) {
      return refuse(res, 409, MESSAGES.taken(kind, toDateKey(effectiveFrom)));
    }

    const table = (
      await DeductionTable.create({
        ...fields,
        status: STATUS.DRAFT,
        createdBy: req.user.userId,
      })
    ).toObject();
    res.locals.activity = {
      targetId: table._id,
      targetName: tableName(table),
    };
    res
      .status(201)
      .json({ message: MESSAGES.saved, table: await replyFor(table) });
  } catch (err) {
    if (isDuplicateKey(err) && fields) {
      return refuse(
        res,
        409,
        MESSAGES.taken(fields.kind, toDateKey(fields.effectiveFrom)),
      );
    }
    serverError(res, err, "Error saving the table");
  }
});

// PUT /api/deductions/tables/:id, the same body as POST: replaces a Draft. A Confirmed
// version is refused before the body is looked at. Keep "/tables/:id/confirm" and
// "/tables/:id/checked" as POST routes, so their names are never read as an id here.
router.put("/tables/:id", changesTables("table.edit"), async (req, res) => {
  let fields;
  try {
    const before = await findTable(req.params.id);
    if (!before) return refuse(res, 404, MESSAGES.notFound);
    if (before.status !== STATUS.DRAFT) {
      return refuse(res, 409, MESSAGES.confirmedLocked);
    }

    const checked = checkTable(req.body);
    if (checked.error) return refuse(res, 400, checked.error);
    ({ fields } = checked);

    const { kind, effectiveFrom } = fields;
    const taken = await DeductionTable.exists({
      kind,
      effectiveFrom,
      _id: { $ne: before._id },
    });
    if (taken) {
      return refuse(res, 409, MESSAGES.taken(kind, toDateKey(effectiveFrom)));
    }

    // Only while it is still a Draft: confirmed at the same moment, it is not changed
    const table = await DeductionTable.findOneAndUpdate(
      { _id: before._id, status: STATUS.DRAFT },
      { $set: fields },
      { new: true, runValidators: true },
    ).lean();
    if (!table) {
      return (await findTable(req.params.id))
        ? refuse(res, 409, MESSAGES.confirmedLocked)
        : refuse(res, 404, MESSAGES.notFound);
    }

    res.locals.activity = {
      targetId: table._id,
      targetName: tableName(table),
      changed: changedFields(before, table, CHANGE_LABELS.table),
    };
    res
      .status(200)
      .json({ message: MESSAGES.updated, table: await replyFor(table) });
  } catch (err) {
    if (isDuplicateKey(err) && fields) {
      return refuse(
        res,
        409,
        MESSAGES.taken(fields.kind, toDateKey(fields.effectiveFrom)),
      );
    }
    serverError(res, err, "Error saving the table");
  }
});

// DELETE /api/deductions/tables/:id: deletes a Draft. A Confirmed version stays forever.
router.delete(
  "/tables/:id",
  changesTables("table.delete"),
  async (req, res) => {
    try {
      const before = await findTable(req.params.id);
      if (!before) return refuse(res, 404, MESSAGES.notFound);
      if (before.status !== STATUS.DRAFT) {
        return refuse(res, 409, MESSAGES.confirmedLocked);
      }

      const removed = await DeductionTable.findOneAndDelete({
        _id: before._id,
        status: STATUS.DRAFT,
      }).lean();
      if (!removed) {
        return (await findTable(req.params.id))
          ? refuse(res, 409, MESSAGES.confirmedLocked)
          : refuse(res, 404, MESSAGES.notFound);
      }

      res.locals.activity = {
        targetId: removed._id,
        targetName: tableName(removed),
      };
      res.status(200).json({ message: MESSAGES.deleted });
    } catch (err) {
      serverError(res, err, "Error deleting the table");
    }
  },
);

// POST /api/deductions/tables/:id/confirm { checkedWith }: confirms a Draft, with the
// name of the HR or Accounting person who checked it against the official table. From
// then on it is used for pay and can't be changed. Confirming counts as its first check.
router.post(
  "/tables/:id/confirm",
  changesTables("table.confirm"),
  async (req, res) => {
    try {
      const before = await findTable(req.params.id);
      if (!before) return refuse(res, 404, MESSAGES.notFound);
      if (before.status !== STATUS.DRAFT) {
        return refuse(res, 409, MESSAGES.alreadyConfirmed);
      }

      const checked = checkCheckedWith(req.body?.checkedWith);
      if (checked.error) return refuse(res, 400, checked.error);

      const table = await DeductionTable.findOneAndUpdate(
        { _id: before._id, status: STATUS.DRAFT },
        {
          $set: {
            status: STATUS.CONFIRMED,
            confirmedBy: req.user.userId,
            confirmedAt: new Date(),
            checkedWith: checked.checkedWith,
            lastCheckedOn: todayAsDate(),
            lastCheckedBy: req.user.userId,
          },
        },
        { new: true, runValidators: true },
      ).lean();
      if (!table) {
        return (await findTable(req.params.id))
          ? refuse(res, 409, MESSAGES.alreadyConfirmed)
          : refuse(res, 404, MESSAGES.notFound);
      }

      res.locals.activity = {
        targetId: table._id,
        targetName: tableName(table),
        note: `Checked with ${table.checkedWith}`,
      };
      res
        .status(200)
        .json({ message: MESSAGES.confirmed, table: await replyFor(table) });
    } catch (err) {
      serverError(res, err, "Error confirming the table");
    }
  },
);

// POST /api/deductions/tables/:id/checked: stamps today (Manila) as the last time a
// Confirmed version was checked against the official table. Nothing else on it changes.
router.post(
  "/tables/:id/checked",
  changesTables("table.checked"),
  async (req, res) => {
    try {
      const before = await findTable(req.params.id);
      if (!before) return refuse(res, 404, MESSAGES.notFound);
      if (before.status !== STATUS.CONFIRMED) {
        return refuse(res, 409, MESSAGES.draftNotChecked);
      }

      const table = await DeductionTable.findOneAndUpdate(
        { _id: before._id, status: STATUS.CONFIRMED },
        {
          $set: {
            lastCheckedOn: todayAsDate(),
            lastCheckedBy: req.user.userId,
          },
        },
        { new: true },
      ).lean();
      if (!table) return refuse(res, 404, MESSAGES.notFound);

      res.locals.activity = {
        targetId: table._id,
        targetName: tableName(table),
      };
      res
        .status(200)
        .json({ message: MESSAGES.checked, table: await replyFor(table) });
    } catch (err) {
      serverError(res, err, "Error marking the table as checked");
    }
  },
);

// PUT /api/deductions/statutory-off { kinds: ["tax"] }: the kinds switched off for the
// company, replacing the list (an empty list switches every kind back on). A kind that
// is off needs no table and never blocks payslips. Answers the saved list.
router.put(
  "/statutory-off",
  changesTables("statutory.off"),
  async (req, res) => {
    try {
      const checked = checkKinds(req.body?.kinds);
      if (checked.error) return refuse(res, 400, checked.error);

      const company = await CompanySettings.findOneAndUpdate(
        { key: "company" },
        { $set: { statutoryOff: checked.kinds, updatedBy: req.user.userId } },
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      )
        .select("+statutoryOff")
        .lean();
      const kinds = kindsIn(company?.statutoryOff);

      res.locals.activity = { note: statutoryOffNote(kinds) };
      res.status(200).json({ message: MESSAGES.offSaved, kinds });
    } catch (err) {
      serverError(res, err, "Error saving the switched-off deductions");
    }
  },
);

module.exports = router;
