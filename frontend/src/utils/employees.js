import { toManilaDate } from "./cutoff";

// The shared employee list holds active and resigned employees, active first

export const isResigned = (employee) => employee.status === "Resigned";

export const activeFirst = (employees) => [
  ...employees.filter((employee) => !isResigned(employee)),
  ...employees.filter(isResigned),
];

export const activeOnly = (employees) =>
  employees.filter((employee) => !isResigned(employee));

export const isPastLastWorkingDay = (employee, dateKey) => {
  const lastWorkingDay = isResigned(employee)
    ? employee.jobDescription?.resignationDate
    : "";
  return Boolean(lastWorkingDay) && dateKey > lastWorkingDay;
};

// The first day attendance counts for an employee, as a Manila "YYYY-MM-DD".
// Attendance goes by the start date in the job description, not the day the
// account was created; days between the two have no records until the admin
// fills them in. Works on an employee list row (`jobDescription`) and on the
// signed-in user (`settings.general.jobDescription`). Employees without a start
// date fall back to the account's `createdAt`. Empty when neither is a date.
export const hireDateKey = (employee) => {
  const startDate =
    employee?.jobDescription?.startDate ??
    employee?.settings?.general?.jobDescription?.startDate;
  const value = [startDate, employee?.createdAt].find(
    (date) => Boolean(date) && !Number.isNaN(new Date(date).getTime()),
  );
  return value ? toManilaDate(value) : "";
};
