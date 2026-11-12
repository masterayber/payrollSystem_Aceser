import { useContext, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import API from "../../../api";
import { EmployeeContext } from "../../../context/EmployeeContext";
import ConfirmModal from "../Confirm/ConfirmModal";
import CancelModal from "../Cancel/CancelModal";
import EmployeePicker from "./EmployeePicker";
import {
  ACTION_HINTS,
  addAdminBody,
  adminName,
  checkAdminForm,
  defaultTicks,
  editAdminBody,
  formChanged,
  formFromAdmin,
  fullName,
  newAdminForm,
  pageGroups,
  pickerRows,
  refusalText,
  splitAdminPages,
  tickLabel,
} from "../../../utils/adminAccounts";
import "../Modal.css";

// Add Admin (no `admin`) and Edit Admin (an `admin` row of GET /api/admins) in one
// form. There is no password field: the server makes a temporary password on Add and
// the caller shows it once. `onSaved` gets { kind: "add" | "edit", name, message,
// temporaryPassword } after the server accepted the change.
const AdminAccountModal = ({ admin = null, onClose, onSaved }) => {
  const editing = Boolean(admin);
  const { employeeData, reloadEmployees } = useContext(EmployeeContext);

  // Every page the server knows, or null until GET /api/access/pages answers
  const [allPages, setAllPages] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState(() =>
    editing ? formFromAdmin(admin) : newAdminForm([]),
  );
  // The form as it opened, to tell whether Save has anything to send and whether
  // Cancel would lose changes
  const [savedForm, setSavedForm] = useState(form);
  // { type: "warning" | "error", text }
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  // A fresh employee list each time the form opens, so a new hire is offered
  useEffect(() => {
    reloadEmployees();
  }, [reloadEmployees]);

  useEffect(() => {
    let cancelled = false;

    const loadPages = async () => {
      try {
        const { data } = await API.get("/api/access/pages");
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setAllPages(list);
        // A new form starts with the server's default ticks
        if (!editing) {
          const pages = defaultTicks(list);
          setForm((prev) => ({ ...prev, pages }));
          setSavedForm((prev) => ({ ...prev, pages }));
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(refusalText(error, "Could not load the list of pages."));
        }
      }
    };

    loadPages();
    return () => {
      cancelled = true;
    };
  }, [editing]);

  const { pages, actions } = useMemo(
    () => splitAdminPages(allPages || []),
    [allPages],
  );

  // Both pickers list the same people; someone saved on this Admin who is missing
  // from the employee list keeps a row
  const rows = useMemo(
    () =>
      pickerRows(employeeData, [
        ...(admin?.payAccess || []),
        ...(admin?.linkedEmployee ? [admin.linkedEmployee] : []),
      ]),
    [employeeData, admin],
  );

  const hasChanges = formChanged(form, savedForm);
  const ready = allPages !== null;
  const name = fullName(form) || form.username.trim();

  const setField = (event) => {
    const { name: key, value } = event.target;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTick = (key) => {
    setForm((prev) => ({
      ...prev,
      pages: prev.pages.includes(key)
        ? prev.pages.filter((item) => item !== key)
        : [...prev.pages, key],
    }));
  };

  const handleCancelClick = () => {
    if (hasChanges) setIsCancelOpen(true);
    else onClose();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (saving || !ready || (editing && !hasChanges)) return;

    const warning = checkAdminForm(form);
    if (warning) {
      setMessage({ type: "warning", text: warning });
      return;
    }
    setMessage(null);
    setIsConfirmOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      if (editing) {
        await API.patch(`/api/admins/${admin.id}`, editAdminBody(form));
        // PATCH replies with the Admin and no message, so the words are the screen's
        onSaved({ kind: "edit", name, message: "Admin account updated." });
      } else {
        const { data } = await API.post("/api/admins", addAdminBody(form));
        onSaved({
          kind: "add",
          name,
          message: data?.message || "Admin account created.",
          temporaryPassword: data?.temporaryPassword || "",
        });
      }
    } catch (error) {
      setIsConfirmOpen(false);
      setSaving(false);
      setMessage({
        type: "error",
        text: refusalText(
          error,
          editing
            ? "Could not update the Admin account."
            : "Could not save the Admin account.",
        ),
      });
    }
  };

  const renderTick = (page) => (
    <label key={page.key} className="access-option">
      <input
        type="checkbox"
        className="modal-checkbox"
        checked={Boolean(page.locked) || form.pages.includes(page.key)}
        disabled={Boolean(page.locked) || saving}
        onChange={() => toggleTick(page.key)}
      />
      {/* A tick that only works with another one carries a hint line under it;
          nothing is ticked or refused for the user */}
      <span className="admin-tick-text">
        <span>{tickLabel(page)}</span>
        {ACTION_HINTS[page.key] && (
          <span className="admin-form-hint">{ACTION_HINTS[page.key]}</span>
        )}
      </span>
      {page.locked && <span className="access-note">Always available</span>}
    </label>
  );

  return ReactDOM.createPortal(
    <div className="modal">
      <div
        className="modal-content employee-modal-content admin-account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-account-title"
      >
        <h3 id="admin-account-title">
          {editing ? `Edit Admin: ${adminName(admin)}` : "Add Admin"}
        </h3>

        <form onSubmit={handleSubmit} className="form-container" noValidate>
          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label htmlFor="admin-first-name">First name</label>{" "}
                <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  id="admin-first-name"
                  type="text"
                  name="firstName"
                  placeholder="Enter first name"
                  autoComplete="off"
                  value={form.firstName}
                  disabled={saving}
                  onChange={setField}
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label htmlFor="admin-last-name">Last name</label>{" "}
                <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  id="admin-last-name"
                  type="text"
                  name="lastName"
                  placeholder="Enter last name"
                  autoComplete="off"
                  value={form.lastName}
                  disabled={saving}
                  onChange={setField}
                />
              </div>
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label htmlFor="admin-username">Username</label>{" "}
                {!editing && <span className="required">*</span>}
              </div>
              <div className="input-group-signup">
                <input
                  id="admin-username"
                  type="text"
                  name="username"
                  placeholder="Enter username"
                  autoComplete="off"
                  value={form.username}
                  disabled={editing || saving}
                  onChange={setField}
                />
              </div>
              {editing && (
                <p className="admin-form-hint">
                  Username can&apos;t be changed.
                </p>
              )}
            </div>

            <div className="input-container">
              <div className="label-container">
                <label htmlFor="admin-email">Email</label>{" "}
                <span className="required">*</span>
              </div>
              <div className="input-group-signup">
                <input
                  id="admin-email"
                  type="email"
                  name="email"
                  placeholder="Enter email"
                  autoComplete="off"
                  value={form.email}
                  disabled={saving}
                  onChange={setField}
                />
              </div>
            </div>
          </div>

          <section className="admin-form-section">
            <h4>Linked employee (optional)</h4>
            <p className="admin-form-hint">
              Pick this person&apos;s own employee account, if they have one.
              This Admin can&apos;t change or approve anything on that record.
            </p>
            <EmployeePicker
              name="admin-linked-employee"
              rows={rows}
              selected={form.linkedEmployeeId ? [form.linkedEmployeeId] : []}
              onChange={(ids) =>
                setForm((prev) => ({ ...prev, linkedEmployeeId: ids[0] || "" }))
              }
              disabled={saving}
            />
          </section>

          <section className="admin-form-section">
            <h4>Pages</h4>
            {!ready && !loadError && <p>Loading...</p>}
            {pageGroups(pages).map((group) => (
              <div className="access-list" key={group.title || "general"}>
                {group.title && (
                  <p className="access-group-title">{group.title}</p>
                )}
                {group.pages.map(renderTick)}
              </div>
            ))}
          </section>

          {ready && actions.length > 0 && (
            <section className="admin-form-section">
              <h4>Actions</h4>
              <div className="access-list">{actions.map(renderTick)}</div>
            </section>
          )}

          <section className="admin-form-section">
            <h4>Pay list</h4>
            <p className="admin-form-hint">
              This Admin sees pay only for the people ticked here. With nobody
              ticked, no pay is shown.
            </p>
            <EmployeePicker
              name="admin-pay-list"
              rows={rows}
              selected={form.payAccess}
              onChange={(ids) =>
                setForm((prev) => ({ ...prev, payAccess: ids }))
              }
              multiple
              disabled={saving}
            />
          </section>

          {loadError && <p className="feedback-message error">{loadError}</p>}
          {message && (
            <p className={`feedback-message ${message.type}`} role="alert">
              {message.text}
            </p>
          )}

          <div className="modal-buttons">
            <button
              type="button"
              className="btn modal-button"
              onClick={handleCancelClick}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn modal-button"
              disabled={saving || !ready || (editing && !hasChanges)}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>

      {isCancelOpen && (
        <CancelModal
          title="Cancel Changes"
          message="Are you sure you want to cancel? Your changes will be lost."
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
          title={editing ? "Confirm Changes" : "Confirm New Admin"}
          message={
            editing
              ? `Save the changes to ${name}?`
              : `Create an Admin account for ${name}?`
          }
          onClose={() => {
            if (!saving) setIsConfirmOpen(false);
          }}
          onConfirm={handleSave}
          cancelText="No"
          confirmText={editing ? "Yes, Save" : "Yes, Create"}
        />
      )}
    </div>,
    document.body,
  );
};

AdminAccountModal.propTypes = {
  admin: PropTypes.shape({
    id: PropTypes.string.isRequired,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    username: PropTypes.string,
    email: PropTypes.string,
    pages: PropTypes.arrayOf(PropTypes.string),
    payAccess: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string,
        employeeId: PropTypes.string,
        status: PropTypes.string,
      }),
    ),
    linkedEmployee: PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string,
    }),
  }),
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default AdminAccountModal;
