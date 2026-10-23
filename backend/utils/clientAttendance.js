// Shapes attendance for the browser: pages compare dates as "YYYY-MM-DD"
// and read times as "HH:MM:SS". Both are stored as UTC fields.

const toIso = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
};

const toDateKey = (value) => toIso(value)?.slice(0, 10) ?? null;
const toTimeKey = (value) => toIso(value)?.slice(11, 19) ?? null;

const toClientAttendance = (record) => ({
  ...record,
  date: toDateKey(record.date),
  timeIn: toTimeKey(record.timeIn),
  timeOut: toTimeKey(record.timeOut),
  overtime: record.overtime && {
    ...record.overtime,
    start: toTimeKey(record.overtime.start),
    end: toTimeKey(record.overtime.end),
  },
});

module.exports = { toClientAttendance };
