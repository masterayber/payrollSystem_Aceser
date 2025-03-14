import React, { useState, useRef, useEffect } from "react";
import { IconCaretDownFilled } from "@tabler/icons-react";
import "./Dropdown.css";

const Dropdown = ({ category, placeholder = "Select an option", onSelect }) => {
  const [options, setOptions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetch(`http://localhost:5000/api/auth/dropdown/${category}`)
      .then((res) => res.json())
      .then((data) => setOptions(data))
      .catch((err) => console.error("Error fetching dropdown options:", err));
  }, [category]);

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

  const handleSelect = (option) => {
    setSelectedOption(option);
    setIsOpen(false);
    if (onSelect) onSelect(option);
  };

  return (
    <div className="dropdown-container" ref={dropdownRef}>
      <div
        className={`dropdown-button ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption || placeholder}</span>

        <IconCaretDownFilled
          key={isOpen}
          className={`dropdown-icon ${isOpen ? "open" : ""}`}
          width="20"
          height="20"
        />
      </div>

      {isOpen && (
        <ul className="dropdown-list">
          {options.map((option, index) => (
            <li
              key={index}
              className="dropdown-option"
              onClick={() => handleSelect(option)}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Dropdown;
