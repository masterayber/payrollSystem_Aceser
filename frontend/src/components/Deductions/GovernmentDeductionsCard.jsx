import { useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import API from "../../api";
import { UserContext } from "../../context/UserContext";
import DeductionTableModal from "../Modals/DeductionTable/DeductionTableModal";
import ConfirmTableModal, {
  ConfirmBox,
} from "../Modals/DeductionTable/ConfirmTableModal";
import SwitchOffModal from "../Modals/DeductionTable/SwitchOffModal";
import { refusalText } from "../../utils/feedback";
import { toManilaDate } from "../../utils/cutoff";
import { formatPeso } from "../../utils/money";
import {
  LOAD_ERROR,
  LOCKED_NOTE,
  READ_ONLY_NOTE,
  STATUS,
  baseLabel,
  blockingText,
  canWriteTables,
  deductOnLabel,
  emptyForm,
  excessText,
  formFromTable,
  formForNewVersion,
  formatDayKey,
  hasVersions,
  kindNotes,
  kindStatus,
  offKinds,
  shareText,
  upToText,
  versionName,
  versionsOf,
} from "../../utils/deductionTables";

const DASH = "—";

// The badge colour of a version in the detail panel
const PLACE_TONE = {
  current: "ok",
  upcoming: "ok",
  draft: "waiting",
  history: "off",
};

const Badge = ({ label, tone }) => (
  <span className={`deduction-status-badge ${tone}`} title={label}>
    {label}
  </span>
);

Badge.propTypes = {
  label: PropTypes.string.isRequired,
  tone: PropTypes.string.isRequired,
};

// The brackets of one version, read-only: the employee's and the employer's shares
const BracketsTable = ({ rows }) => (
  <div className="deduction-brackets-wrap">
    <table className="deduction-brackets-table">
      <thead>
        <tr>
          <th className="deduction-row-number">Row</th>
          <th>Over</th>
          <th>Up to</th>
          <th>Employee share</th>
          <th>Employer share</th>
          <th>Rate applies over</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            <td className="deduction-row-number">{index + 1}</td>
            <td>{formatPeso(row.over)}</td>
            <td>{upToText(row.upTo)}</td>
            <td>{shareText(row.employeeFixed, row.employeeRate)}</td>
            <td>{shareText(row.employerFixed, row.employerRate)}</td>
            <td>{excessText(row) || DASH}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

BracketsTable.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
};

// Deductions > Government-Mandated Deductions (DED-3): one row per kind with its status,
// the version in force, its source and its last check; "View" opens every version with
// its brackets. The page is behind the Deductions tick and so is the read on the server;
// every change is the Super Admin's only (the server refuses anyone else), so an Admin
// sees the card without its buttons. The server's message is shown as it is.
const GovernmentDeductionsCard = () => {
  const { userData } = useContext(UserContext);
  const canWrite = canWriteTables(userData);

  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  // { type: "success" | "error", text }: the reply to the last change
  const [message, setMessage] = useState(null);
  // The kind whose versions are open under the list
  const [viewKind, setViewKind] = useState("");
  // { table, form }: the editor (table null for a new version)
  const [editor, setEditor] = useState(null);
  const [toConfirm, setToConfirm] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [toCheck, setToCheck] = useState(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadTables = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const { data } = await API.get("/api/deductions/tables");
        if (cancelled) return;
        setSummaries(Array.isArray(data) ? data : []);
      } catch (error) {
        if (cancelled) return;
        setLoadError(refusalText(error, LOAD_ERROR));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadTables();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);

  const done = (text) => {
    setMessage({ type: "success", text });
    reload();
  };

  const openEditor = (table, form) => {
    setMessage(null);
    setEditor({ table, form });
  };

  // A new version starts from the newest confirmed one of its kind, if any
  const addVersion = (summary) => {
    const upcoming = summary.upcoming || [];
    const newest = upcoming[upcoming.length - 1] || summary.current || null;
    openEditor(
      null,
      newest ? formForNewVersion(summary.kind, newest) : emptyForm(summary.kind),
    );
  };

  // Delete a Draft, or mark a confirmed version as checked today: after the confirm box
  const runAction = async (table, request, fallback) => {
    if (!table || busyId) return;
    setBusyId(table.id);
    setMessage(null);
    try {
      const { data } = await request();
      setMessage({ type: "success", text: data?.message || "Saved." });
    } catch (error) {
      setMessage({ type: "error", text: refusalText(error, fallback) });
    } finally {
      setBusyId("");
      // Also after a refusal: "Table not found." means the card is out of date
      reload();
    }
  };

  const handleDelete = () => {
    const table = toDelete;
    setToDelete(null);
    runAction(
      table,
      () => API.delete(`/api/deductions/tables/${table.id}`),
      "Could not delete the draft.",
    );
  };

  const handleChecked = () => {
    const table = toCheck;
    setToCheck(null);
    runAction(
      table,
      () => API.post(`/api/deductions/tables/${table.id}/checked`),
      "Could not mark the table as checked.",
    );
  };

  const banner = blockingText(summaries);
  // The panel closes by itself once its kind has no version left (its last Draft deleted)
  const viewed = summaries.find(
    (summary) => summary.kind === viewKind && hasVersions(summary),
  );
  const versions = versionsOf(viewed);

  return (
    <div className="table-container deduction-config-card">
      <div className="table-title">
        <p>Government-Mandated Deductions</p>
        {canWrite && (
          <button
            type="button"
            className="deduction-title-button"
            onClick={() => {
              setMessage(null);
              setSwitchOpen(true);
            }}
            disabled={loading || Boolean(loadError)}
          >
            Switch off
          </button>
        )}
      </div>

      {!canWrite && <p className="deduction-card-note">{READ_ONLY_NOTE}</p>}

      {banner && (
        <p className="feedback-message warning" role="status">
          {banner}
        </p>
      )}

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

      <div className="table deduction-options-table">
        <div className="table-header">
          <article className="table-header-container">
            <p>Type</p>
          </article>
          <article className="table-header-container">
            <p>Status</p>
          </article>
          <article className="table-header-container">
            <p>In force since</p>
          </article>
          <article className="table-header-container">
            <p>Source</p>
          </article>
          <article className="table-header-container">
            <p>Last checked</p>
          </article>
          <article className="table-header-container">
            <p>Manage</p>
          </article>
        </div>

        {summaries.map((summary) => {
          const status = kindStatus(summary);
          const current = summary.current;
          const open = viewKind === summary.kind;

          return (
            <div className="table-content" key={summary.kind}>
              <article className="table-content-container">
                <p>{summary.label}</p>
              </article>
              <article className="table-content-container deduction-status-cell">
                <Badge label={status.label} tone={status.tone} />
                {kindNotes(summary).map((note) => (
                  <Badge key={note.label} label={note.label} tone={note.tone} />
                ))}
              </article>
              <article className="table-content-container">
                <p>{current ? formatDayKey(current.effectiveFrom) : DASH}</p>
              </article>
              <article className="table-content-container">
                <p title={current?.source || ""}>{current?.source || DASH}</p>
              </article>
              <article className="table-content-container">
                <p>
                  {summary.lastCheckedOn
                    ? formatDayKey(summary.lastCheckedOn)
                    : DASH}
                </p>
              </article>
              <article className="table-content-container">
                {hasVersions(summary) && (
                  <button
                    type="button"
                    className="action-button"
                    aria-expanded={open}
                    onClick={() => setViewKind(open ? "" : summary.kind)}
                  >
                    {open ? "Hide" : "View"}
                  </button>
                )}
                {canWrite && (
                  <button
                    type="button"
                    className="action-button"
                    onClick={() => addVersion(summary)}
                  >
                    {hasVersions(summary) ? "Add version" : "Add table"}
                  </button>
                )}
                {!canWrite && !hasVersions(summary) && <p>{DASH}</p>}
              </article>
            </div>
          );
        })}

        {summaries.length === 0 && (
          <p className="no-data">
            {loading ? "Loading..." : "No deduction tables to show."}
          </p>
        )}
      </div>

      {viewed && (
        <section
          className="deduction-versions"
          aria-label={`${viewed.label} tables`}
        >
          <div className="deduction-versions-title">
            <p>{`${viewed.label} tables`}</p>
            <div className="deduction-versions-buttons">
              {canWrite && (
                <button
                  type="button"
                  className="action-button"
                  onClick={() => addVersion(viewed)}
                >
                  Add version
                </button>
              )}
              <button
                type="button"
                className="action-button"
                onClick={() => setViewKind("")}
              >
                Close
              </button>
            </div>
          </div>

          {versions.length === 0 && (
            <p className="no-data">{`No ${viewed.label} tables yet.`}</p>
          )}

          {versions.map(({ table, place, label }) => {
            const confirmed = table.status === STATUS.CONFIRMED;
            const busy = busyId === table.id;

            return (
              <article className="deduction-version" key={table.id}>
                <div className="deduction-version-head">
                  <Badge label={label} tone={PLACE_TONE[place]} />
                  <strong>{`From ${formatDayKey(table.effectiveFrom)}`}</strong>
                </div>

                <dl className="deduction-version-details">
                  <div>
                    <dt>Source</dt>
                    <dd>{table.source || DASH}</dd>
                  </div>
                  <div>
                    <dt>Read against</dt>
                    <dd>{baseLabel(table.base)}</dd>
                  </div>
                  <div>
                    <dt>Taken on</dt>
                    <dd>{deductOnLabel(table.deductOn)}</dd>
                  </div>
                  {table.createdBy && (
                    <div>
                      <dt>Typed in by</dt>
                      <dd>{table.createdBy}</dd>
                    </div>
                  )}
                  {confirmed && (
                    <>
                      <div>
                        <dt>Confirmed</dt>
                        <dd>
                          {[
                            table.confirmedAt
                              ? formatDayKey(toManilaDate(table.confirmedAt))
                              : "",
                            table.confirmedBy ? `by ${table.confirmedBy}` : "",
                          ]
                            .filter(Boolean)
                            .join(" ") || DASH}
                        </dd>
                      </div>
                      <div>
                        <dt>Checked with</dt>
                        <dd>{table.checkedWith || DASH}</dd>
                      </div>
                      <div>
                        <dt>Last checked</dt>
                        <dd>
                          {[
                            formatDayKey(table.lastCheckedOn),
                            table.lastCheckedBy
                              ? `by ${table.lastCheckedBy}`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ") || DASH}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>

                <BracketsTable rows={table.rows || []} />

                {canWrite && !confirmed && (
                  <div className="deduction-version-actions">
                    <button
                      type="button"
                      className="action-button"
                      disabled={Boolean(busyId)}
                      onClick={() => openEditor(table, formFromTable(table))}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="action-button"
                      disabled={Boolean(busyId)}
                      onClick={() => {
                        setMessage(null);
                        setToDelete(table);
                      }}
                    >
                      {busy ? "Deleting..." : "Delete"}
                    </button>
                    <button
                      type="button"
                      className="action-button"
                      disabled={Boolean(busyId)}
                      onClick={() => {
                        setMessage(null);
                        setToConfirm(table);
                      }}
                    >
                      Confirm
                    </button>
                  </div>
                )}

                {canWrite && confirmed && (
                  <div className="deduction-version-actions">
                    <p className="deduction-card-note">{LOCKED_NOTE}</p>
                    {place !== "history" && (
                      <button
                        type="button"
                        className="action-button"
                        disabled={Boolean(busyId)}
                        onClick={() => {
                          setMessage(null);
                          setToCheck(table);
                        }}
                      >
                        {busy ? "Saving..." : "Mark as checked"}
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {editor && (
        <DeductionTableModal
          table={editor.table}
          initialForm={editor.form}
          onClose={() => setEditor(null)}
          onSaved={(text) => {
            setEditor(null);
            done(text);
          }}
        />
      )}

      {toConfirm && (
        <ConfirmTableModal
          table={toConfirm}
          onClose={() => setToConfirm(null)}
          onConfirmed={(text) => {
            setToConfirm(null);
            done(text);
          }}
        />
      )}

      {toDelete && (
        <ConfirmBox
          title="Delete Draft"
          message={`Delete the draft ${versionName(toDelete)}? This can't be undone.`}
          onClose={() => setToDelete(null)}
          onConfirm={handleDelete}
          confirmText="Yes, Delete"
        />
      )}

      {toCheck && (
        <ConfirmBox
          title="Mark as Checked"
          message={`Mark the ${versionName(toCheck)} as checked against the official table today?`}
          onClose={() => setToCheck(null)}
          onConfirm={handleChecked}
          confirmText="Yes, Mark as Checked"
        />
      )}

      {switchOpen && (
        <SwitchOffModal
          initialOff={offKinds(summaries)}
          onClose={() => setSwitchOpen(false)}
          onSaved={(text) => {
            setSwitchOpen(false);
            done(text);
          }}
        />
      )}
    </div>
  );
};

export default GovernmentDeductionsCard;
