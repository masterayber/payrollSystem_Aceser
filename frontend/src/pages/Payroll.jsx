import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Payroll.css";

const Payroll = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userData");
    navigate("/");
  };

  return <></>;
};

export default Payroll;
