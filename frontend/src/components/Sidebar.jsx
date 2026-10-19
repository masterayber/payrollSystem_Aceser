import { Fragment, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate, useLocation } from "react-router-dom";
import {
  IconLayoutDashboard,
  IconUserSquare,
  IconFileMinus,
  IconCashBanknote,
  IconMoneybag,
  IconTruck,
  IconClipboardList,
  IconBuildingWarehouse,
  IconTruckDelivery,
  IconChevronRight,
  IconCalendarPlus,
  IconCalendarMonth,
  IconFiles,
  IconGraph,
  IconSettings,
} from "@tabler/icons-react";

const logisticsGroup = {
  name: "Logistics",
  key: "logistics",
  icon: <IconTruck stroke={1.75} />,
  children: [
    {
      name: "Dashboard",
      key: "logistics-dashboard",
      path: "/logistics/dashboard",
      icon: <IconLayoutDashboard stroke={1.75} />,
    },
    {
      name: "Material Request",
      key: "logistics-material-request",
      path: "/logistics/material-request",
      icon: <IconClipboardList stroke={1.75} />,
    },
    {
      name: "Inventory per Project",
      key: "logistics-inventory",
      path: "/logistics/inventory",
      icon: <IconBuildingWarehouse stroke={1.75} />,
    },
    {
      name: "Deliveries",
      key: "logistics-deliveries",
      path: "/logistics/deliveries",
      icon: <IconTruckDelivery stroke={1.75} />,
    },
  ],
};

function Sidebar({ role, allowedPages }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [openGroups, setOpenGroups] = useState({});

  const renderLink = (item, className = "sidebar-item") => {
    const isActive = location.pathname === item.path;
    return (
      <button
        type="button"
        key={item.key}
        className={`${className} ${isActive ? "active" : ""}`}
        aria-current={isActive ? "page" : undefined}
        onClick={() => navigate(item.path)}
      >
        {item.icon}
        <span>{item.name}</span>
      </button>
    );
  };

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
    logisticsGroup,
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
        {menuItems.map((item) => {
          if (!item.children) return renderLink(item);

          // A group starts open while one of its pages is showing
          const hasActive = item.children.some(
            (child) => location.pathname === child.path,
          );
          const isOpen = openGroups[item.key] ?? hasActive;

          return (
            <Fragment key={item.key}>
              <button
                type="button"
                className={`sidebar-item sidebar-group ${
                  hasActive ? "has-active" : ""
                }`}
                aria-expanded={isOpen}
                onClick={() =>
                  setOpenGroups((prev) => ({ ...prev, [item.key]: !isOpen }))
                }
              >
                {item.icon}
                <span>{item.name}</span>
                <IconChevronRight
                  className={`sidebar-chevron ${isOpen ? "open" : ""}`}
                  stroke={1.75}
                />
              </button>
              {/* Always rendered so it can animate; CSS collapses it when closed */}
              <div className={`sidebar-submenu ${isOpen ? "open" : ""}`}>
                <div className="sidebar-submenu-inner">
                  {item.children.map((child) =>
                    renderLink(child, "sidebar-item sidebar-subitem"),
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </nav>
    </div>
  );
}

Sidebar.propTypes = {
  role: PropTypes.string,
  allowedPages: PropTypes.arrayOf(PropTypes.string),
};

export default Sidebar;
