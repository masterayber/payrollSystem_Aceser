import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { UserContext } from "../context/UserContext";

const INACTIVITY_LIMIT = 60 * 60 * 1000;

const PrivateRoute = ({ children, allowedRoles }) => {
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

  return children;
};

export default PrivateRoute;
