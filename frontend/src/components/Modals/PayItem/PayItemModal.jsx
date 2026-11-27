import { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import API from "../../../api";
import { refusalText } from "../../../utils/feedback";
import {
  KIND_OPTIONS,
  MAX_LABEL_LENGTH,
  MAX_NOTE_LENGTH,
  REPEAT_OPTIONS,
  SCHEDULE_OPTIONS,
  changeKind,
  checkItemForm,
  emptyItemForm,
  formFromItem,
  itemBody,
  itemChanges,
  kindLabel,
  repeatLabel,
  savedText,
  startCutoffOptions,
  typesFor,
} from "../../../utils/payItems";
import "../Modal.css";
import "../../../styles/AdminCSS/Deductions.css";

// Add or edit one pay item (an earning or a deduction) of one employee. `item` is the
// item being edited, or null for a new one. A new item sends every field
// (POST /api/deductions/items); an edit sends only what can change after it is saved:
// label, note, amount, schedule and, for instalments, the total
// (PATCH /api/deductions/items/:id). The form is checked first with the server's own
// words; a refusal from the server is shown here as it is, with every box kept.
// `onSaved` gets the server's message.
const PayItemModal = ({ employee, item, onClose, onSaved }) => {
  const isEdit = Boolean(item);
  const [form, setForm] = useState(() =>
    isEdit ? formFromItem(item) : emptyItemForm(),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const open = useRef(true);

  useEffect(() => {
    open.current = true;
    const before = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      open.current = false;
      document.documentElement.style.overflow = before;
    };
  }, []);

  const cutoffOptions = useMemo(
    () => startCutoffOptions({ keep: isEdit ? item.startCutoff : "" }),
    [isEdit, item],
  );

  const change = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) return;

    const problem = checkItemForm(form);
    if (problem) {
      setSaveError(problem);
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const { data } = isEdit
        ? await API.patch(`/api/deductions/items/${item.id}`, itemChanges(form))
        : await API.post("/api/deductions/items", itemBody(form, employee.userId));
      if (!open.current) return;
      onSaved(data?.message || savedText(form.kind, isEdit));
    } catch (error) {
      if (!open.current) return;
      setSaving(false);
      setSaveError(refusalText(error, "Could not save the pay item."));
    }
  };

  const isEarning = form.kind === "earning";
  const instalments = form.repeat === "instalments";
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ");
  const title = isEdit
    ? `Edit ${kindLabel(form.kind)}`
    : "Add Pay Item";

  return ReactDOM.createPortal(
    <div className="modal">
      <form
        className="modal-content pay-item-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-item-title"
        onSubmit={handleSave}
        noValidate
      >
        <h3 id="pay-item-title">{title}</h3>
        <p className="deduction-modal-note">
          {isEdit
            ? `For ${name}. The kind, type, repeat and start can't be changed once saved; stop this item and add a new one instead.`
            : `For ${name}. It is taken from or added to each payslip it lands on.`}
        </p>

        <div className="deduction-table-fields">
          <label className="deduction-field">
            <span>Kind</span>
            <select
              value={form.kind}
              disabled={saving || isEdit}
              onChange={(event) =>
                setForm((prev) => changeKind(prev, event.target.value))
              }
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="deduction-field">
            <span>Type</span>
            <select
              value={form.type}
              disabled={saving || isEdit}
              onChange={(event) => change("type", event.target.value)}
            >
              <option value="">Select type</option>
              {typesFor(form.kind).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="deduction-field">
            <span>Label (optional)</span>
            <input
              type="text"
              placeholder="Shown on the payslip"
              maxLength={MAX_LABEL_LENGTH}
              value={form.label}
              disabled={saving}
              onChange={(event) => change("label", event.target.value)}
            />
          </label>

          <label className="deduction-field">
            <span>Amount per cut-off (₱)</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={form.amountPerCutoff}
              disabled={saving}
              onChange={(event) => change("amountPerCutoff", event.target.value)}
            />
          </label>

          <label className="deduction-field">
            <span>Repeat</span>
            {isEdit ? (
              <input type="text" value={repeatLabel(form.repeat)} disabled />
            ) : (
              <select
                value={form.repeat}
                disabled={saving}
                onChange={(event) => change("repeat", event.target.value)}
              >
                {REPEAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </label>

          {instalments && (
            <label className="deduction-field">
              <span>Total to be paid (₱)</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={form.total}
                disabled={saving}
                onChange={(event) => change("total", event.target.value)}
              />
            </label>
          )}

          <label className="deduction-field">
            <span>Taken on</span>
            <select
              value={form.schedule}
              disabled={saving}
              onChange={(event) => change("schedule", event.target.value)}
            >
              {SCHEDULE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="deduction-field">
            <span>Starts on</span>
            <select
              value={form.startCutoff}
              disabled={saving || isEdit}
              onChange={(event) => change("startCutoff", event.target.value)}
            >
              {form.startCutoff === "" && (
                <option value="">Select cut-off</option>
              )}
              {cutoffOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="deduction-field deduction-field-wide">
            <span>Note (optional)</span>
            <input
              type="text"
              placeholder="Shown on the payslip"
              maxLength={MAX_NOTE_LENGTH}
              value={form.note}
              disabled={saving}
              onChange={(event) => change("note", event.target.value)}
            />
          </label>

          {isEarning && (
            <label className="deduction-switch-item deduction-field-wide">
              <input
                type="checkbox"
                checked={form.taxable}
                disabled={saving || isEdit}
                onChange={(event) => change("taxable", event.target.checked)}
              />
              <span>Taxable (counted in withholding tax)</span>
            </label>
          )}
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
            {saving ? "Saving..." : isEdit ? "Save changes" : "Save item"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
};

PayItemModal.propTypes = {
  employee: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
  }).isRequired,
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    kind: PropTypes.string,
    startCutoff: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default PayItemModal;
