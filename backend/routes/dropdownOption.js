const express = require("express");
const router = express.Router();
const Dropdown = require("../models/dropdownOption");
const {
  requireAdmin,
  requireAdminPage,
} = require("../middleware/accessMiddleware");
const {
  isReservedDropdownValue,
  normalize,
} = require("../utils/logisticsAccess");
const { findDuplicate, positionsIn } = require("../utils/dropdownValues");

const allowedFields = [
  "designations",
  "departments",
  "employmentTypes",
  "itemCategories",
  "unitsOfMeasure",
];

function isValidField(field) {
  return allowedFields.includes(field);
}

// Who may change a list. Reading stays open to any Admin (the Add and Edit Employee
// forms need it). The Logistics lists are edited from Logistics > Setup
// ("logistics-setup" tick); the others and the positions from Settings > Manage
// ("settings-manage" tick). The Super Admin always passes.
const LOGISTICS_LIST_FIELDS = ["itemCategories", "unitsOfMeasure"];
const requireListEditor = requireAdminPage((req) =>
  LOGISTICS_LIST_FIELDS.includes(req.params.field)
    ? "logistics-setup"
    : "settings-manage",
);
const requireManageSettings = requireAdminPage("settings-manage");

// Plain-English names for the dropdown fields, for messages shown on screen
const fieldLabels = {
  departments: "departments",
  positions: "positions",
  designations: "designations",
  employmentTypes: "employment types",
  gender: "gender",
  itemCategories: "item categories",
  unitsOfMeasure: "units of measure",
};

const fieldLabel = (field) => fieldLabels[field] || field;

// Values that differ only in capitals or outer spaces count as the same value
const duplicateMessage = (stored, field) =>
  `${stored} already exists in ${fieldLabel(field)}`;

// The Logistics module reads its roles from these dropdown values, so removing
// or renaming one would silently strip people of their rights.
const reservedMessage = (value) =>
  `"${String(value).trim()}" is used by the Logistics module and can't be removed or renamed.`;

// A rename that only changes case or spacing keeps the value matching, so it may pass
const isReservedRename = (kind, oldOption, newOption) =>
  isReservedDropdownValue(kind, oldOption) &&
  normalize(oldOption) !== normalize(newOption);

// For deleting a department: the reserved position it still holds, if any
const reservedPositionIn = (dropdown, department) => {
  const positions = dropdown?.positions;
  if (!positions) return null;
  const list =
    positions instanceof Map ? positions.get(department) : positions[department];
  return (list || []).find((position) =>
    isReservedDropdownValue("positions", position),
  );
};

// Route for fetching dropdown options
router.get("/", requireAdmin, async (req, res) => {
  try {
    const dropdownOptions = await Dropdown.findOne();
    res.json(dropdownOptions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch dropdown options" });
  }
});

// ADD Option Route
router.post("/:field/add", requireListEditor, async (req, res) => {
  const { field } = req.params;
  const option = String(req.body.option ?? "").trim();

  if (!isValidField(field)) {
    return res.status(400).json({ message: "Invalid dropdown field" });
  }

  if (!option) {
    return res.status(400).json({ message: "Option is required" });
  }

  try {
    let dropdownDoc = await Dropdown.findOne({});

    if (!dropdownDoc) {
      const initialData = {
        designations: [],
        departments: [],
        employmentTypes: [],
        itemCategories: [],
        unitsOfMeasure: [],
        positions: {},
      };

      initialData[field] = [option];

      if (field === "departments") {
        initialData.positions[option] = [];
      }

      dropdownDoc = await Dropdown.create(initialData);
      return res.json(dropdownDoc);
    }

    if (!dropdownDoc[field]) {
      dropdownDoc[field] = [];
    }

    const existing = findDuplicate(dropdownDoc[field], option);
    if (existing !== null) {
      return res
        .status(409)
        .json({ message: duplicateMessage(existing, field) });
    }

    let update = { $addToSet: { [field]: option } };

    // check if adding a department, also initiate positions[option] as an empty array
    if (field === "departments") {
      if (!dropdownDoc.positions) {
        update.$set = {
          positions: { [option]: [] },
        };
      } else {
        update.$set = { [`positions.${option}`]: [] };
      }
    }

    const updated = await Dropdown.findOneAndUpdate({}, update, { new: true });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Error updating department list" });
  }
});

// EDIT Option Route
router.put("/:field/edit", requireListEditor, async (req, res) => {
  const { field } = req.params;
  const { oldOption } = req.body;
  const newOption = String(req.body.newOption ?? "").trim();

  if (!isValidField(field)) {
    return res.status(400).json({ message: "Invalid dropdown field" });
  }

  if (!oldOption || !newOption) {
    return res
      .status(400)
      .json({ message: "Both old and new values are required" });
  }

  if (
    field === "departments" &&
    isReservedRename("departments", oldOption, newOption)
  ) {
    return res.status(409).json({ message: reservedMessage(oldOption) });
  }

  try {
    const dropdown = await Dropdown.findOne();
    if (!dropdown || !dropdown[field]) {
      return res
        .status(404)
        .json({ message: `Field '${fieldLabel(field)}' not found` });
    }

    const index = dropdown[field].indexOf(oldOption);
    if (index === -1) {
      return res.status(404).json({ message: "Old option not found" });
    }

    // Checked before any write; the value's own entry is skipped so a
    // case-only rename of itself still passes
    const clash = findDuplicate(dropdown[field], newOption, index);
    if (clash !== null) {
      return res.status(409).json({ message: duplicateMessage(clash, field) });
    }

    dropdown[field][index] = newOption;

    // A department's positions are keyed by its name, so they move with it
    if (
      field === "departments" &&
      oldOption !== newOption &&
      dropdown.positions?.has(oldOption)
    ) {
      const moved = positionsIn(dropdown, oldOption);
      dropdown.positions.delete(oldOption);
      dropdown.positions.set(newOption, moved);
    }

    await dropdown.save();

    res.json(dropdown);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// DELETE Option Route
router.delete("/:field/delete", requireListEditor, async (req, res) => {
  const { field } = req.params;
  const { option } = req.body;

  if (!isValidField(field)) {
    return res.status(400).json({ message: "Invalid dropdown field" });
  }

  if (!option) {
    return res.status(400).json({ error: "Option is required for deletion." });
  }

  try {
    if (field === "departments") {
      if (isReservedDropdownValue("departments", option)) {
        return res.status(409).json({ message: reservedMessage(option) });
      }
      const current = await Dropdown.findOne().lean();
      const reservedPosition = reservedPositionIn(current, option);
      if (reservedPosition) {
        return res
          .status(409)
          .json({ message: reservedMessage(reservedPosition) });
      }
    }

    let update = { $pull: { [field]: option } };

    if (field === "departments") {
      update.$unset = { [`positions.${option}`]: "" };
    }

    const updatedDoc = await Dropdown.findOneAndUpdate({}, update, {
      new: true,
    });

    if (!updatedDoc) {
      return res.status(404).json({ error: "Dropdown option not found" });
    }

    res.status(200).json({
      message: `${option} has been deleted successfully.`,
      updatedList: updatedDoc[field],
    });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Route to FETCH department positions
router.get("/positions/:department", requireAdmin, async (req, res) => {
  const { department } = req.params;

  try {
    const dropdown = await Dropdown.findOne().lean();
    const known =
      (dropdown?.departments || []).includes(department) ||
      Object.hasOwn(dropdown?.positions || {}, department);
    if (!known) {
      return res
        .status(404)
        .json({ message: `Department '${department}' not found` });
    }

    res.json(positionsIn(dropdown, department));
  } catch (error) {
    console.error("Internal Server Error:", error);
    res.status(500).json({ message: "Error fetching positions" });
  }
});

// Route to ADD position at department
router.post(
  "/positions/:department/add",
  requireManageSettings,
  async (req, res) => {
    const { department } = req.params;
    const option = String(req.body.option ?? "").trim();

    console.log("Adding position:", option, "to department:", department);

    if (!option || !department) {
      return res
        .status(400)
        .json({ message: "Option and department are required" });
    }

    try {
      const current = await Dropdown.findOne().lean();
      if (!current) {
        return res.status(404).json({ message: "Dropdown document not found" });
      }

      // Only this department's positions count; another department may hold
      // the same title
      const existing = findDuplicate(positionsIn(current, department), option);
      if (existing !== null) {
        return res
          .status(409)
          .json({ message: duplicateMessage(existing, "positions") });
      }

      const update = {
        $addToSet: { [`positions.${department}`]: option },
      };
      const updated = await Dropdown.findOneAndUpdate({}, update, { new: true });

      if (!updated) {
        return res.status(404).json({ message: "Dropdown document not found" });
      }

      res.json({
        message: `Position '${option}' added to department '${department}'`,
        positions: positionsIn(updated, department),
      });
    } catch (error) {
      res.status(500).json({ message: "Error adding position" });
    }
  },
);

// Route to EDIT position at department
router.put(
  "/positions/:department/edit",
  requireManageSettings,
  async (req, res) => {
    const { department } = req.params;
    const { oldOption } = req.body;
    const newOption = String(req.body.newOption ?? "").trim();

    console.log(
      `Editing position in '${department}': '${oldOption}' => '${newOption}'`,
    );

    // Basic Validation
    if (!oldOption || !newOption) {
      return res.status(400).json({
        message: "Old option and new option are required",
      });
    }

    if (isReservedRename("positions", oldOption, newOption)) {
      return res.status(409).json({ message: reservedMessage(oldOption) });
    }

    try {
      // fetch current doc
      const dropdown = await Dropdown.findOne().lean();
      if (!dropdown) {
        return res.status(404).json({ message: "Dropdown document not found" });
      }

      if (!dropdown.positions || !dropdown.positions[department]) {
        return res
          .status(404)
          .json({ message: `Department '${department}' not found` });
      }

      const index = dropdown.positions[department].indexOf(oldOption);
      if (index === -1) {
        return res.status(404).json({
          message: `Old position '${oldOption}' not found in '${department}'`,
        });
      }

      const clash = findDuplicate(dropdown.positions[department], newOption, index);
      if (clash !== null) {
        return res
          .status(409)
          .json({ message: duplicateMessage(clash, "positions") });
      }

      const update = {
        $set: { [`positions.${department}.${index}`]: newOption },
      };
      const updated = await Dropdown.findOneAndUpdate({}, update, { new: true });

      res.json({
        message: `Position updated from '${oldOption}' to '${newOption}' in '${department}'`,
        positions: positionsIn(updated, department),
      });
    } catch (error) {
      console.error("Error editing position:", error);
      res.status(500).json({ message: "Error editing position" });
    }
  },
);

// Route to DELETE positions on department
router.delete(
  "/positions/:department/delete",
  requireManageSettings,
  async (req, res) => {
    const { department } = req.params;
    const { option } = req.body;

    console.log("Deleting position:", option, "to department:", department);

    if (!option || !department) {
      return res
        .status(400)
        .json({ message: "Option and department are required" });
    }

    if (isReservedDropdownValue("positions", option)) {
      return res.status(409).json({ message: reservedMessage(option) });
    }

    try {
      const update = {
        $pull: { [`positions.${department}`]: option },
      };
      const updated = await Dropdown.findOneAndUpdate({}, update, {
        new: true,
      });

      if (!updated) {
        return res.status(404).json({ message: "Dropdown document not found" });
      }

      res.json({
        message: `Position '${option}' deleted from department '${department}'`,
        positions: positionsIn(updated, department),
      });
    } catch (error) {
      res.status(500).json({ message: "Error deleting position" });
    }
  },
);

module.exports = router;
