import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import PropTypes from "prop-types";
import API from "../api";
import { UserContext } from "./UserContext";

export const LogisticsContext = createContext();

// The signed-in user's logistics context from GET /api/logistics/me:
// { userId, isAdmin, position, department, roles, siteRole, projects }.
// `roles` = head-office roles plus the site role; `projects` carry the
// person's role on each (null for Admin and head-office roles without a seat).
export const LogisticsProvider = ({ children }) => {
  const { userData, loading: userLoading } = useContext(UserContext);
  const [logistics, setLogistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const userId = userData?._id;

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await API.get("/api/logistics/me", { signal });
      setLogistics(data);
    } catch (err) {
      if (signal?.aborted) return;
      setLogistics(null);
      setError(
        err.response?.data?.message || "Could not load your logistics access.",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  // Nothing on public pages: load once per signed-in user
  useEffect(() => {
    if (userLoading) return undefined;
    if (!userId) {
      setLogistics(null);
      setError("");
      return undefined;
    }

    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [userLoading, userId, load]);

  const reload = useCallback(() => load(), [load]);

  const isAdmin = Boolean(logistics?.isAdmin);
  const hasRole = useCallback(
    (roleName) => isAdmin || Boolean(logistics?.roles?.includes(roleName)),
    [isAdmin, logistics?.roles],
  );

  return (
    <LogisticsContext.Provider
      value={{ logistics, loading, error, reload, isAdmin, hasRole }}
    >
      {children}
    </LogisticsContext.Provider>
  );
};

LogisticsProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useLogistics = () => useContext(LogisticsContext);
