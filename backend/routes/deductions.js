const express = require("express");
const mongoose = require("mongoose");

const {
  requireAdminPage,
  requireSuperAdmin,
  requirePage,
} = require("../middleware/accessMiddleware");
const { logActivity } = require("../middleware/activityLog");
const DeductionTable = require("../models/deductionTable");
const PayItem = require("../models/payItem");
const CompanySettings = require("../models/companySettings");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const { manilaToday, toDateKey } = require("../utils/leaveCredits");
const { payScope, canSeePay } = require("../utils/payVisibility");
const {
  OWN_RECORD_MESSAGE,
  isOwnLinkedEmployee,
} = require("../utils/linkedEmployee");
const {
  STATUS: ITEM_STATUS,
  MESSAGES: ITEM_MESSAGES,
  isPayrollPerson,
  checkItem,
  checkChange,
  checkStatusFilter,
  statusOf,
  canDelete,
  loansOf,
  itemReply,
} = require("../utils/payItems");
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
  payItemName,
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

// ---- Pay items (DED-4) ----
// Earnings and deductions typed in for one employee: loans, cash advances, allowances
// (the rules are in utils/payItems.js). An admin with the Deductions tick reads and
// writes them, but only for the payroll employees on its pay list (the Super Admin: all
// of them): anyone else answers exactly as a missing employee or item. An Admin can't
// add, change, stop or delete an item of its own linked employee. Every write is logged
// by the item's type and employee, never by an amount. An employee reads its own items
// (the Payroll tick). Nothing here computes pay.

// Rule 1: the payroll people are Employee-role accounts that are Active, or Resigned
// with a last working day (isPayrollPerson); the query narrows to these two statuses
const PAYROLL_STATUSES = ["Active", "Resigned"];
const ACCOUNT_FIELDS = "username role status firstName lastName";
const EMPLOYEE_FIELDS = "userId firstName lastName employeeId";
const JOB_FIELDS = "userId general.jobDescription.resignationDate";

// What issued payslips paid on each item: a Map from the item id to the amount. There is
// no payslip until DED-6, so nothing is paid yet; DED-6 fills this in from the Issued
// payslips' lines (voided ones left out), and every balance, "Completed" status and the
// "on an issued payslip" refusal follow from it.
const paidByItem = async () => new Map();

const paidOf = (paid, item) => paid.get(String(item._id)) || 0;

// An account id as sent in a body or a query: text only
const isIdText = (value) =>
  typeof value === "string" && mongoose.isValidObjectId(value);

const refuseOwnRecord = (res) =>
  res
    .status(403)
    .json({ message: OWN_RECORD_MESSAGE, code: "OWN_EMPLOYEE_RECORD" });

// The payroll people the scope may see: [{ account, employee, job }]
const loadPeople = async (scope) => {
  const accounts = await User.find({
    role: "Employee",
    status: { $in: PAYROLL_STATUSES },
    ...(scope.all
      ? {}
      : { _id: { $in: [...scope.ids].filter(mongoose.isValidObjectId) } }),
  })
    .select(ACCOUNT_FIELDS)
    .lean();
  const ids = accounts.map((account) => account._id);

  const [employees, settings] = await Promise.all([
    Employee.find({ userId: { $in: ids } }).select(EMPLOYEE_FIELDS).lean(),
    Settings.find({ userId: { $in: ids } }).select(JOB_FIELDS).lean(),
  ]);
  const byUser = (docs) => new Map(docs.map((doc) => [String(doc.userId), doc]));
  const employeeOf = byUser(employees);
  const settingsOf = byUser(settings);

  return accounts
    .map((account) => {
      const id = String(account._id);
      return {
        account,
        employee: employeeOf.get(id) || null,
        job: settingsOf.get(id)?.general?.jobDescription || {},
      };
    })
    .filter(({ account, job }) => isPayrollPerson(account, job));
};

// One payroll person the scope may see, or null: for an id that is not one, a missing
// account, an admin account, someone not on payroll, or someone off the pay list. Each
// gives the same answer, so the reply never tells which.
const loadPerson = async (userId, scope) => {
  const id = String(userId ?? "");
  if (!mongoose.isValidObjectId(id) || !canSeePay(scope, id)) return null;

  const [account, employee, settings] = await Promise.all([
    User.findById(id).select(ACCOUNT_FIELDS).lean(),
    Employee.findOne({ userId: id }).select(EMPLOYEE_FIELDS).lean(),
    Settings.findOne({ userId: id }).select(JOB_FIELDS).lean(),
  ]);
  const job = settings?.general?.jobDescription || {};
  if (!isPayrollPerson(account, job)) return null;
  return { account, employee, job };
};

// The item with this id and its employee, or null: for an id that is not one, a missing
// item, or an item whose employee the caller may not see (loadPerson)
const findItemFor = async (req) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return null;
  const item = await PayItem.findById(id).lean();
  if (!item) return null;
  const person = await loadPerson(item.userId, payScope(req.currentUser));
  return person ? { item, person } : null;
};

// Items oldest first: the order they are taken on a payslip (1.2 item 8)
const OLDEST_FIRST = { createdAt: 1, _id: 1 };

// The replies for `items`, whose employees are `employeeOf` (a Map from the account id
// to the Employee record)
const itemReplies = async (items, employeeOf) => {
  const paid = await paidByItem(items.map((item) => item._id));
  return items.map((item) =>
    itemReply(item, {
      paid: paidOf(paid, item),
      employee: employeeOf.get(String(item.userId)),
    }),
  );
};

const personMap = (people) =>
  new Map(people.map(({ account, employee }) => [String(account._id), employee]));

// Active first, then by last name, first name and Employee ID (numbers as numbers)
const byLogOrder = (a, b) => {
  const options = { numeric: true, sensitivity: "base" };
  if (a.status !== b.status) return a.status === "Active" ? -1 : 1;
  return (
    a.lastName.localeCompare(b.lastName, "en", options) ||
    a.firstName.localeCompare(b.firstName, "en", options) ||
    a.employeeId.localeCompare(b.employeeId, "en", options)
  );
};

// GET /api/deductions/log: the Employee Deduction Log, one row per payroll employee on
// the caller's pay list: { userId, employeeId, firstName, lastName, status ("Active" or
// "Resigned"), resignationDate ("YYYY-MM-DD" or null), withholdingTax, deductions (both
// null until payslips exist, DED-6), loans (the open instalment balance), itemCount
// (every item, whatever its status), ownRecord (true on the calling Admin's own linked
// employee, so the screen hides its actions) }. Active first, then by last name.
router.get("/log", requireDeductions, async (req, res) => {
  try {
    const people = await loadPeople(payScope(req.currentUser));
    const items = await PayItem.find({
      userId: { $in: people.map(({ account }) => account._id) },
    }).lean();
    const paid = await paidByItem(items.map((item) => item._id));

    const itemsOf = new Map();
    for (const item of items) {
      const id = String(item.userId);
      itemsOf.set(id, [...(itemsOf.get(id) || []), item]);
    }

    const rows = people
      .map(({ account, employee, job }) => {
        const own = itemsOf.get(String(account._id)) || [];
        return {
          userId: String(account._id),
          employeeId: employee?.employeeId || "",
          firstName: employee?.firstName || account.firstName || account.username || "",
          lastName: employee?.lastName || account.lastName || "",
          status: account.status,
          resignationDate:
            account.status === "Resigned"
              ? toDateKey(job.resignationDate) || null
              : null,
          withholdingTax: null,
          deductions: null,
          loans: loansOf(own, (item) => paidOf(paid, item)),
          itemCount: own.length,
          ownRecord: isOwnLinkedEmployee(req.currentUser, account._id),
        };
      })
      .sort(byLogOrder);
    res.status(200).json(rows);
  } catch (err) {
    serverError(res, err, "Error reading the deduction log");
  }
});

// GET /api/deductions/items?status=&userId=: the pay items of the payroll employees on
// the caller's pay list, oldest first. `status` keeps the items with that worked-out
// status (Active, Paused, Stopped or Completed); `userId` keeps one employee's, and
// answers 404 "Employee not found." for anyone the caller may not see.
router.get("/items", requireDeductions, async (req, res) => {
  try {
    const filter = checkStatusFilter(req.query.status);
    if (filter.error) return refuse(res, 400, filter.error);

    const scope = payScope(req.currentUser);
    let people;
    if (req.query.userId !== undefined) {
      const person = isIdText(req.query.userId)
        ? await loadPerson(req.query.userId, scope)
        : null;
      if (!person) return refuse(res, 404, ITEM_MESSAGES.employeeNotFound);
      people = [person];
    } else {
      people = await loadPeople(scope);
    }

    const items = await PayItem.find({
      userId: { $in: people.map(({ account }) => account._id) },
    })
      .sort(OLDEST_FIRST)
      .lean();
    const replies = await itemReplies(items, personMap(people));
    res
      .status(200)
      .json(
        filter.status
          ? replies.filter((item) => item.status === filter.status)
          : replies,
      );
  } catch (err) {
    serverError(res, err, "Error reading the pay items");
  }
});

// GET /api/deductions/items/mine: the caller's own pay items, oldest first, in the same
// shape (the employee's Payroll page: the "payroll" tick). An admin account passes the
// page check but has no items of its own (items are for Employee-role accounts), so it
// gets an empty list.
router.get("/items/mine", requirePage("payroll"), async (req, res) => {
  try {
    const userId = req.currentUser._id;
    const [items, employee] = await Promise.all([
      PayItem.find({ userId }).sort(OLDEST_FIRST).lean(),
      Employee.findOne({ userId }).select(EMPLOYEE_FIELDS).lean(),
    ]);
    res
      .status(200)
      .json(await itemReplies(items, new Map([[String(userId), employee]])));
  } catch (err) {
    serverError(res, err, "Error reading your pay items");
  }
});

// POST /api/deductions/items { userId, kind, type, label?, note?, amountPerCutoff,
// total?, repeat, schedule, startCutoff, taxable? }: adds an item for a payroll employee
// on the caller's pay list (a Resigned one too: final pay takes what is left). 404 for
// anyone else, then 403 for the Admin's own linked employee, then the form's 400s.
router.post(
  "/items",
  requireDeductions,
  logActivity("payItem.add"),
  async (req, res) => {
    try {
      const userId = req.body?.userId;
      const person = isIdText(userId)
        ? await loadPerson(userId, payScope(req.currentUser))
        : null;
      if (!person) return refuse(res, 404, ITEM_MESSAGES.employeeNotFound);
      if (isOwnLinkedEmployee(req.currentUser, person.account._id)) {
        return refuseOwnRecord(res);
      }

      const checked = checkItem(req.body);
      if (checked.error) return refuse(res, 400, checked.error);

      const item = (
        await PayItem.create({
          ...checked.fields,
          userId: person.account._id,
          status: ITEM_STATUS.ACTIVE,
          createdBy: req.user.userId,
        })
      ).toObject();

      res.locals.activity = {
        targetId: item._id,
        targetName: payItemName(item, person.employee, person.account),
      };
      res.status(201).json({
        message:
          item.kind === "earning"
            ? ITEM_MESSAGES.savedEarning
            : ITEM_MESSAGES.savedDeduction,
        item: itemReply(item, { paid: 0, employee: person.employee }),
      });
    } catch (err) {
      serverError(res, err, "Error saving the pay item");
    }
  },
);

// Which entry a PATCH writes: a pause, a resume or an edit
const changeAction = (req) => {
  const status = req.body?.status;
  if (status === ITEM_STATUS.PAUSED) return "payItem.pause";
  if (status === ITEM_STATUS.ACTIVE) return "payItem.resume";
  return "payItem.edit";
};

const CHANGE_REPLIES = {
  edit: ITEM_MESSAGES.updated,
  pause: ITEM_MESSAGES.paused,
  resume: ITEM_MESSAGES.resumed,
};

// PATCH /api/deductions/items/:id: changes the amount, total (instalments), schedule,
// label or note, or with { status: "Paused" | "Active" } alone pauses or resumes the
// item (utils/payItems.js: checkChange). A Stopped or Completed item can't be changed.
router.patch(
  "/items/:id",
  requireDeductions,
  logActivity(changeAction),
  async (req, res) => {
    try {
      const found = await findItemFor(req);
      if (!found) return refuse(res, 404, ITEM_MESSAGES.notFound);
      const { item: before, person } = found;
      if (isOwnLinkedEmployee(req.currentUser, before.userId)) {
        return refuseOwnRecord(res);
      }

      const paid = paidOf(await paidByItem([before._id]), before);
      const checked = checkChange(req.body, before, paid);
      if (checked.error) return refuse(res, checked.status, checked.error);

      // Only while its stored status is as read: stopped or paused at the same moment,
      // it is not changed
      const item = await PayItem.findOneAndUpdate(
        { _id: before._id, status: before.status },
        { $set: checked.fields },
        { new: true, runValidators: true },
      ).lean();
      if (!item) {
        return (await PayItem.exists({ _id: before._id }))
          ? refuse(res, 409, ITEM_MESSAGES.changedMeanwhile)
          : refuse(res, 404, ITEM_MESSAGES.notFound);
      }

      res.locals.activity = {
        targetId: item._id,
        targetName: payItemName(item, person.employee, person.account),
        changed:
          checked.action === "edit"
            ? changedFields(before, item, CHANGE_LABELS.payItem)
            : [],
      };
      res.status(200).json({
        message: CHANGE_REPLIES[checked.action],
        item: itemReply(item, { paid, employee: person.employee }),
      });
    } catch (err) {
      serverError(res, err, "Error saving the pay item");
    }
  },
);

// POST /api/deductions/items/:id/stop: stops the item for good (it lands on no later
// cut-off and stays on record), stamping who stopped it and when
router.post(
  "/items/:id/stop",
  requireDeductions,
  logActivity("payItem.stop"),
  async (req, res) => {
    try {
      const found = await findItemFor(req);
      if (!found) return refuse(res, 404, ITEM_MESSAGES.notFound);
      const { item: before, person } = found;
      if (isOwnLinkedEmployee(req.currentUser, before.userId)) {
        return refuseOwnRecord(res);
      }

      const paid = paidOf(await paidByItem([before._id]), before);
      const status = statusOf(before, paid);
      if (status === ITEM_STATUS.STOPPED) {
        return refuse(res, 409, ITEM_MESSAGES.alreadyStopped);
      }
      if (status === ITEM_STATUS.COMPLETED) {
        return refuse(res, 409, ITEM_MESSAGES.completedLocked);
      }

      const item = await PayItem.findOneAndUpdate(
        { _id: before._id, status: { $ne: ITEM_STATUS.STOPPED } },
        {
          $set: {
            status: ITEM_STATUS.STOPPED,
            stoppedBy: req.user.userId,
            stoppedAt: new Date(),
          },
        },
        { new: true },
      ).lean();
      if (!item) {
        return (await PayItem.exists({ _id: before._id }))
          ? refuse(res, 409, ITEM_MESSAGES.alreadyStopped)
          : refuse(res, 404, ITEM_MESSAGES.notFound);
      }

      res.locals.activity = {
        targetId: item._id,
        targetName: payItemName(item, person.employee, person.account),
      };
      res.status(200).json({
        message: ITEM_MESSAGES.stopped,
        item: itemReply(item, { paid, employee: person.employee }),
      });
    } catch (err) {
      serverError(res, err, "Error stopping the pay item");
    }
  },
);

// DELETE /api/deductions/items/:id: deletes an item that is on no issued payslip (rule
// 15; one that is can only be stopped: 409)
router.delete(
  "/items/:id",
  requireDeductions,
  logActivity("payItem.delete"),
  async (req, res) => {
    try {
      const found = await findItemFor(req);
      if (!found) return refuse(res, 404, ITEM_MESSAGES.notFound);
      const { item: before, person } = found;
      if (isOwnLinkedEmployee(req.currentUser, before.userId)) {
        return refuseOwnRecord(res);
      }

      const paid = paidOf(await paidByItem([before._id]), before);
      if (!canDelete(paid)) return refuse(res, 409, ITEM_MESSAGES.onPayslip);

      const removed = await PayItem.findOneAndDelete({ _id: before._id }).lean();
      if (!removed) return refuse(res, 404, ITEM_MESSAGES.notFound);

      res.locals.activity = {
        targetId: removed._id,
        targetName: payItemName(removed, person.employee, person.account),
      };
      res.status(200).json({ message: ITEM_MESSAGES.deleted });
    } catch (err) {
      serverError(res, err, "Error deleting the pay item");
    }
  },
);

module.exports = router;
