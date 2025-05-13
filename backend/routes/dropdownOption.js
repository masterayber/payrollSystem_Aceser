const express = require("express");

const router = express.router();

const Dropdown = require("../models/dropdownOptions");

router.get("/dropdown-option", async (req, res) => {
  try {
    const dropdowns = await Dropdown.find();
    const result = {};

    dropdowns.forEach((item) => {})
  }
})