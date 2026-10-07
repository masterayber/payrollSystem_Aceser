import PropTypes from "prop-types";
import { useNavigate, useLocation } from "react-router-dom";
import {
  IconLayoutDashboard,
  IconUserSquare,
  IconFileMinus,
  IconCashBanknote,
  IconMoneybag,
  IconCalendarPlus,
  IconCalendarMonth,
  IconFiles,
  IconGraph,
  IconSettings,
} from "@tabler/icons-react";

function Sidebar({ role, allowedPages }) {
  const navigate = useNavigate();
  const location = useLocation();

  const userMenuItems = [
    {
      name: "Dashboard",
      key: "dashboard",
      path: "/dashboard",
      icon: <IconLayoutDashboard stroke={1.75} />,
    },
    {
      name: "Payroll",
      key: "payroll",
      path: "/payroll",
      icon: <IconMoneybag stroke={1.75} />,
    },
    {
      name: "Pay Slips",
      key: "payslips",
      path: "/payslips",
      icon: <IconCashBanknote stroke={1.75} />,
    },
    {
      name: "Attendance",
      key: "attendance",
      path: "/attendance",
      icon: <IconCalendarPlus stroke={1.75} />,
    },
    {
      name: "Calendar",
      key: "calendar",
      path: "/calendar",
      icon: <IconCalendarMonth stroke={1.75} />,
    },
    {
      name: "Filing",
      key: "filing",
      path: "/filing",
      icon: <IconFiles stroke={1.75} />,
    },
    {
      name: "Settings",
      key: "settings",
      path: "/settings",
      icon: <IconSettings stroke={1.75} />,
    },
  ];

  const adminMenuItems = [
    {
      name: "Dashboard",
      key: "admin-dashboard",
      path: "/admin-dashboard",
      icon: <IconLayoutDashboard stroke={1.75} />,
    },
    {
      name: "Employees",
      key: "employees",
      path: "/employees",
      icon: <IconUserSquare stroke={1.75} />,
    },
    {
      name: "Deductions",
      key: "deductions",
      path: "/deductions",
      icon: <IconFileMinus stroke={1.75} />,
    },
    {
      name: "Pay Slips",
      key: "admin-payslips",
      path: "/admin-payslips",
      icon: <IconCashBanknote stroke={1.75} />,
    },
    {
      name: "Attendance",
      key: "admin-attendance",
      path: "/admin-attendance",
      icon: <IconCalendarPlus stroke={1.75} />,
    },
    {
      name: "Calendar",
      key: "admin-calendar",
      path: "/admin-calendar",
      icon: <IconCalendarMonth stroke={1.75} />,
    },
    {
      name: "Filing",
      key: "admin-filing",
      path: "/admin-filing",
      icon: <IconFiles stroke={1.75} />,
    },
    {
      name: "Reports",
      key: "reports",
      path: "/reports",
      icon: <IconGraph stroke={1.75} />,
    },
    {
      name: "Settings",
      key: "admin-settings",
      path: "/admin-settings",
      icon: <IconSettings stroke={1.75} />,
    },
  ];

  const roleMenuItems = role === "Admin" ? adminMenuItems : userMenuItems;

  // allowedPages comes from the server. Until it has loaded, show the role's menu.
  const menuItems = Array.isArray(allowedPages)
    ? roleMenuItems.filter((item) => allowedPages.includes(item.key))
    : roleMenuItems;

  return (
    <div className="sidebar">
      <div className="company-container">
        <div className="aceser-logo-container">
          <img
            src="/assets/aceser-logo.png"
            alt="Company Logo"
            className="logo"
          />
        </div>
        <p>ACESER</p>
      </div>

      <nav className="sidebar-menu">
        {menuItems.map((item) => (
          <div
            key={item.key}
            className={`sidebar-item ${
              location.pathname === item.path ? "active" : ""
            }`}
            onClick={() => navigate(item.path)}
          >
            {item.icon}
            <p>{item.name}</p>
          </div>
        ))}
      </nav>
    </div>
  );
}

Sidebar.propTypes = {
  role: PropTypes.string,
  allowedPages: PropTypes.arrayOf(PropTypes.string),
};

export default Sidebar;
