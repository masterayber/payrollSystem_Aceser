export const formatDate = (startDate, endDate = null) => {
  if (!startDate) return "--";

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;

  const options = { month: "short", day: "numeric" };
  const yearOptions = { year: "numeric" };

  const startMonthDay = start.toLocaleDateString("en-US", options);
  const startYear = start.toLocaleDateString("en-US", yearOptions);

  if (end && start.toDateString() !== end.toDateString()) {
    const endDay = end.getDate();

    if (start.getMonth() === end.getMonth()) {
      return `${startMonthDay}–${endDay}, ${startYear}`;
    }

    const endMonthDay = end.toLocaleDateString("en-US", options);
    return `${startMonthDay} – ${endMonthDay}, ${startYear}`;
  }

  return `${startMonthDay}, ${startYear}`;
};

export const formatFullMonthDate = (date) => {
  if (!date) return "--";

  const d = new Date(date);
  const options = { month: "long", day: "numeric", year: "numeric" };

  return d.toLocaleDateString("en-US", options);
};
