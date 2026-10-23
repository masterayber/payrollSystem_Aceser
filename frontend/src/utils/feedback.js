// Feedback messages on the password-reset pages are { type, text }. Green ("success"):
// it worked. Yellow ("warning"): wait and try again, or fix what was typed. Red ("error"):
// the request failed.
export const feedbackFromError = (error, fallback) => ({
  type: error.response?.status === 429 ? "warning" : "error",
  text: error.response?.data?.message || fallback,
});
