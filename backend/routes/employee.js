const express = require("express");

const router = express.Router();

router.get("/latest-employeeId", async (req, res) => {
  try {
    const lastEmployee = await Employee.findOne({
      employeeId: { $regex: /^AC-\d+$/ },
    })
      .sort({ employeeId: -1 })
      .collation({ locale: "en_US", numeringOrdering: true });

    let newEmployeeId = "AC-001";
    if (lastEmployee && lastEmployee.employeeId) {
      const lastNumber = parseInt(lastEmployee.employeeId.split("-")[1], 10);
      newEmployeeId = `AC-${String(lastNumber + 1).padStart(3, "0")}`;
    }

    res.json({ newEmployeeId });
  } catch (error) {
    console.error("Error fetching latest Employee ID", error);
  }
});

module.exports = router;
