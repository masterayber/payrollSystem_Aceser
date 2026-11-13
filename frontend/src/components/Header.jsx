import { useEffect, useState, useRef, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import ProfilePhoto from "./ProfilePhoto/ProfilePhoto";
import { IconCircleArrowUp, IconCircleArrowDown } from "@tabler/icons-react";
import PropTypes from "prop-types";
import { isAdminRole } from "../utils/roles";
import { accountFirstName, accountName } from "../utils/adminAccounts";
import { endSession } from "../utils/session";

const logisticsTitles = [
  { name: "Logistics Dashboard", path: "/logistics/dashboard" },
  { name: "Material Requests", path: "/logistics/material-requests" },
  { name: "MR Approvals", path: "/logistics/mr-approvals" },
  { name: "Procurement Queue", path: "/logistics/procurement" },
  { name: "Purchase Orders", path: "/logistics/purchase-orders" },
  { name: "PO Approvals", path: "/logistics/po-approvals" },
  { name: "Accounting", path: "/logistics/accounting" },
  { name: "Deliveries", path: "/logistics/deliveries" },
  { name: "Project Inventory", path: "/logistics/inventory" },
  { name: "Withdrawals and Transfers", path: "/logistics/movements" },
  { name: "Logistics Setup", path: "/logistics/setup" },
];

function Header({ role }) {
  const navigate = useNavigate();
  const location = useLocation();

  const { userData } = useContext(UserContext);
  const [showDropDown, setShowDropDown] = useState(false);
  const dropdownRef = useRef(null);
  const toggleRef = useRef(null);

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

  // Escape closes the open menu and puts the focus back on its button
  useEffect(() => {
    if (!showDropDown) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowDropDown(false);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showDropDown]);

  // The one sign-out path (utils/session.js): clears the token, userData and
  // lastActivity, then goes to the sign-in page
  const handleLogout = () => endSession();

  // The employee's name, then the account's own name (an Admin account has no employee
  // record), then the username
  const fullName = accountName(userData);

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
      name: "Filing",
      path: "/admin-filing",
    },
    {
      name: "Reports",
      path: "/reports",
    },
    {
      name: "Settings",
      path: "/admin-settings",
    },
  ];

  const menuTitles = [
    ...(isAdminRole(role) ? adminMenuTitles : userMenuTitles),
    ...logisticsTitles,
    ...(location.pathname.startsWith("/employees/")
      ? [{ name: "Employee Profile", path: location.pathname }]
      : []),
  ];

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
        <p>{accountFirstName(userData)}</p>
        <div className="icon-count">
          <button
            type="button"
            className="profile-menu-toggle"
            ref={toggleRef}
            onClick={toggleDropDown}
            aria-expanded={showDropDown}
            aria-haspopup="true"
            aria-label="Open profile menu"
          >
            <ProfilePhoto size="50px" />
            <div className="dropdown-arrow">
              {showDropDown ? (
                <IconCircleArrowUp
                  stroke={2}
                  fill="#ffffff"
                  width={20}
                  height={20}
                />
              ) : (
                <IconCircleArrowDown
                  stroke={2}
                  fill="#ffffff"
                  width={20}
                  height={20}
                />
              )}
            </div>
          </button>
          {showDropDown && (
            <div className="dropdown-overlay" ref={dropdownRef}>
              <p>{fullName}</p>
              <div className="dropdown-options">
                <button className="dropdown-item">Profile</button>
                <button className="dropdown-item">Settings</button>
                <button className="dropdown-item">About</button>
              </div>
              <button className="btn" onClick={handleLogout}>
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

Header.propTypes = {
  role: PropTypes.string,
};

export default Header;
