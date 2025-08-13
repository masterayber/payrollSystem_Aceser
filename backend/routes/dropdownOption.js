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
    res.json(dropdownOptions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch dropdown options" });
  }
});

// ADD Option Route
router.post("/:field/add", async (req, res) => {
  const { field } = req.params;
  const { option } = req.body;

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
        positions: {},
      };

      initialData[field] = [option.trim()];

      if (field === "departments") {
        initialData.positions[option] = [];
      }

      dropdownDoc = await Dropdown.create(initialData);
      return res.json(dropdownDoc);
    }

    if (!dropdownDoc[field]) {
      dropdownDoc[field] = [];
    }

    if (dropdownDoc[field].includes(option)) {
      return res.status(409).json({
        message: `${option} already exists in ${field}`,
      });
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

router.get("positions/:department", async (req, res) => {
  const { department } = req.params;

  try {
    const dropdown = await Dropdown.findOne();
    if (!dropdown || !dropdown.positions || !dropdown.positions[department]) {
    }
  } catch (error) {
    console.error("Internal Server Error:", error);
  }
});

// Route to ADD position at department
router.post("/positions/:department/add", async (req, res) => {
  const { department } = req.params;
  const { option } = req.body;

  console.log("Adding position:", option, "to department:", department);

  if (!option || !department) {
    return res
      .status(400)
      .json({ message: "Option and department are required" });
  }

  try {
    const update = {
      $addToSet: { [`positions.${department}`]: option },
    };
    const updated = await Dropdown.findOneAndUpdate({}, update, { new: true });

    if (!updated) {
      return res.status(404).json({ message: "Dropdown document not found" });
    }

    res.json({
      message: `Position '${option}' added to department '${department}'`,
      positions: updated.positions[department],
    });
  } catch (error) {
    res.status(500).json({ message: "Error adding position" });
  }
});

// Route to EDIT position at department
router.put("/positions/:department/edit", async (req, res) => {
  const { department } = req.params;
  const { oldOption, newOption } = req.body;

  console.log(
    `Editing position in '${department}': '${oldOption}' => '${newOption}'`
  );

  // Basic Validation
  if (!oldOption || !newOption) {
    return res.status(400).json({
      message: "Old option and new option are required",
    });
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

    const update = {
      $set: { [`positions.${department}.${index}`]: newOption },
    };
    const updated = await Dropdown.findOneAndUpdate({}, update, { new: true });

    res.json({
      message: `Position updated from '${oldOption}' to '${newOption}' in '${department}'`,
      positions: updated.positions[department],
    });
  } catch (error) {
    console.error("Error editing position:", error);
    res.status(500).json({ message: "Error editing position" });
  }
});

router.delete("/positions/:department/delete", async (req, res) => {
  const { department } = req.params;
  const { option } = req.body;

  console.log("Deleting position:", option, "to department:", department);

  if (!option || !department) {
    return res
      .status(400)
      .json({ message: "Option and department are required" });
  }

  try {
    const update = {
      $pull: { [`positions.${department}`]: option },
    };
    const updated = await Dropdown.findOneAndUpdate({}, update, { new: true });

    if (!updated) {
      return res.status(404).json({ message: "Dropdown document not found" });
    }

    res.json({
      message: `Position '${option}' deleted from department '${department}'`,
      positions: updated.positions[department],
    });
  } catch (error) {
    res.status(500).json({ message: "Error deleting position" });
  }
});

module.exports = router;
