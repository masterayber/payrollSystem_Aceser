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

module.exports = router;
