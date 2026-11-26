import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import { IconTrash } from "@tabler/icons-react";
import API from "../../../api";
import { refusalText } from "../../../utils/feedback";
import {
  BASE_OPTIONS,
  DEDUCT_ON_OPTIONS,
  KINDS,
  addRow,
  removeRow,
  tableBody,
} from "../../../utils/deductionTables";
import "../Modal.css";
import "../../../styles/AdminCSS/Deductions.css";

// The figure boxes of a row, in the order the server lists them
const ROW_BOXES = [
  { field: "over", label: "Over (₱)" },
  { field: "upTo", label: "Up to (₱)" },
  { field: "employeeFixed", label: "Employee fixed (₱)" },
  { field: "employeeRate", label: "Employee rate (%)" },
  { field: "employerFixed", label: "Employer fixed (₱)" },
  { field: "employerRate", label: "Employer rate (%)" },
  { field: "excessOver", label: "Excess over (₱)" },
];

// Add or edit one version of a statutory table (Super Admin). `table` is the Draft being
// edited, or null for a new one; `initialForm` is what the boxes start with. Save sends
// what was typed (POST or PUT /api/deductions/tables); the server checks everything and
// a refusal is shown here as it is, with every box kept. `onSaved` gets the server's
// message after a save went through.
const DeductionTableModal = ({ table, initialForm, onClose, onSaved }) => {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // False once the modal is gone, so a late reply changes nothing
  const open = useRef(true);
  const isEdit = Boolean(table);

  useEffect(() => {
    open.current = true;
    document.documentElement.style.overflow = "hidden";
    return () => {
      open.current = false;
      document.documentElement.style.overflow = "";
    };
  }, []);

  const change = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const changeRow = (index, field, value) =>
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.map((row, at) =>
        at === index ? { ...row, [field]: value } : row,
      ),
    }));

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setSaveError("");
    try {
      const body = tableBody(form);
      const { data } = isEdit
        ? await API.put(`/api/deductions/tables/${table.id}`, body)
        : await API.post("/api/deductions/tables", body);
      if (!open.current) return;
      onSaved(
        data?.message || (isEdit ? "Draft updated." : "Table saved as a draft."),
      );
    } catch (error) {
      if (!open.current) return;
      setSaving(false);
      setSaveError(refusalText(error, "Could not save the table."));
    }
  };

  const title = isEdit ? "Edit Draft Table" : "Add Deduction Table";

  return ReactDOM.createPortal(
    <div className="modal">
      <form
        className="modal-content deduction-table-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deduction-table-title"
        onSubmit={handleSave}
        noValidate
      >
        <h3 id="deduction-table-title">{title}</h3>
        <p className="deduction-modal-note">
          Copy every figure from the official issuance. It is saved as a draft
          and is not used for pay until it is confirmed.
        </p>

        <div className="deduction-table-fields">
          <label className="deduction-field">
            <span>Deduction</span>
            <select
              value={form.kind}
              disabled={saving}
              onChange={(event) => change("kind", event.target.value)}
            >
              {form.kind === "" && <option value="">Select Deduction</option>}
              {KINDS.map((kind) => (
                <option key={kind.key} value={kind.key}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>

          <label className="deduction-field">
            <span>Takes effect on</span>
            <input
              type="date"
              value={form.effectiveFrom}
              disabled={saving}
              onChange={(event) => change("effectiveFrom", event.target.value)}
            />
          </label>

          <label className="deduction-field deduction-field-wide">
            <span>Source (official issuance)</span>
            <input
              type="text"
              placeholder="e.g. Circular No. and its date"
              value={form.source}
              disabled={saving}
              onChange={(event) => change("source", event.target.value)}
            />
          </label>

          <label className="deduction-field">
            <span>Read against</span>
            <select
              value={form.base}
              disabled={saving}
              onChange={(event) => change("base", event.target.value)}
            >
              {BASE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="deduction-field">
            <span>Taken on</span>
            <select
              value={form.deductOn}
              disabled={saving}
              onChange={(event) => change("deductOn", event.target.value)}
            >
              {DEDUCT_ON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="deduction-modal-note">
          Each row covers amounts over its &quot;Over&quot; and up to its
          &quot;Up to&quot;. Row 1 starts at 0, each row starts where the one
          before it ends, and the last row&apos;s &quot;Up to&quot; stays empty.
          A share is its fixed amount plus its rate of the amount over
          &quot;Excess over&quot;. Leave a box empty for 0.
        </p>

        <div className="deduction-rows-wrap">
          <table className="deduction-rows-table">
            <thead>
              <tr>
                <th className="deduction-row-number">Row</th>
                {ROW_BOXES.map((box) => (
                  <th key={box.field}>{box.label}</th>
                ))}
                <th className="deduction-row-remove" aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, index) => (
                <tr key={index}>
                  <td className="deduction-row-number">{index + 1}</td>
                  {ROW_BOXES.map((box) => (
                    <td key={box.field}>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Row ${index + 1}: ${box.label}`}
                        value={row[box.field]}
                        disabled={saving}
                        onChange={(event) =>
                          changeRow(index, box.field, event.target.value)
                        }
                      />
                    </td>
                  ))}
                  <td className="deduction-row-remove">
                    <button
                      type="button"
                      className="deduction-icon-button"
                      aria-label={`Remove row ${index + 1}`}
                      title="Remove row"
                      disabled={saving || form.rows.length === 1}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          rows: removeRow(prev.rows, index),
                        }))
                      }
                    >
                      <IconTrash stroke={2} size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="deduction-rows-actions">
          <button
            type="button"
            className="deduction-link-button"
            disabled={saving}
            onClick={() =>
              setForm((prev) => ({ ...prev, rows: addRow(prev.rows) }))
            }
          >
            Add row
          </button>
        </div>

        {saveError && (
          <p className="feedback-message error" role="alert">
            {saveError}
          </p>
        )}

        <div className="modal-buttons">
          <button
            type="button"
            className="btn modal-button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className="btn modal-button" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save draft" : "Save as draft"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
};

DeductionTableModal.propTypes = {
  table: PropTypes.shape({ id: PropTypes.string.isRequired }),
  initialForm: PropTypes.shape({
    kind: PropTypes.string,
    effectiveFrom: PropTypes.string,
    source: PropTypes.string,
    base: PropTypes.string,
    deductOn: PropTypes.string,
    rows: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default DeductionTableModal;
