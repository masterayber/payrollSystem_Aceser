import axios from "axios";
import { endSession, isRoleChangedError } from "./utils/session";

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

// The account's role changed while it was signed in: end the session (alert once,
// back to "/"). The promise is left pending on purpose so callers' catch blocks do not
// show their own error alerts on top of the logout; the page reloads anyway. Every
// other error, including the login request, is passed on unchanged.
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    if (isRoleChangedError(error) && !url.includes("/api/auth/login")) {
      endSession("roleChanged");
      return new Promise(() => {});
    }
    return Promise.reject(error);
  },
);

export default API;
