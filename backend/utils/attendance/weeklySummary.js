export const calculateWeeklySummary = (attendance = []) => {
  let onTime = 0;
  let late = 0;
  let absent = 0;

  const today = new Date();

  const firstDayOfWeek = new Date(today);
  const day = today.getDay();

  const diffToMonday = day === 0 ? -6 : 1 - day;
  firstDayOfWeek.setDate(firstDayOfWeek.getDate() + diffToMonday);

  const lastDayOfWeek = new Date(firstDayOfWeek);
  lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 4);

  attendance.forEach((record) => {
    const recordDate = new Date(record.date);

    if (recordDate >= firstDayOfWeek && recordDate <= lastDayOfWeek) {
      if (record.behavior === "On-Time") onTime++;
      else if (record.behavior === "Late") late++;
      else if (record.behavior === "Absent") absent;
    }
  });

  return {
    onTime,
    late,
    absent,
  };
};
