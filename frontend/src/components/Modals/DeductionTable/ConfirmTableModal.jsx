import { useEffect, useId, useRef, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import API from "../../../api";
import { refusalText } from "../../../utils/feedback";
import { versionName } from "../../../utils/deductionTables";
import "../Modal.css";
import "../../../styles/AdminCSS/Deductions.css";

// Confirms a Draft table (Super Admin), with the name of the HR or Accounting person who
// checked it against the official table (POST /api/deductions/tables/:id/confirm). The
// name is sent as typed; the server checks it and a refusal is shown here as it is.
// `onConfirmed` gets the server's message after the table was confirmed.
const ConfirmTableModal = ({ table, onClose, onConfirmed }) => {
  const [checkedWith, setCheckedWith] = useState("");
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

  const handleConfirm = async (event) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setSaveError("");
    try {
      const { data } = await API.post(
        `/api/deductions/tables/${table.id}/confirm`,
        { checkedWith },
      );
      if (!open.current) return;
      onConfirmed(data?.message || "Table confirmed.");
    } catch (error) {
      if (!open.current) return;
      setSaving(false);
      setSaveError(refusalText(error, "Could not confirm the table."));
    }
  };

  return ReactDOM.createPortal(
    <div className="modal">
      <form
        className="modal-content deduction-small-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-table-title"
        onSubmit={handleConfirm}
        noValidate
      >
        <h3 id="confirm-table-title">Confirm Table</h3>
        <div className="message">
          <p>
            {`Confirm the ${versionName(table)}? From then on it is used for pay and can't be changed or deleted.`}
          </p>
        </div>

        <label className="deduction-field">
          <span>Checked against the official table by</span>
          <input
            type="text"
            placeholder="Name of the HR or Accounting person"
            value={checkedWith}
            disabled={saving}
            onChange={(event) => setCheckedWith(event.target.value)}
          />
        </label>

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
            {saving ? "Confirming..." : "Confirm table"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
};

// A plain yes-or-no box with the look of the card's other boxes (heading, dialog role):
// Delete Draft and Mark as Checked. The shared ConfirmModal is left as it is for the
// pages that use it.
export const ConfirmBox = ({
  title,
  message,
  confirmText,
  cancelText = "Cancel",
  onClose,
  onConfirm,
}) => {
  const titleId = useId();

  // Put back what was there before, so a box opened over another box (a pay item's Stop
  // over the employee's items) leaves the page locked while the first box stays open
  useEffect(() => {
    const before = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = before;
    };
  }, []);

  return ReactDOM.createPortal(
    <div className="modal">
      <div
        className="modal-content deduction-small-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h3 id={titleId}>{title}</h3>
        <div className="message">
          <p>{message}</p>
        </div>

        <div className="modal-buttons">
          <button type="button" className="btn modal-button" onClick={onClose}>
            {cancelText}
          </button>
          <button
            type="button"
            className="btn modal-button"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

ConfirmBox.propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  confirmText: PropTypes.string.isRequired,
  cancelText: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

ConfirmTableModal.propTypes = {
  table: PropTypes.shape({
    id: PropTypes.string.isRequired,
    kind: PropTypes.string,
    label: PropTypes.string,
    effectiveFrom: PropTypes.string,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirmed: PropTypes.func.isRequired,
};

export default ConfirmTableModal;
