// Utility for the summary of hours

import { calculateWorkedHours } from "./time";

export const calculateMonthlySummary = (records) => {
  let totalDaysWorked = 0;
  let totalHoursWorked = 0;
  let totalOvertimeHours = 0;

  const now = new Date();

  records.forEach((record) => {
    const { date, timeIn, timeOut } = record;

    if (!record.timeIn || !record.timeOut) return;

    const recordDate = new Date(record.date);

    if (
      recordDate.getMonth() !== now.getMonth() ||
      recordDate.getFullYear() !== now.getFullYear()
    ) {
      return;
    }

    totalDaysWorked++;

    const { workedHours, overtime } = calculateWorkedHours({
      date,
      timeIn,
      timeOut,
    });

    totalHoursWorked += workedHours;
    totalOvertimeHours += overtime;
  });

  return {
    daysWorked: totalDaysWorked,
    hoursWorked: totalHoursWorked.toFixed(2),
    overtimeHours: totalOvertimeHours.toFixed(2),
  };
};
