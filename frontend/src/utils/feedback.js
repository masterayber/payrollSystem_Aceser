// Feedback messages on the password-reset pages are { type, text }. Green ("success"):
// it worked. Yellow ("warning"): wait and try again, or fix what was typed. Red ("error"):
// the request failed.
export const feedbackFromError = (error, fallback) => ({
  type: error.response?.status === 429 ? "warning" : "error",
  text: error.response?.data?.message || fallback,
});

// The text for a red box after a refused request. A refusal (4xx) shows the server's own
// words: { message } first, else { error } (the Filing routes use { error }). A server
// fault (5xx) carries technical text, so it shows the fallback instead; no reply at all
// (server down or offline) says so.
export const refusalText = (error, fallback) => {
  const status = error?.response?.status;
  if (!status) return "The server could not be reached. Please try again.";
  if (status >= 500) return fallback;
  const data = error.response.data || {};
  if (typeof data.message === "string" && data.message) return data.message;
  if (typeof data.error === "string" && data.error) return data.error;
  return fallback;
};
