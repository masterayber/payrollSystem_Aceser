import React, { useState, useRef, useEffect } from "react";
import "./Dropdown.css";

const Dropdown = () => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="dropdown-container" ref={dropdownRef}>
      {/* Dropdown Button */}
      <div
        className={`dropdown-button ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedMonth || "Select A Month"}</span>

        {/* SVG Arrow */}
        <svg
          key={isOpen}
          className={`dropdown-icon ${isOpen ? "open" : ""}`}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6 9L12 15L18 9"
            stroke="black"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Dropdown List */}
      {isOpen && (
        <ul className="dropdown-list">
          {months.map((month, index) => (
            <li
              key={index}
              className="dropdown-month"
              onClick={() => {
                setSelectedMonth(month);
                setIsOpen(false);
              }}
            >
              {month}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Dropdown;
