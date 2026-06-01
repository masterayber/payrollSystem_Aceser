import { useEffect, useState, useRef, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import ProfilePhoto from "./ProfilePhoto/ProfilePhoto";
import { IconCircleArrowUp, IconCircleArrowDown } from "@tabler/icons-react";

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

  const fullName = `${userData?.employee?.firstName} ${userData?.employee?.lastName}`;

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
      name: "Reports",
      path: "/admin-reports",
    },
    {
      name: "Settings",
      path: "/admin-settings",
    },
  ];

  const menuTitles = role === "Admin" ? adminMenuTitles : userMenuTitles;

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
        <p>{userData?.employee?.firstName}</p>
        <div className="icon-count" onClick={toggleDropDown}>
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

export default Header;
