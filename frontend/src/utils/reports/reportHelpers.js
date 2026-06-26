const months = [
  "January",
  "Februry",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const formatMonthValue = (year, monthIndex) =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

export const formatKey = (date) => {
  if (typeof date === "string") return date.split("T")[0];
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getCutoffOptions = () => {
  const options = [];
  const today = new Date();

  let monthIndex = today.getMonth();
  let year = today.getFullYear();

  const currentCutoff = today.getDate() >= 26 ? "2nd" : "1st";

  if (currentCutoff === "2nd") {
    options.push({
      label: `${months[monthIndex]} ${year} 2nd Cutoff`,
      value: `${year}-${String(monthIndex + 1).padStart(2, "0")}-2nd`,
    });
  }

  options.push({
    label: `${months[monthIndex]} ${year} 1st Cutoff`,
    value: `${year}-${String(monthIndex + 1).padStart(2, "0")}-1st`,
  });

  while (options.length < 6) {
    monthIndex = monthIndex === 0 ? 11 : monthIndex - 1;

    if (monthIndex === 11) {
      year -= 1;
    }

    options.push({
      label: `${months[monthIndex]} ${year} 2nd Cutoff`,
      value: `${year}-${String(monthIndex + 1).padStart(2, "0")}-2nd`,
    });

    if (options.length >= 6) break;

    options.push({
      label: `${months[monthIndex]} ${year} 1st Cutoff`,
      value: `${year}-${String(monthIndex + 1).padStart(2, "0")}-1st`,
    });
  }

  return options;
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

  const [yearStr, monthStr, cutoff] = selectedOption.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const monthName = months[monthIndex];

  if (reportType === "month") {
    return {
      start: `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`,
      end: `${year}-${String(monthIndex + 1).padStart(2, "0")}-${new Date(year, monthIndex + 1, 0).getDate()}`,
      label: `${monthName} ${year}`,
      monthName,
      cutoff: "",
    };
  }

  if (cutoff === "1st") {
    return {
      start: `${year}-${String(monthIndex + 1).padStart(2, "0")}-11`,
      end: `${year}-${String(monthIndex + 1).padStart(2, "0")}-25`,
      label: `${monthName} ${year} 1st Cutoff`,
      monthName,
      cutoff,
    };
  }

  const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1;
  const nextYear = monthIndex === 11 ? year + 1 : year;

  return {
    start: `${year}-${String(monthIndex + 1).padStart(2, "0")}-26`,
    end: `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-10`,
    label: `${monthName} ${year} 2nd Cutoff`,
    monthName,
    nextMonthName: months[nextMonth],
    cutoff,
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
