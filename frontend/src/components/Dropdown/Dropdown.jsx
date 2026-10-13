import { useState, useRef, useEffect } from "react";
import { IconCaretDownFilled } from "@tabler/icons-react";
import "./Dropdown.css";
import PropTypes from "prop-types";

const Dropdown = ({ options = [], placeholder, value = "", onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const getOptionValue = (option) =>
    typeof option === "string" ? option : option.value;
  const getOptionLabel = (option) =>
    typeof option === "string" ? option : option.label;
  const selectedOption = options.find(
    (option) => getOptionValue(option) === value,
  );

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
    setIsOpen(false);
    if (onSelect) onSelect(getOptionValue(option));
  };

  return (
    <div className="dropdown-container" ref={dropdownRef}>
      <div
        className={`dropdown-button ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>
          {selectedOption
            ? getOptionLabel(selectedOption)
            : value === "" || value.startsWith("--Select")
              ? placeholder
              : value}
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
          {options.map((option) => (
            <li
              key={getOptionValue(option)}
              className={`dropdown-option${
                typeof option === "string" &&
                (option === "" || option.startsWith("--Select"))
                  ? " dropdown-placeholder"
                  : ""
              }`}
              onClick={() => handleSelect(option)}
              style={{
                color:
                  typeof option === "string" &&
                  (option === "" || option.startsWith("--Select"))
                    ? "#aaa"
                    : undefined,
                fontStyle:
                  typeof option === "string" &&
                  (option === "" || option.startsWith("--Select"))
                    ? "italic"
                    : undefined,
              }}
            >
              {getOptionLabel(option)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Dropdown;

Dropdown.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.string.isRequired,
      }),
    ]),
  ),
  placeholder: PropTypes.string,
  onSelect: PropTypes.func,
  value: PropTypes.string,
};
