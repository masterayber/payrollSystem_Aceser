// Payroll constants: the only place these dates are spelled.

// The day the portal started recording basic pay changes (models/basicPayChange.js).
// The first change for someone records their old pay as in force from the later of this
// day and the start date; days before the first record use that record's amount.
const PAY_HISTORY_START = "2026-11-04";

// The first year the 13th month report can be shown for
const THIRTEENTH_MONTH_FIRST_YEAR = 2026;

module.exports = { PAY_HISTORY_START, THIRTEENTH_MONTH_FIRST_YEAR };
