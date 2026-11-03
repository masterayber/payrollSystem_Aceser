// Helpers for the VL and SL balance the server sends (/api/filing/leave-credits)

export const CREDIT_LEAVE_TYPES = ["Vacation Leave", "Sick Leave"];

export const daysText = (n) => `${n} day${n === 1 ? "" : "s"}`;

// "2026-10" as "October 2026"
export const monthName = (month) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

// Monday-Friday days from start to end ("YYYY-MM-DD"), both included
export const countWeekdays = (startKey, endKey) => {
  let count = 0;
  for (
    let date = new Date(`${startKey}T00:00:00Z`);
    date.toISOString().slice(0, 10) <= endKey;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
};
