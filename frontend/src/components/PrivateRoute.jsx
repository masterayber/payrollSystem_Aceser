import React, { useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { UserContext } from "../context/UserContext";

const PrivateRoute = ({ children }) => {
  const { userData } = useContext(UserContext);
  const token = localStorage.getItem("token");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, [userData]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!token || !userData) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PrivateRoute;
