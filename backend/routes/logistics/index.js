// /api/logistics: one router file per area
const express = require("express");

const router = express.Router();

router.use("/items", require("./items"));
router.use("/suppliers", require("./suppliers"));
router.use("/files", require("./files"));
router.use("/", require("./setup"));

module.exports = router;
