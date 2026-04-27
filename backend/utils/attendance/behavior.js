// Utility for classification of the user depending on their time in and time out (Late, On-Time, Absent, etc...)

export const calculateBehavior = ({
  date,
  timeIn,
  timeOut,
  schedule,
  isBeforeHired = false,
}) => {
  const today = new Date(date);
  const dayOfWeek = today.getDay();

  const defaultTimeIn = schedule?.timeIn || "08:00:00";
  const defaultTimeOut = schedule?.timeOut || "17:00:00";

  const shiftStart = new Date(`${date}T${defaultTimeIn}`);
  const shiftEnd = new Date(`${date}T${defaultTimeOut}`);

  const lateThreshold = new Date(shiftStart.getTime() + 1 * 60 * 1000);

  if (isBeforeHired) return "Not Hired Yet";

  const hasTimeIn = timeIn && timeIn !== "--:--";
  const hasTimeOut = timeOut && timeOut !== "--:--";

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    if (!hasTimeIn && !hasTimeOut) return "Weekend";
  }

  if (!hasTimeIn && !hasTimeOut) {
    const recordDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    recordDate.setHours(0, 0, 0, 0);

    const now = new Date();
    const officeEndTime = new Date(date);
    officeEndTime.setHours(17, 0, 0, 0);

    if (recordDate < today || now >= officeEndTime) {
      return "Absent";
    }

    return "Pending";
  }

  if (!hasTimeIn) return "No Time In";

  const timeInDate = new Date(`${date}T${timeIn}`);

  if (!hasTimeOut) {
    const todayStr = new Date().toISOString().split("T")[0];
    const recordDateStr = new Date(date).toISOString().split("T")[0];

    return todayStr === recordDateStr ? "On-Time" : "No Time Out";
  }

  const timeOutDate = new Date(`${date}T${timeOut}`);

  const halfDayMorningOut = new Date(`${date}T13:00:00`);
  if (timeInDate <= shiftStart && timeOutDate <= halfDayMorningOut) {
    return "Half-Day";
  }

  const halfDayAfternoonStart = new Date(`${date}T10:00:00`);
  const halfDayAfternoonEnd = new Date(`${date}T13:00:00`);

  if (
    timeInDate >= halfDayAfternoonStart &&
    timeInDate <= halfDayAfternoonEnd
  ) {
    return "Half-Day";
  }

  if (timeInDate >= lateThreshold) return "Late";

  if (timeOutDate < shiftEnd) return "Early-Out";

  return "On-Time";
};
