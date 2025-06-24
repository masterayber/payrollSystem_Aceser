const express = require("express");
const router = express.Router();
const Dropdown = require("../models/dropdownOption");

const allowedFields = ["designations", "departments", "employmentTypes"];

function isValidField(field) {
  return allowedFields.includes(field);
}

// Route for fetching dropdown options
router.get("/", async (req, res) => {
  try {
    const dropdownOptions = await Dropdown.findOne();
    console.log("Dropdown Options:", dropdownOptions);
    res.json(dropdownOptions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch dropdown options" });
  }
});

// ADD Option Route
router.put("/:field/add", async (req, res) => {
  const { field } = req.params;
  const { option } = req.body;

  if (!isValidField(field)) {
    return res.status(400).json({ message: "Invalid dropdown field" });
  }

  if (!option) {
    return res.status(400).json({ message: "Option is required" });
  }

  try {
    let update = { $addToSet: { [field]: option } };

    // check if adding a department, also initiate positions[option] as an empty array
    if (field === "departments") {
      update.$set = { [`positions.${option}`]: [] };
    }

    const updated = await Dropdown.findOneAndUpdate({}, update, { new: true });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Error updating department list" });
  }
});

// EDIT Option Route
router.put("/:field/edit", async (req, res) => {
  const { field } = req.params;
  const { oldOption, newOption } = req.body;

  if (!isValidField(field)) {
    return res.status(400).json({ message: "Invalid dropdown field" });
  }

  if (!oldOption || !newOption) {
    return res
      .status(400)
      .json({ message: "Both old and new values are required" });
  }

  try {
    const dropdown = await Dropdown.findOne();
    if (!dropdown || !dropdown[field]) {
      return res.status(404).json({ message: `Field '${field}' not found` });
    }

    const index = dropdown[field].indexOf(oldOption);
    if (index === -1) {
      return res.status(404).json({ message: "Old option not found" });
    }

    dropdown[field][index] = newOption;
    await dropdown.save();

    res.json(dropdown);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// DELETE Option Route
router.delete("/:field/delete", async (req, res) => {
  const { field } = req.params;
  const { option } = req.body;

  if (!isValidField(field)) {
    return res.status(400).json({ message: "Invalid dropdown field" });
  }

  if (!option) {
    return res.status(400).json({ error: "Option is required for deletion." });
  }

  try {
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

module.exports = router;
