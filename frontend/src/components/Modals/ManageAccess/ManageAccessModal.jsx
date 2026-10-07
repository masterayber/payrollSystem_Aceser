import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import API from "../../../api";
import "../Modal.css";

const ManageAccessModal = ({ employee, onClose }) => {
  const [pages, setPages] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [customized, setCustomized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const applyAccess = (data) => {
    setPages(data.pages);
    setSelected(new Set(data.allowedPages));
    setCustomized(data.customized);
  };

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadAccess = async () => {
      try {
        const { data } = await API.get(`/api/access/users/${employee._id}`);
        if (!cancelled) applyAccess(data);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error.response?.data?.message || "Could not load page access.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAccess();
    return () => {
      cancelled = true;
    };
  }, [employee._id]);

  const togglePage = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const save = async (body, closeAfter) => {
    setSaving(true);
    setErrorMessage("");
    try {
      const { data } = await API.put(`/api/access/users/${employee._id}`, body);
      applyAccess(data);
      if (closeAfter) onClose();
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Could not save page access.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => save({ pages: [...selected] }, true);
  const handleReset = () => save({ reset: true }, false);

  const fullName = `${employee.firstName} ${employee.lastName}`;

  return ReactDOM.createPortal(
    <div className="modal">
      <div
        className="modal-content employee-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-access-title"
      >
        <h3 id="manage-access-title">Manage page access: {fullName}</h3>
        <div className="message">
          <p>
            Choose which pages this employee can open. Changes apply the next
            time they sign in or reload.
          </p>
        </div>

        {loading && <p>Loading...</p>}

        {!loading && pages.length > 0 && (
          <div className="access-list">
            {pages.map((page) => (
              <label key={page.key} className="access-option">
                <input
                  type="checkbox"
                  className="modal-checkbox"
                  checked={selected.has(page.key)}
                  disabled={page.locked || saving}
                  onChange={() => togglePage(page.key)}
                />
                <span>{page.label}</span>
                {page.locked && (
                  <span className="access-note">Always available</span>
                )}
              </label>
            ))}
          </div>
        )}

        {errorMessage && <p className="error-message">{errorMessage}</p>}

        <div className="modal-buttons">
          <button
            type="button"
            className="btn modal-button"
            onClick={handleReset}
            disabled={loading || saving || !customized}
          >
            Reset to default
          </button>
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
            disabled={loading || saving || pages.length === 0}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

ManageAccessModal.propTypes = {
  employee: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default ManageAccessModal;
