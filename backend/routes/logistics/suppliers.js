// Suppliers: read by the procurement department and Accounting, maintained by
// Procurement Staff, Procurement Head and Admin.
const express = require("express");
const mongoose = require("mongoose");

const {
  requireAnyLogisticsPage,
  requireLogisticsRole,
  guard,
} = require("../../middleware/logisticsAccess");
const Supplier = require("../../models/supplier");
const { SUPPLIER_STATUSES, VAT_TYPES } = require("../../config/logistics");

const router = express.Router();

const serverError = (res, err) =>
  res.status(500).json({ message: "Server error", error: err.message });

const readSuppliers = guard(
  requireAnyLogisticsPage,
  requireLogisticsRole(["ProcurementStaff", "ProcurementHead", "Accounting"]),
);
const maintainSuppliers = guard(
  requireAnyLogisticsPage,
  requireLogisticsRole(["ProcurementStaff", "ProcurementHead"]),
);

const TEXT_FIELDS = ["contactPerson", "phone", "email", "address", "tin", "terms"];

// `merged` is the body on create, or the stored values overlaid with the body
// on edit. Returns { error } or { fields }.
const validateSupplier = (merged) => {
  const name = String(merged.name ?? "").trim();
  if (!name) return { error: "Supplier name is required." };

  if (!VAT_TYPES.includes(merged.vatType)) {
    return { error: `VAT type must be ${VAT_TYPES.join(" or ")}.` };
  }

  const status =
    merged.status === undefined || merged.status === null || merged.status === ""
      ? "Active"
      : merged.status;
  if (!SUPPLIER_STATUSES.includes(status)) {
    return { error: `Status must be ${SUPPLIER_STATUSES.join(" or ")}.` };
  }

  const fields = { name, vatType: merged.vatType, status };
  for (const key of TEXT_FIELDS) {
    fields[key] = String(merged[key] ?? "").trim();
  }
  return { fields };
};

// 409 when another supplier already has this name (any case or spacing)
const duplicateOf = async (name, excludeId) => {
  const filter = { nameKey: name.trim().toLowerCase() };
  if (excludeId) filter._id = { $ne: excludeId };
  return Supplier.findOne(filter).select("name").lean();
};

const duplicateMessage = (name) => `Supplier ${name} already exists.`;

router.get("/", readSuppliers, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const suppliers = await Supplier.find(filter).sort({ name: 1 }).lean();
    res.json(suppliers);
  } catch (err) {
    serverError(res, err);
  }
});

router.post("/", maintainSuppliers, async (req, res) => {
  try {
    const checked = validateSupplier(req.body || {});
    if (checked.error) return res.status(400).json({ message: checked.error });
    const { fields } = checked;

    const existing = await duplicateOf(fields.name);
    if (existing) {
      return res.status(409).json({ message: duplicateMessage(existing.name) });
    }

    const supplier = await Supplier.create({
      ...fields,
      createdBy: req.user.userId,
    });
    res.status(201).json(supplier.toObject());
  } catch (err) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ message: duplicateMessage(String(req.body?.name ?? "").trim()) });
    }
    serverError(res, err);
  }
});

router.put("/:id", maintainSuppliers, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid supplier ID." });
    }
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found." });
    }

    const body = req.body || {};
    const merged = {
      name: supplier.name,
      vatType: supplier.vatType,
      status: supplier.status,
    };
    for (const key of TEXT_FIELDS) merged[key] = supplier[key];
    for (const key of Object.keys(merged)) {
      if (body[key] !== undefined) merged[key] = body[key];
    }

    const checked = validateSupplier(merged);
    if (checked.error) return res.status(400).json({ message: checked.error });
    const { fields } = checked;

    const existing = await duplicateOf(fields.name, supplier._id);
    if (existing) {
      return res.status(409).json({ message: duplicateMessage(existing.name) });
    }

    Object.assign(supplier, fields);
    await supplier.save();
    res.json(supplier.toObject());
  } catch (err) {
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ message: duplicateMessage(String(req.body?.name ?? "").trim()) });
    }
    serverError(res, err);
  }
});

module.exports = router;
