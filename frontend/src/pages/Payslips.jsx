import React, { useEffect, useState } from "react";
import "../styles/Payslips.css";

const Payslips = () => {
  const [showLastPayment, setShowLastPayment] = useState(false);
  const [userData, setUserData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
  });

  useEffect(() => {
    const storedUser = localStorage.getItem("userData");
    if (storedUser) {
      setUserData(JSON.parse(storedUser));
    }
  }, []);
};

export default Payslips;
