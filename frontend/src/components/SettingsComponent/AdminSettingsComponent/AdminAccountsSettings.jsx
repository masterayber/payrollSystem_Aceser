import { useCallback, useEffect, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import API from "../../../api";
import AdminAccountModal from "../../Modals/AdminAccount/AdminAccountModal";
import TemporaryPasswordModal from "../../Modals/AdminAccount/TemporaryPasswordModal";
import ConfirmModal from "../../Modals/Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Modals/Confirmed/ConfirmedMessageModal";
import {
  adminName,
  isDisabled,
  lastLoginText,
  payListText,
  refusalText,
  statusLabel,
} from "../../../utils/adminAccounts";
import "./AdminAccountsSettings.css";

// The confirm box before an action that hits a signed-in person at once. Enable has
// none: it harms nobody.
const CONFIRMS = {
  disable: {
    title: "Confirm Disable",
    message: (name) =>
      `Disable ${name}? They are signed out on their next click and can't sign in until enabled.`,
    confirmText: "Yes, Disable",
  },
  reset: {
    title: "Confirm Reset",
    message: (name) =>
      `Reset the password of ${name}? The current password stops working at once.`,
    confirmText: "Yes, Reset",
  },
};

// Settings > Admins: the Admin accounts, with Add, Edit, Disable or Enable, and Reset
// password. The tab is offered only to the account that may manage Admins, and every
// route here refuses anyone else (shown in the red box).
const AdminAccountsSettings = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  // The id of the Admin an action is running on
  const [busyId, setBusyId] = useState("");
  // undefined: form closed; null: Add Admin; an Admin row: Edit Admin
  const [formAdmin, setFormAdmin] = useState(undefined);
  // { kind: "disable" | "reset", admin }
  const [confirm, setConfirm] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  // { intro, password, name }: held here only while its box is open, never stored
  const [temporary, setTemporary] = useState(null);

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await API.get("/api/admins");
      setAdmins(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(refusalText(error, "Could not load the Admin accounts."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  // Resolves the reply, or null after showing the refusal
  const runAction = async (admin, action, fallback) => {
    setBusyId(admin.id);
    setActionError("");
    try {
      const { data } = await API.post(`/api/admins/${admin.id}/${action}`);
      return data || {};
    } catch (error) {
      setActionError(refusalText(error, fallback));
      return null;
    } finally {
      setBusyId("");
    }
  };

  const handleEnable = async (admin) => {
    const data = await runAction(
      admin,
      "enable",
      "Could not enable the Admin account.",
    );
    if (!data) return;
    await loadAdmins();
    setSuccessMessage(data.message || "Admin enabled.");
  };

  const handleConfirmed = async () => {
    if (!confirm || busyId) return;
    const { kind, admin } = confirm;

    if (kind === "disable") {
      const data = await runAction(
        admin,
        "disable",
        "Could not disable the Admin account.",
      );
      setConfirm(null);
      if (!data) return;
      await loadAdmins();
      setSuccessMessage(data.message || "Admin disabled.");
      return;
    }

    const data = await runAction(
      admin,
      "reset-password",
      "Could not reset the password.",
    );
    setConfirm(null);
    if (!data) return;
    if (data.temporaryPassword) {
      setTemporary({
        intro: data.message || "Password reset.",
        password: data.temporaryPassword,
        name: adminName(admin),
      });
    } else {
      setActionError("Could not reset the password.");
    }
    loadAdmins();
  };

  const handleSaved = (result) => {
    setFormAdmin(undefined);
    loadAdmins();
    if (result.kind === "add" && result.temporaryPassword) {
      setTemporary({
        intro: result.message,
        password: result.temporaryPassword,
        name: result.name,
      });
      return;
    }
    setSuccessMessage(result.message);
  };

  const openForm = (admin) => {
    setActionError("");
    setFormAdmin(admin);
  };

  return (
    <div className="settings-content admin-accounts-settings">
      <div className="setting-tab">
        <div className="admin-accounts-header">
          <div className="setting-tab-title">
            <p>Admin accounts</p>
          </div>
          <button
            type="button"
            className="admin-accounts-add-button"
            onClick={() => openForm(null)}
          >
            <IconPlus size={16} stroke={2.5} />
            Add Admin
          </button>
        </div>

        {loadError && (
          <div className="feedback-message error admin-accounts-load-error">
            <span>{loadError}</span>
            <button
              type="button"
              className="admin-accounts-action"
              onClick={loadAdmins}
              disabled={loading}
            >
              Retry
            </button>
          </div>
        )}

        {actionError && (
          <p className="feedback-message error" role="alert">
            {actionError}
          </p>
        )}

        {loading && admins.length === 0 && (
          <p className="admin-accounts-empty">Loading...</p>
        )}

        {!loading && !loadError && admins.length === 0 && (
          <p className="admin-accounts-empty">
            No Admin accounts yet. Use Add Admin to create one.
          </p>
        )}

        {admins.length > 0 && (
          <div className="admin-accounts-table-wrap">
            <table className="admin-accounts-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Username</th>
                  <th scope="col">Email</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last login</th>
                  <th scope="col">Pay list</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => {
                  const disabled = isDisabled(admin);
                  const busy = busyId === admin.id;

                  return (
                    <tr key={admin.id} className={disabled ? "disabled" : ""}>
                      <td>{adminName(admin)}</td>
                      <td>{admin.username}</td>
                      <td>{admin.email}</td>
                      <td>
                        <div className="admin-accounts-status">
                          <span
                            className={`admin-accounts-badge ${
                              disabled ? "disabled" : "active"
                            }`}
                          >
                            {statusLabel(admin.status)}
                          </span>
                          {admin.mustChangePassword && (
                            <span className="admin-accounts-badge pending">
                              Must change password
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{lastLoginText(admin.lastLogin)}</td>
                      <td>{payListText(admin.payAccess)}</td>
                      <td>
                        <div className="admin-accounts-actions">
                          <button
                            type="button"
                            className="admin-accounts-action"
                            onClick={() => openForm(admin)}
                            disabled={busy}
                          >
                            Edit
                          </button>
                          {disabled ? (
                            <button
                              type="button"
                              className="admin-accounts-action"
                              onClick={() => handleEnable(admin)}
                              disabled={busy}
                            >
                              Enable
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="admin-accounts-action danger"
                              onClick={() =>
                                setConfirm({ kind: "disable", admin })
                              }
                              disabled={busy}
                            >
                              Disable
                            </button>
                          )}
                          <button
                            type="button"
                            className="admin-accounts-action"
                            onClick={() => setConfirm({ kind: "reset", admin })}
                            disabled={busy}
                          >
                            Reset password
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formAdmin !== undefined && (
        <AdminAccountModal
          admin={formAdmin}
          onClose={() => setFormAdmin(undefined)}
          onSaved={handleSaved}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={CONFIRMS[confirm.kind].title}
          message={CONFIRMS[confirm.kind].message(adminName(confirm.admin))}
          onClose={() => {
            if (!busyId) setConfirm(null);
          }}
          onConfirm={handleConfirmed}
          cancelText="No"
          confirmText={CONFIRMS[confirm.kind].confirmText}
        />
      )}

      {successMessage && (
        <ConfirmedMessageModal
          message={successMessage}
          onClose={() => setSuccessMessage("")}
        />
      )}

      {temporary && (
        <TemporaryPasswordModal
          intro={temporary.intro}
          password={temporary.password}
          name={temporary.name}
          onClose={() => setTemporary(null)}
        />
      )}
    </div>
  );
};

export default AdminAccountsSettings;
