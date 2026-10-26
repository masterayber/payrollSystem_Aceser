// Checks the basic pay and regularization date an admin sends for an employee's job.
// `body` is the request body; `current` is the saved job description ({} for a new
// employee). Returns { error } or { fields } with only the fields that were sent,
// cleaned up ("" or null clears a field).

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Fields that, when sent, mean the employment details are being edited
const EMPLOYMENT_FIELDS = ["employmentType", "startDate", "regularizationDate"];

const isEmpty = (value) => value === "" || value === null;

// A saved Date or a "YYYY-MM-DD" string as "YYYY-MM-DD" ("" when missing or invalid)
const toDateKey = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : "";
};

const checkJobDetails = (body, current = {}) => {
  const fields = {};

  if (body.basicPay !== undefined) {
    if (isEmpty(body.basicPay)) {
      fields.basicPay = null;
    } else {
      const pay = Number(body.basicPay);
      if (!Number.isFinite(pay) || pay < 0) {
        return { error: "Basic pay must be an amount of 0 or more." };
      }
      fields.basicPay = Math.round(pay * 100) / 100;
    }
  }

  if (body.regularizationDate !== undefined) {
    if (isEmpty(body.regularizationDate)) {
      fields.regularizationDate = null;
    } else if (
      typeof body.regularizationDate !== "string" ||
      !DATE_PATTERN.test(body.regularizationDate) ||
      !toDateKey(body.regularizationDate)
    ) {
      return { error: "Date of regularization must be a valid date." };
    } else {
      fields.regularizationDate = body.regularizationDate;
    }
  }

  // A personal-details edit doesn't need the employment rules below
  if (!EMPLOYMENT_FIELDS.some((field) => body[field] !== undefined)) {
    return { fields };
  }

  // The job as it will be after the save
  const employmentType = body.employmentType ?? current.employmentType;
  const startDate = toDateKey(body.startDate ?? current.startDate);
  const regularizationDate = toDateKey(
    fields.regularizationDate !== undefined
      ? fields.regularizationDate
      : current.regularizationDate,
  );

  if (employmentType === "Regular" && !regularizationDate) {
    return { error: "A regular employee needs a date of regularization." };
  }
  if (regularizationDate && startDate && regularizationDate < startDate) {
    return {
      error: "The date of regularization can't be before the start date.",
    };
  }

  return { fields };
};

module.exports = { checkJobDetails };
