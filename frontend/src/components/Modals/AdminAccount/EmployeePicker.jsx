import { useState } from "react";
import PropTypes from "prop-types";
import {
  chosenText,
  personName,
  pickerLabel,
  searchRows,
} from "../../../utils/adminAccounts";

// A searchable list of employees inside the Add and Edit Admin form. `multiple` ticks
// any number of people (the pay list); without it one person, or "None", is picked
// (the linked employee). There is no "select all" and no pick-by-department on purpose:
// each person on a pay list is ticked one by one.
const EmployeePicker = ({
  name,
  rows,
  selected,
  onChange,
  multiple = false,
  disabled = false,
}) => {
  const [query, setQuery] = useState("");

  const chosen = new Set(selected);
  const visible = searchRows(rows, query);

  const toggle = (id) => {
    if (!multiple) {
      onChange([id]);
      return;
    }
    onChange(
      chosen.has(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  };

  const chosenRow = multiple
    ? null
    : rows.find((row) => chosen.has(row.id)) || null;

  return (
    <div className="admin-picker">
      <div className="input-group-signup">
        <input
          type="search"
          placeholder="Search employees"
          aria-label="Search employees"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          // Enter in the search box must not send the form
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
        />
      </div>

      <div className="admin-picker-list access-list">
        {!multiple && (
          <label className="access-option">
            <input
              type="radio"
              className="modal-checkbox"
              name={name}
              checked={selected.length === 0}
              disabled={disabled}
              onChange={() => onChange([])}
            />
            <span>None</span>
          </label>
        )}

        {visible.map((row) => (
          <label className="access-option" key={row.id}>
            <input
              type={multiple ? "checkbox" : "radio"}
              className="modal-checkbox"
              name={multiple ? undefined : name}
              checked={chosen.has(row.id)}
              disabled={disabled}
              onChange={() => toggle(row.id)}
            />
            <span>{pickerLabel(row)}</span>
          </label>
        ))}

        {visible.length === 0 && (
          <p className="admin-picker-empty">No employees match.</p>
        )}
      </div>

      <p className="admin-picker-chosen" aria-live="polite">
        {multiple
          ? chosenText(selected, rows)
          : `Chosen: ${chosenRow ? personName(chosenRow) : "None"}`}
      </p>
    </div>
  );
};

EmployeePicker.propTypes = {
  name: PropTypes.string.isRequired,
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string,
      employeeId: PropTypes.string,
      department: PropTypes.string,
      resigned: PropTypes.bool,
    }),
  ).isRequired,
  selected: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  multiple: PropTypes.bool,
  disabled: PropTypes.bool,
};

export default EmployeePicker;
