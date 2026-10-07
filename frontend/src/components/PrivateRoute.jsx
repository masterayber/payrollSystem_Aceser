import React, { useContext } from "react";
import PropTypes from "prop-types";
import { Navigate } from "react-router-dom";
import { UserContext } from "../context/UserContext";

const INACTIVITY_LIMIT = 60 * 60 * 1000;

// Landing page for each role. Locked server-side, so it is always reachable.
const HOME_PAGE = { Admin: "admin-dashboard", Employee: "dashboard" };

const PrivateRoute = ({ children, allowedRoles, pageKey }) => {
  const { userData, clearSession, loading } = useContext(UserContext);
  const token = localStorage.getItem("token");
  const lastActivity = Number(localStorage.getItem("lastActivity"));

  if (loading) {
    return <div>Loading...</div>;
  }

  if (token && lastActivity && Date.now() - lastActivity > INACTIVITY_LIMIT) {
    if (typeof clearSession === "function") {
      clearSession("inactive");
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("userData");
      localStorage.removeItem("lastActivity");
      window.alert("session ended due to inactivity.");
    }
    return <Navigate to="/" replace />;
  }

  if (!token || !userData) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(userData.role)) {
    return <Navigate to="/" replace />;
  }

  // Per-user page access set by an admin. This only decides what the UI shows; the
  // server still has to enforce it on the API (see requirePage in accessMiddleware).
  const homePage = HOME_PAGE[userData.role];
  if (
    pageKey &&
    pageKey !== homePage &&
    Array.isArray(userData.allowedPages) &&
    !userData.allowedPages.includes(pageKey)
  ) {
    return <Navigate to={`/${homePage}`} replace />;
  }

  return children;
};

PrivateRoute.propTypes = {
  children: PropTypes.node,
  allowedRoles: PropTypes.arrayOf(PropTypes.string).isRequired,
  pageKey: PropTypes.string,
};

export default PrivateRoute;
