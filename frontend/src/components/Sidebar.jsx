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

function Sidebar({ role }) {
  const navigate = useNavigate();
  const location = useLocation();

  const userMenuItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <IconLayoutDashboard stroke={1.75} />,
    },
    {
      name: "Payroll",
      path: "/payroll",
      icon: <IconMoneybag stroke={1.75} />,
    },
    {
      name: "Pay Slips",
      path: "/payslips",
      icon: <IconCashBanknote stroke={1.75} />,
    },
    {
      name: "Attendance",
      path: "/attendance",
      icon: <IconCalendarPlus stroke={1.75} />,
    },
    {
      name: "Calendar",
      path: "/calendar",
      icon: <IconCalendarMonth stroke={1.75} />,
    },
    {
      name: "Filing",
      path: "/filing",
      icon: <IconFiles stroke={1.75} />,
    },
    {
      name: "Settings",
      path: "/settings",
      icon: <IconSettings stroke={1.75} />,
    },
  ];

  const adminMenuItems = [
    {
      name: "Dashboard",
      path: "/admin-dashboard",
      icon: <IconLayoutDashboard stroke={1.75} />,
    },
    {
      name: "Employees",
      path: "/employees",
      icon: <IconUserSquare stroke={1.75} />,
    },
    {
      name: "Deductions",
      path: "/deductions",
      icon: <IconFileMinus stroke={1.75} />,
    },
    {
      name: "Pay Slips",
      path: "/admin-payslips",
      icon: <IconCashBanknote stroke={1.75} />,
    },
    {
      name: "Attendance",
      path: "/admin-attendance",
      icon: <IconCalendarPlus stroke={1.75} />,
    },
    {
      name: "Calendar",
      path: "/admin-calendar",
      icon: <IconCalendarMonth stroke={1.75} />,
    },
    {
      name: "Reports",
      path: "/reports",
      icon: <IconGraph stroke={1.75} />,
    },
    {
      name: "Settings",
      path: "/admin-settings",
      icon: <IconSettings stroke={1.75} />,
    },
  ];

  const menuItems = role === "admin" ? adminMenuItems : userMenuItems;

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
        {menuItems.map((item, index) => (
          <div
            key={index}
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

export default Sidebar;
