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

export const formatTime = (time) => {
  if (!time) return "--:--:--";

  const timeValue = String(time).includes("T")
    ? String(time).split("T")[1]
    : String(time);

  const match = timeValue.match(/^(\d{2}):(\d{2}):(\d{2})/);

  if (!match) return "--:--:--";

  const [, hoursStr, minutes, seconds] = match;
  let hours = parseInt(hoursStr, 10);
  const period = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  if (hours === 0) hours = 12;

  const displayHours = String(hours).padStart(2, "0");

  return `${displayHours}:${minutes}:${seconds} ${period}`;
};
