const express = require("express");

const router = express.Router();

const Dropdown = require("../models/dropdownOption");

// Route for fetching dropdown options
router.get("/", async (req, res) => {
  try {
    const dropdownOptions = await Dropdown.findOne();
    res.json(dropdownOptions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch dropdown options" });
  }
});

router.put("/department", async (req, res) => {
  const { option } = req.body;
  if (!option) return res.status(400).json({ message: "Option is required" });

  try {
    const updated = await Dropdown.findOneAndUpdate(
      {},
      { $addToSet: { Departments: option } },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Error updating department list" });
  }
});

router.put("/department/edit", async (req, res) => {
  const { oldOption, newOption } = req.body;
  if (!oldOption || !newOption) {
    return res
      .status(400)
      .json({ message: "Both old new and new values are required" });
  }

  try {
    const dropdown = await Dropdown.findOne();

    if (!dropdown) {
      return res.status(404).json({ message: "Dropdown not found" });
    }

    const index = dropdown.Departments.indexOf(oldOption);
    if (index === -1) {
      return res.status(404).json({ message: "Old option not found" });
    }

    dropdown.Departments[index] = newOption;
    await dropdown.save();

    res.json(dropdown);
  } catch (error) {
    console.error("Error updating department:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.delete("/department/delete", async (req, res) => {
  try {
    const { option } = req.body;

    if (!option) {
      return res
        .status(400)
        .json({ error: "Option is required for deletion." });
    }

    const updatedDoc = await Dropdown.findOneAndUpdate(
      {},
      { $pull: { Departments: option } },
      { new: true }
    );

    console.log("Updated Doc:", updatedDoc);

    if (!updatedDoc) {
      return res.status(404).json({ error: "Dropdown option not found" });
    }

    res.status(200).json({
      message: `${option} has been deleted successfully.`,
      Departments: updatedDoc.Departments,
    });
  } catch (error) {
    console.error("Error deleting department:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
