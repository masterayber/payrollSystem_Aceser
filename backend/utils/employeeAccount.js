const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");

// The next free Employee ID: one after the highest "AC-<number>" on an Employee
// record (numbers compared as numbers, so AC-010 follows AC-009), or "AC-001" when
// there is none. There is no counter document: the IDs on the records are the counter.
const nextEmployeeId = async () => {
  const lastEmployee = await Employee.findOne({
    employeeId: { $regex: /^AC-\d+$/ },
  })
    .sort({ employeeId: -1 })
    .collation({ locale: "en_US", numericOrdering: true });

  if (!lastEmployee || !lastEmployee.employeeId) return "AC-001";
  const lastNumber = parseInt(lastEmployee.employeeId.split("-")[1], 10);
  return `AC-${String(lastNumber + 1).padStart(3, "0")}`;
};

// Creates the Auth, Employee and Settings records of a new Active Employee-role
// account, the way Add Employee does. `details` is the request body; `jobFields` the
// cleaned fields from checkJobDetails (basic pay, regularization date, VL opening).
// The role is always "Employee". The Auth pre-save hook hashes the password.
// `mustChangePassword` comes only from the caller's options (Add Employee passes true),
// never from `details`; it defaults to false.
const createEmployeeAccount = async (
  details,
  jobFields = {},
  { mustChangePassword = false } = {},
) => {
  const {
    firstName,
    lastName,
    employeeId,
    gender,
    email,
    username,
    password,
    designation,
    department,
    position,
    employmentType,
    startDate,
    timeIn,
    timeOut,
  } = details;

  const user = new User({
    username,
    password,
    email,
    role: "Employee",
    status: "Active",
    mustChangePassword: mustChangePassword === true,
    createdAt: new Date(),
  });
  await user.save();

  const employee = new Employee({
    userId: user._id,
    firstName,
    lastName,
    employeeId,
    email,
    gender,
    role: user.role,
    birthday: "",
    contactNumber: "",
    emergencyDetails: {
      contactFirstName: "",
      contactLastName: "",
      contactEmergency: "",
      contactAddress: "",
    },
    createdAt: new Date(),
  });
  await employee.save();

  const settings = new Settings({
    userId: user._id,
    general: {
      jobDescription: {
        designation: designation,
        department: department,
        position: position,
        employmentType: employmentType,
        startDate: startDate,
        ...jobFields,
        schedule: {
          timeIn: timeIn,
          timeOut: timeOut,
        },
      },
    },
  });
  await settings.save();

  return { user, employee, settings };
};

module.exports = { nextEmployeeId, createEmployeeAccount };
