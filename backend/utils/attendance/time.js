// Utility for calculation of hours (worked, overtime)

export const calculateWorkedHours = ({ date, timeIn, timeOut }) => {
  if (!timeIn || !timeOut) return { workedhours: 0, overtime: 0 };

  const timeInDate = new Date(`${date}T${timeIn}`);
  const timeOutDate = new Date(`${date}T${timeOut}`);

  let workedHours = (timeOutDate - timeInDate) / (1000 * 60 * 60);

  // break deduction
  const breakStart = new Date(`${date}T12:00:00`);
  const breakEnd = new Date(`${date}T13:00:00`);

  if (timeInDate < breakEnd && timeOutDate > breakStart) {
    workedHours -= 1;
  }

  const overtimeStart = new Date(`${date}T18:00:00`);

  let overtime = 0;

  if (timeOutDate > overtimeStart) {
    const overtimeMs = timeOutDate - overtimeStart;
    const overtimeHours = overtimeMs / (1000 * 60 * 60);

    if (overtimeHours >= 1) {
      overtime = Math.floor(overtimeHours);
    }
  }

  const standardHours = 8;
  if (workedHours > standardHours) {
    workedHours = standardHours;
  }

  return {
    workedHours,
    overtime,
  };
};
