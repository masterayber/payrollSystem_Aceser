import { useState, useRef, useEffect } from "react";
import { IconCaretDownFilled } from "@tabler/icons-react";
import "./Dropdown.css";
import PropTypes from "prop-types";

const Dropdown = ({
  options = [],
  placeholder = "Select an Option",
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState("");
  const dropdownRef = useRef(null);

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

  const displayOptions = options[0] === "" ? options : ["", ...options];

  return (
    <div className="dropdown-container" ref={dropdownRef}>
      <div
        className={`dropdown-button ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>
          {selectedOption === "" || selectedOption === "--Select Gender--"
            ? placeholder
            : selectedOption}
        </span>
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
              className={`dropdown-option${
                option === "" || option.startsWith("--Select")
                  ? " dropdown-placeholder"
                  : ""
              }`}
              onClick={() => handleSelect(option)}
              style={{
                color:
                  option === "" || option.startsWith("--Select")
                    ? "#aaa"
                    : undefined,
                fontStyle:
                  option === "" || option.startsWith("--Select")
                    ? "italic"
                    : undefined,
              }}
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

Dropdown.propTypes = {
  options: PropTypes.array,
  placeholder: PropTypes.string,
  onSelect: PropTypes.func,
};
