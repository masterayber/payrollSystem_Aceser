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
