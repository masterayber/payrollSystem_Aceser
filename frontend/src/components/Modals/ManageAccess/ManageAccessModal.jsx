import { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import API from "../../../api";
import ConfirmModal from "../Confirm/ConfirmModal";
import CancelModal from "../Cancel/CancelModal";
import ConfirmedMessageModal from "../Confirmed/ConfirmedMessageModal";
import "../Modal.css";

const ManageAccessModal = ({ employee, onClose }) => {
  const [pages, setPages] = useState([]);
  const [selected, setSelected] = useState(new Set());
  // The pages as last loaded or saved, to tell whether Cancel would lose changes
  const [savedPages, setSavedPages] = useState(new Set());
  const [customized, setCustomized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const applyAccess = (data) => {
    setPages(data.pages);
    setSelected(new Set(data.allowedPages));
    setSavedPages(new Set(data.allowedPages));
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

  // Resolves true when the server accepted the change
  const save = async (body) => {
    setSaving(true);
    setErrorMessage("");
    try {
      const { data } = await API.put(`/api/access/users/${employee._id}`, body);
      applyAccess(data);
      return true;
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Could not save page access.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Save stays off until the ticks differ from the last loaded or saved set;
  // a save or a reset refreshes both, so Save turns off again after either
  const hasChanges =
    selected.size !== savedPages.size ||
    [...selected].some((key) => !savedPages.has(key));

  const handleCancelClick = () => {
    if (hasChanges) setIsCancelOpen(true);
    else onClose();
  };

  const handleSaveClick = () => {
    if (!hasChanges || saving) return;
    setErrorMessage("");
    setIsConfirmOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    const saved = await save({ pages: [...selected] });
    setIsConfirmOpen(false);
    if (saved) {
      setTimeout(
        () => setSuccessMessage("Page access updated successfully"),
        300,
      );
    }
  };

  const handleReset = () => save({ reset: true });

  const fullName = `${employee.firstName} ${employee.lastName}`;

  // The logistics pages sit under their own heading
  const isLogistics = (page) => page.key.startsWith("logistics-");
  const pageGroups = [
    { title: "", pages: pages.filter((page) => !isLogistics(page)) },
    { title: "Logistics", pages: pages.filter(isLogistics) },
  ].filter((group) => group.pages.length > 0);

  const renderOption = (page) => (
    <label key={page.key} className="access-option">
      <input
        type="checkbox"
        className="modal-checkbox"
        checked={selected.has(page.key)}
        disabled={page.locked || saving}
        onChange={() => togglePage(page.key)}
      />
      <span>{page.label.replace(/^Logistics: /, "")}</span>
      {page.locked && <span className="access-note">Always available</span>}
    </label>
  );

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

        {!loading &&
          pageGroups.map((group) => (
            <div className="access-list" key={group.title || "general"}>
              {group.title && (
                <p className="access-group-title">{group.title}</p>
              )}
              {group.pages.map(renderOption)}
            </div>
          ))}

        {errorMessage && (
          <p className="feedback-message error">{errorMessage}</p>
        )}

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
            onClick={handleCancelClick}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn modal-button"
            onClick={handleSaveClick}
            disabled={loading || saving || pages.length === 0 || !hasChanges}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {isCancelOpen && (
        <CancelModal
          title="Cancel Changes"
          message="Are you sure you want to cancel changing this employee's page access?"
          onClose={() => setIsCancelOpen(false)}
          onConfirm={() => {
            setIsCancelOpen(false);
            onClose();
          }}
          cancelText="No"
          confirmText="Yes, Cancel"
        />
      )}

      {isConfirmOpen && (
        <ConfirmModal
          title="Confirm Changes"
          message={`Are you sure you want to change the page access of ${fullName}?`}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleSave}
          cancelText="No"
          confirmText="Yes, Save"
        />
      )}

      {successMessage && (
        <ConfirmedMessageModal message={successMessage} onClose={onClose} />
      )}
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
