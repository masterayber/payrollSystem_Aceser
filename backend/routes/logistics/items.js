// Item Master: one shared list of materials for every project. Anyone with a
// logistics page may list it; Procurement Staff and Admin maintain it.
const express = require("express");
const mongoose = require("mongoose");

const {
  requireAnyLogisticsPage,
  requireLogisticsRole,
  guard,
} = require("../../middleware/logisticsAccess");
const Item = require("../../models/item");

const router = express.Router();

const serverError = (res, err) =>
  res.status(500).json({ message: "Server error", error: err.message });

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const LIST_FIELDS =
  "code description category unit specs status createdAt updatedAt";
const EDITABLE_STATUSES = ["Active", "Inactive"];

const maintainItems = guard(
  requireAnyLogisticsPage,
  requireLogisticsRole(["ProcurementStaff"]),
);

// Validates the fields present in `body`. When `all` is true every required
// field must be there (create). Returns { error } or { fields }.
const validateItem = (body, { all }) => {
  const fields = {};

  if (all || body.code !== undefined) {
    const code = String(body.code ?? "")
      .trim()
      .toUpperCase();
    if (!code) return { error: "Item code is required." };
    fields.code = code;
  }
  if (all || body.description !== undefined) {
    const description = String(body.description ?? "").trim();
    if (!description) return { error: "Description is required." };
    fields.description = description;
  }
  if (all || body.category !== undefined) {
    const category = String(body.category ?? "").trim();
    if (!category) return { error: "Category is required." };
    fields.category = category;
  }
  if (all || body.unit !== undefined) {
    const unit = String(body.unit ?? "").trim();
    if (!unit) return { error: "Unit is required." };
    fields.unit = unit;
  }
  if (body.specs !== undefined) {
    fields.specs = String(body.specs ?? "").trim();
  }
  if (body.status !== undefined && body.status !== null && body.status !== "") {
    if (!EDITABLE_STATUSES.includes(body.status)) {
      return { error: "Status must be Active or Inactive." };
    }
    fields.status = body.status;
  }

  return { fields };
};

const duplicateMessage = (code) => `Item code ${code} is already used.`;

router.get("/", requireAnyLogisticsPage, async (req, res) => {
  try {
    const { status, q, category } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (q && String(q).trim()) {
      const regex = new RegExp(escapeRegExp(String(q).trim()), "i");
      filter.$or = [{ code: regex }, { description: regex }, { specs: regex }];
    }

    const items = await Item.find(filter)
      .select(LIST_FIELDS)
      .sort({ description: 1 })
      .lean();
    res.json(items);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/", maintainItems, async (req, res) => {
  try {
    const checked = validateItem(req.body || {}, { all: true });
    if (checked.error) return res.status(400).json({ message: checked.error });
    const { fields } = checked;

    if (await Item.exists({ code: fields.code })) {
      return res.status(409).json({ message: duplicateMessage(fields.code) });
    }

    const item = await Item.create({
      ...fields,
      status: fields.status || "Active",
      createdBy: req.user.userId,
    });
    res.status(201).json(item.toObject());
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        message: duplicateMessage(
          String(req.body?.code ?? "")
            .trim()
            .toUpperCase(),
        ),
      });
    }
    serverError(res, err);
  }
});

router.put("/:id", maintainItems, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid item ID." });
    }
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found." });

    const body = { ...(req.body || {}) };
    // A Pending item is reviewed through its own route, not edited into Active
    if (item.status === "Pending") delete body.status;

    const checked = validateItem(body, { all: false });
    if (checked.error) return res.status(400).json({ message: checked.error });
    const { fields } = checked;

    if (
      fields.code !== undefined &&
      fields.code !== item.code &&
      (await Item.exists({ code: fields.code, _id: { $ne: item._id } }))
    ) {
      return res.status(409).json({ message: duplicateMessage(fields.code) });
    }

    Object.assign(item, fields);
    await item.save();
    res.json(item.toObject());
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        message: duplicateMessage(
          String(req.body?.code ?? "")
            .trim()
            .toUpperCase(),
        ),
      });
    }
    serverError(res, err);
  }
});

module.exports = router;
