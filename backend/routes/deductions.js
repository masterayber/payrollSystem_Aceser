const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Deductions = require("../models/deductions");

// Route for fetching deductions
// router.get("/", async (req, res) => {
//   try {
//     const deductions = await Deductions.findOne();
//     if (!deductions) {
//       deductions = await Deductions.create();
//     }
//     res.json(deductions);
//   } catch (error) {
//     res.status(500).json({ message: "Failed to fetch deductions" });
//   }
// });
