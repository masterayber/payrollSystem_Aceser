import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import API from "../../../api";
import { refusalText } from "../../../utils/feedback";
import { formatDayKey } from "../../../utils/deductionTables";
import {
  DASH,
  ITEMS_LOAD_ERROR,
  NO_ITEMS,
  OWN_RECORD_NOTE,
  STATUS,
  cutoffText,
  employeeName,
  itemActions,
  itemName,
  kindLabel,
  moneyText,
  repeatLabel,
  scheduleLabel,
  statusTone,
} from "../../../utils/payItems";
import { ConfirmBox } from "../DeductionTable/ConfirmTableModal";
import PayItemModal from "./PayItemModal";
import "../Modal.css";
import "../../../styles/AdminCSS/Deductions.css";

// The pay items of one employee on the Employee Deduction Log (DED-4): every item with
// its amount, total, balance, repeat, schedule, start and status, and Add, Edit,
// Pause or Resume, Stop and Delete. Stop and Delete ask first in an in-app box. Each
// action shows the server's reply here and tells the card (`onChanged`) so the row's
// Loans and item count are read again. On the Admin's own employee record the items are
// shown without any button (the server refuses every change there anyway).
const EmployeeItemsModal = ({ employee, onClose, onChanged }) => {
  const ownRecord = Boolean(employee.ownRecord);
  const name = employeeName(employee);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  // { type: "success" | "error", text }: the reply to the last action
  const [message, setMessage] = useState(null);
  // { item }: the Add (item null) or Edit box
  const [editor, setEditor] = useState(null);
  const [toStop, setToStop] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  // { id, action }: the item and the action waiting for the server
  const [busy, setBusy] = useState(null);
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

  useEffect(() => {
    let cancelled = false;

    const loadItems = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const { data } = await API.get("/api/deductions/items", {
          params: { userId: employee.userId },
        });
        if (cancelled) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (error) {
        if (cancelled) return;
        setLoadError(refusalText(error, ITEMS_LOAD_ERROR));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadItems();
    return () => {
      cancelled = true;
    };
  }, [employee.userId, reloadKey]);

  // After every change, and after a refusal too ("Item not found." means the list is old)
  const refresh = () => {
    setReloadKey((key) => key + 1);
    onChanged();
  };

  const runAction = async (item, action, request, fallback) => {
    if (!item || busy) return;
    setBusy({ id: item.id, action });
    setMessage(null);
    try {
      const { data } = await request();
      if (!open.current) return;
      setMessage({ type: "success", text: data?.message || fallback.done });
    } catch (error) {
      if (!open.current) return;
      setMessage({ type: "error", text: refusalText(error, fallback.failed) });
    } finally {
      if (open.current) {
        setBusy(null);
        refresh();
      }
    }
  };

  const setStatus = (item, status) =>
    runAction(
      item,
      status === STATUS.PAUSED ? "pause" : "resume",
      () => API.patch(`/api/deductions/items/${item.id}`, { status }),
      status === STATUS.PAUSED
        ? { done: "Paused.", failed: "Could not pause the item." }
        : { done: "Resumed.", failed: "Could not resume the item." },
    );

  const handleStop = () => {
    const item = toStop;
    setToStop(null);
    runAction(
      item,
      "stop",
      () => API.post(`/api/deductions/items/${item.id}/stop`),
      { done: "Stopped.", failed: "Could not stop the item." },
    );
  };

  const handleDelete = () => {
    const item = toDelete;
    setToDelete(null);
    runAction(
      item,
      "delete",
      () => API.delete(`/api/deductions/items/${item.id}`),
      { done: "Deleted.", failed: "Could not delete the item." },
    );
  };

  const openEditor = (item) => {
    setMessage(null);
    setEditor({ item });
  };

  const resigned = employee.status === "Resigned";

  return ReactDOM.createPortal(
    <div className="modal">
      <div
        className="modal-content pay-items-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-items-title"
      >
        <div className="pay-items-head">
          <div>
            <h3 id="pay-items-title">{`Pay Items: ${name}`}</h3>
            <p className="pay-items-sub">
              <span>{`Employee ID ${employee.employeeId || DASH}`}</span>
              {resigned && (
                <span
                  className="deduction-status-badge resigned"
                  title={
                    employee.resignationDate
                      ? `Last working day ${formatDayKey(employee.resignationDate)}`
                      : "Resigned"
                  }
                >
                  Resigned
                </span>
              )}
            </p>
          </div>
          {!ownRecord && (
            <button
              type="button"
              className="action-button"
              disabled={Boolean(busy) || loading}
              onClick={() => openEditor(null)}
            >
              Add item
            </button>
          )}
        </div>

        {ownRecord && <p className="deduction-card-note">{OWN_RECORD_NOTE}</p>}

        {loadError && (
          <p className="feedback-message error" role="alert">
            {loadError}
          </p>
        )}

        {message && (
          <p
            className={`feedback-message ${message.type}`}
            role={message.type === "error" ? "alert" : "status"}
          >
            {message.text}
          </p>
        )}

        <div className="deduction-brackets-wrap">
          <table className="pay-items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Per cut-off</th>
                <th>Total</th>
                <th>Balance</th>
                <th>Repeat</th>
                <th>Taken on</th>
                <th>Starts</th>
                <th>Status</th>
                {!ownRecord && <th>Manage</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const actions = itemActions(item, { ownRecord });
                const waiting = (action) =>
                  busy?.id === item.id && busy.action === action;
                const anyAction = Object.values(actions).some(Boolean);

                return (
                  <tr key={item.id}>
                    <td>
                      <strong title={itemName(item)}>{itemName(item)}</strong>
                      <span className="pay-item-kind">
                        {[
                          kindLabel(item.kind),
                          item.kind === "earning"
                            ? item.taxable === false
                              ? "not taxable"
                              : "taxable"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                      {item.note && (
                        <span className="pay-item-kind" title={item.note}>
                          {item.note}
                        </span>
                      )}
                    </td>
                    <td>{moneyText(item.amountPerCutoff)}</td>
                    <td>{moneyText(item.total)}</td>
                    <td>{moneyText(item.balance)}</td>
                    <td>{repeatLabel(item.repeat)}</td>
                    <td>{scheduleLabel(item.schedule)}</td>
                    <td>{cutoffText(item.startCutoff) || DASH}</td>
                    <td>
                      <span
                        className={`deduction-status-badge ${statusTone(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    {!ownRecord && (
                      <td>
                        <div className="pay-item-actions">
                          {actions.edit && (
                            <button
                              type="button"
                              className="action-button"
                              disabled={Boolean(busy)}
                              onClick={() => openEditor(item)}
                            >
                              Edit
                            </button>
                          )}
                          {actions.pause && (
                            <button
                              type="button"
                              className="action-button"
                              disabled={Boolean(busy)}
                              onClick={() => setStatus(item, STATUS.PAUSED)}
                            >
                              {waiting("pause") ? "Saving..." : "Pause"}
                            </button>
                          )}
                          {actions.resume && (
                            <button
                              type="button"
                              className="action-button"
                              disabled={Boolean(busy)}
                              onClick={() => setStatus(item, STATUS.ACTIVE)}
                            >
                              {waiting("resume") ? "Saving..." : "Resume"}
                            </button>
                          )}
                          {actions.stop && (
                            <button
                              type="button"
                              className="action-button"
                              disabled={Boolean(busy)}
                              onClick={() => {
                                setMessage(null);
                                setToStop(item);
                              }}
                            >
                              {waiting("stop") ? "Stopping..." : "Stop"}
                            </button>
                          )}
                          {actions.delete && (
                            <button
                              type="button"
                              className="action-button"
                              disabled={Boolean(busy)}
                              onClick={() => {
                                setMessage(null);
                                setToDelete(item);
                              }}
                            >
                              {waiting("delete") ? "Deleting..." : "Delete"}
                            </button>
                          )}
                          {!anyAction && <span>{DASH}</span>}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {items.length === 0 && (
            <p className="pay-items-empty">
              {loading
                ? "Loading..."
                : loadError
                  ? "No pay items to show."
                  : NO_ITEMS}
            </p>
          )}
        </div>

        <div className="modal-buttons">
          <button
            type="button"
            className="btn modal-button"
            onClick={onClose}
            disabled={Boolean(busy)}
          >
            Close
          </button>
        </div>
      </div>

      {editor && (
        <PayItemModal
          employee={employee}
          item={editor.item}
          onClose={() => setEditor(null)}
          onSaved={(text) => {
            setEditor(null);
            setMessage({ type: "success", text });
            refresh();
          }}
        />
      )}

      {toStop && (
        <ConfirmBox
          title="Stop Pay Item"
          message={`Stop ${itemName(toStop)} for ${name}? It won't be on any later payslip, and a stopped item can't be resumed.`}
          onClose={() => setToStop(null)}
          onConfirm={handleStop}
          confirmText="Yes, Stop"
        />
      )}

      {toDelete && (
        <ConfirmBox
          title="Delete Pay Item"
          message={`Delete ${itemName(toDelete)} for ${name}? This can't be undone.`}
          onClose={() => setToDelete(null)}
          onConfirm={handleDelete}
          confirmText="Yes, Delete"
        />
      )}
    </div>,
    document.body,
  );
};

EmployeeItemsModal.propTypes = {
  employee: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    employeeId: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    status: PropTypes.string,
    resignationDate: PropTypes.string,
    ownRecord: PropTypes.bool,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onChanged: PropTypes.func.isRequired,
};

export default EmployeeItemsModal;
