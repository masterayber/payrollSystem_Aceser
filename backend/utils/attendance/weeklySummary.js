export const calculateWeeklySummary = (attendance = []) => {
  let onTime = 0;
  let late = 0;
  let absent = 0;

  const normalizeDate = (date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  const today = normalizeDate(new Date());

  const firstDayOfWeek = normalizeDate(new Date(today));
  const day = today.getDay();

  const diffToMonday = day === 0 ? -6 : 1 - day;
  firstDayOfWeek.setDate(firstDayOfWeek.getDate() + diffToMonday);

  const fridayOfWeek = normalizeDate(new Date(firstDayOfWeek));
  fridayOfWeek.setDate(firstDayOfWeek.getDate() + 4);

  const lastDayOfWeek = new Date(
    Math.min(today.getTime(), fridayOfWeek.getTime()),
  );

  attendance.forEach((record) => {
    const recordDate = normalizeDate(record.date);

    if (recordDate >= firstDayOfWeek && recordDate <= lastDayOfWeek) {
      if (record.behavior === "On-Time") onTime++;
      else if (record.behavior === "Late") late++;
      else if (record.behavior === "Absent") absent++;
    }
  });

  return {
    onTime,
    late,
    absent,
  };
};
