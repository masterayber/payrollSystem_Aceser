import React, { useEffect, useState, useRef, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import ProfilePhoto from "./ProfilePhoto/ProfilePhoto";

function Header({ role }) {
  const navigate = useNavigate();
  const location = useLocation();

  const { userData } = useContext(UserContext);
  const [showDropDown, setShowDropDown] = useState(false);
  const dropdownRef = useRef(null);

  const toggleDropDown = (event) => {
    event.stopPropagation();
    setShowDropDown((prev) => !prev);
  };

  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setShowDropDown(false);
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userData");
    window.location.href = "/";
  };

  const fullName = `${userData?.firstName} ${userData?.lastName}`;

  const userMenuTitles = [
    {
      name: "Dashboard",
      path: "/dashboard",
    },
    {
      name: "Payroll",
      path: "/payroll",
    },
    {
      name: "Pay Slips",
      path: "/payslips",
    },
    {
      name: "Attendance",
      path: "/attendance",
    },
    {
      name: "Calendar",
      path: "/calendar",
    },
    {
      name: "Filing",
      path: "/filing",
    },
    {
      name: "Settings",
      path: "/settings",
    },
  ];

  const adminMenuTitles = [
    {
      name: "Dashboard",
      path: "/admin-dashboard",
    },
    {
      name: "Employees",
      path: "/employees",
    },
    {
      name: "Deductions",
      path: "/deductions",
    },
    {
      name: "Pay Slips",
      path: "/admin-payslips",
    },
    {
      name: "Attendance",
      path: "/admin-attendance",
    },
    {
      name: "Calendar",
      path: "/admin-calendar",
    },
    {
      name: "Reports",
      path: "/reports",
    },
    {
      name: "Reports",
      path: "/admin-reports",
    },
    {
      name: "Settings",
      path: "/admin-settings",
    },
  ];

  const menuTitles = role === "admin" ? adminMenuTitles : userMenuTitles;

  return (
    <header className="header">
      {menuTitles
        .filter((item) => location.pathname === item.path)
        .map((item, index) => (
          <div
            key={index}
            className={`header-title ${
              location.pathname === item.path ? "active" : ""
            }`}
            onClick={() => navigate(item.path)}
          >
            <h3>{item.name}</h3>
          </div>
        ))}
      <div className="user-header">
        <p>{userData?.firstName}</p>
        <div className="icon-count" onClick={toggleDropDown}>
          <ProfilePhoto user={userData} />
          <div className="dropdown-arrow">
            {showDropDown ? (
              <svg
                width="20px"
                height="20px"
                viewBox="0 0 24 24"
                fill="#ffffff"
                xmlns="http://www.w3.org/2000/svg"
                transform="matrix(1, 0, 0, -1, 0, 0)"
              >
                <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                <g
                  id="SVGRepo_tracerCarrier"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                ></g>
                <g id="SVGRepo_iconCarrier">
                  {" "}
                  <path
                    d="M16 13L12 9L8 13M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"
                    stroke="#000000"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>{" "}
                </g>
              </svg>
            ) : (
              <svg
                width="20px"
                height="20px"
                viewBox="0 0 24 24"
                fill="#ffffff"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                <g
                  id="SVGRepo_tracerCarrier"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                ></g>
                <g id="SVGRepo_iconCarrier">
                  {" "}
                  <path
                    d="M16 13L12 9L8 13M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"
                    stroke="#000000"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>{" "}
                </g>
              </svg>
            )}
          </div>
          {showDropDown && (
            <div className="dropdown-overlay" ref={dropdownRef}>
              <p>{fullName}</p>
              <button className="dropdown-item">Profile</button>
              <button className="dropdown-item">Settings</button>
              <button className="dropdown-item">About</button>
              <button className="dropdown-item-logout" onClick={handleLogout}>
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
