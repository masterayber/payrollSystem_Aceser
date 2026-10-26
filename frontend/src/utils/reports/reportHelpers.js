import {
  MONTHS as months,
  getCutoffLabel,
  getCutoffRange,
  parseCutoffValue,
} from "../cutoff";

import { isPastLastWorkingDay } from "../employees";

export const formatMonthValue = (year, monthIndex) =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

export const formatKey = (date) => {
  if (typeof date === "string") return date.split("T")[0];
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const isNotEmployedOn = (employee, dateKey) => {
  const hireKey = employee.createdAt ? formatKey(employee.createdAt) : null;
  return (
    Boolean(hireKey && dateKey < hireKey) ||
    isPastLastWorkingDay(employee, dateKey)
  );
};

export const getMonthOptions = () => {
  const options = [];
  const today = new Date();
  let monthIndex = today.getMonth();
  let year = today.getFullYear();

  for (let i = 0; i < 6; i += 1) {
    options.push({
      label: `${months[monthIndex]} ${year}`,
      value: formatMonthValue(year, monthIndex),
    });
    monthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
    if (monthIndex === 11) year -= 1;
  }

  return options;
};

export const getDateRange = (reportType, selectedOption) => {
  if (!selectedOption) {
    return { start: "", end: "", label: "" };
  }

  if (reportType === "month") {
    const [yearStr, monthStr] = selectedOption.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const monthName = months[monthIndex];

    return {
      start: `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`,
      end: `${year}-${String(monthIndex + 1).padStart(2, "0")}-${new Date(year, monthIndex + 1, 0).getDate()}`,
      label: `${monthName} ${year}`,
      monthName,
      cutoff: "",
    };
  }

  // Cut-off dates come from the shared helper (1st: 11th-25th, 2nd: 26th-10th)
  const cutoff = parseCutoffValue(selectedOption);
  const { start, end } = getCutoffRange(cutoff);

  return {
    start,
    end,
    label: getCutoffLabel(cutoff),
    monthName: months[cutoff.monthIndex],
    nextMonthName:
      cutoff.half === "2nd" ? months[(cutoff.monthIndex + 1) % 12] : undefined,
    cutoff: cutoff.half,
  };
};

export const getFormattedDateRange = (reportType, selectedOption) => {
  const { start, end, monthName, nextMonthName, prevMonthName } = getDateRange(
    reportType,
    selectedOption,
  );
  if (!start || !end) return "";

  const startDate = new Date(start);
  const endDate = new Date(end);
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const endYear = endDate.getFullYear();

  if (reportType === "month") {
    return `${monthName} ${startDay}-${endDay} ${endYear}`;
  }

  if (startDate.getMonth() !== endDate.getMonth()) {
    const displayStartMonth = prevMonthName || monthName;
    const displayEndMonth = nextMonthName || monthName;
    return `${displayStartMonth} ${startDay} - ${displayEndMonth} ${endDay} ${endYear}`;
  }

  return `${monthName} ${startDay}-${endDay} ${endYear}`;
};
