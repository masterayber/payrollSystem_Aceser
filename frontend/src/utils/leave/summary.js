// Utility for leave summary

export const calculateLeaveSummary = (leaves = []) => {
  let total = 0;
  let approved = 0;
  let pending = 0;

  leaves.forEach((leave) => {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);

    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    total += days;

    if (leave.status === "Approved") {
      approved += days;
    }

    if (leave.status === "Pending") {
      pending += days;
    }
  });

  return {
    total,
    approved,
    pending,
  };
};
