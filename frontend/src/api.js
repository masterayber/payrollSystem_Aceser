import axios from "axios";
import {
  endSession,
  isPasswordChangeRequiredError,
  requirePasswordChange,
  sessionEndReason,
} from "./utils/session";

const API = axios.create({ baseURL: "http://localhost:5000" });

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// The account's role changed, or it is no longer active, while it was signed in: end
// the session (alert once, back to "/"). The account still has its temporary password:
// go to the change-password screen (once). In both cases the promise is left pending on
// purpose so callers' catch blocks do not show their own error alerts on top; the page
// reloads anyway. Every other error, including the login request, is passed on
// unchanged.
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    if (url.includes("/api/auth/login")) return Promise.reject(error);

    const reason = sessionEndReason(error);
    if (reason) {
      endSession(reason);
      return new Promise(() => {});
    }
    if (isPasswordChangeRequiredError(error)) {
      requirePasswordChange();
      return new Promise(() => {});
    }
    return Promise.reject(error);
  },
);

export default API;
