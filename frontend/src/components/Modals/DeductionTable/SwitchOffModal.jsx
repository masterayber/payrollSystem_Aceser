import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import API from "../../../api";
import { refusalText } from "../../../utils/feedback";
import { KINDS } from "../../../utils/deductionTables";
import "../Modal.css";
import "../../../styles/AdminCSS/Deductions.css";

// The statutory deductions switched off for the company (Super Admin): a ticked kind is
// not deducted, needs no table and never stops payslips. Save sends the whole list
// (PUT /api/deductions/statutory-off); an empty list switches every kind back on.
// `initialOff` is the list of kinds off now; `onSaved` gets the server's message.
const SwitchOffModal = ({ initialOff, onClose, onSaved }) => {
  const [off, setOff] = useState(initialOff);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const open = useRef(true);

  useEffect(() => {
    open.current = true;
    document.documentElement.style.overflow = "hidden";
    return () => {
      open.current = false;
      document.documentElement.style.overflow = "";
    };
  }, []);

  const toggle = (key, ticked) =>
    setOff((prev) => {
      const others = prev.filter((one) => one !== key);
      return ticked ? [...others, key] : others;
    });

  const handleSave = async () => {
    if (saving) return;

    setSaving(true);
    setSaveError("");
    try {
      const kinds = KINDS.map((kind) => kind.key).filter((key) =>
        off.includes(key),
      );
      const { data } = await API.put("/api/deductions/statutory-off", {
        kinds,
      });
      if (!open.current) return;
      onSaved(data?.message || "Switched-off deductions saved.");
    } catch (error) {
      if (!open.current) return;
      setSaving(false);
      setSaveError(
        refusalText(error, "Could not save the switched-off deductions."),
      );
    }
  };

  return ReactDOM.createPortal(
    <div className="modal">
      <div
        className="modal-content deduction-small-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="switch-off-title"
      >
        <h3 id="switch-off-title">Switched-off Deductions</h3>
        <div className="message">
          <p>
            Tick a deduction the company does not take. It needs no table and
            never stops payslips from being issued.
          </p>
        </div>

        <div className="deduction-switch-list">
          {KINDS.map((kind) => (
            <label key={kind.key} className="deduction-switch-item">
              <input
                type="checkbox"
                className="modal-checkbox"
                checked={off.includes(kind.key)}
                disabled={saving}
                onChange={(event) => toggle(kind.key, event.target.checked)}
              />
              <span>{`${kind.label} is switched off`}</span>
            </label>
          ))}
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
          <button
            type="button"
            className="btn modal-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

SwitchOffModal.propTypes = {
  initialOff: PropTypes.arrayOf(PropTypes.string).isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default SwitchOffModal;
