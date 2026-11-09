import { useContext } from "react";
import PropTypes from "prop-types";
import { Navigate } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import { HOME_PAGE, homePath, pageRole } from "../utils/roles";
import { CHANGE_PASSWORD_PATH } from "../utils/session";

const INACTIVITY_LIMIT = 60 * 60 * 1000;

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

  // Still on a temporary password: nothing else opens until it is changed
  if (userData.mustChangePassword) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  // Super Admin uses the Admin pages, so routes only ever list "Admin"
  const role = pageRole(userData.role);

  // Signed in, but this route is for another role: go home, not to log in again
  if (!allowedRoles.includes(role)) {
    return <Navigate to={homePath(userData.role)} replace />;
  }

  // Per-user page access set by an admin. This only decides what the UI shows; the
  // server still has to enforce it on the API (see requirePage in accessMiddleware).
  const homePage = HOME_PAGE[role];
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
