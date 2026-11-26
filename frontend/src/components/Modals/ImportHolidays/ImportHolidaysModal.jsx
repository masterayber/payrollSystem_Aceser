import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import API from "../../../api";
import {
  HOLIDAY_TYPE_OPTIONS,
  formatHolidayDate,
  holidayDateKey,
  holidayDayName,
  holidayTypeLabel,
  isHolidayType,
} from "../../../utils/holidays";
import "../Modal.css";
import "../../../styles/AdminCSS/AdminCalendar.css";

// The server's own words for a refusal (also the 502 when Nager.Date is down), or
// `fallback` when it sent none
const refusalText = (error, fallback) => {
  const message = error?.response?.data?.message;
  return typeof message === "string" && message.trim() !== ""
    ? message
    : fallback;
};

// The preview's rows as the table keeps them: the name and type can be edited, and every
// row whose date has no holiday yet starts ticked. `listed` is the holiday already on
// that date ({ name, type }), or null.
const toRows = (data) =>
  (Array.isArray(data?.rows) ? data.rows : [])
    .filter((row) => row && typeof row.date === "string")
    .map((row) => {
      const listed =
        row.listed && typeof row.listed === "object"
          ? { name: String(row.listed.name || ""), type: row.listed.type }
          : null;
      return {
        date: holidayDateKey(row.date),
        name: typeof row.name === "string" ? row.name : "",
        type: isHolidayType(row.type) ? row.type : "",
        listed,
        ticked: !listed,
      };
    });

const leftOutText = (count) =>
  count === 1
    ? "1 row from the source was left out."
    : `${count} rows from the source were left out.`;

const missingText = (names) =>
  names.length === 1
    ? `Not found in this list: ${names[0]}. Add it by hand if it is on the proclamation.`
    : `Not found in this list: ${names.join(", ")}. Add them by hand if they are on the proclamation.`;

const saveLabel = (count) =>
  count === 1 ? "Save 1 holiday" : `Save ${count} holidays`;

// The preview of one year's Philippine holidays from Nager.Date
// (GET /api/holidays/import-preview), asked again on every open. Nothing is saved until
// Save, which sends only the ticked rows whose date has no holiday yet, with the name and
// type as edited (POST /api/holidays/import). The server does every check and its message
// is shown as it is; a refused Save leaves every row as it was. `onSaved` gets the
// server's message after a Save went through.
const ImportHolidaysModal = ({ year, onClose, onSaved }) => {
  // { missingRegular, leftOut } once the list is in; null while loading or refused
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // False once the modal is gone, so a late Save reply changes nothing
  const open = useRef(true);

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);

  // A reply that comes back after the modal closed (or for another year) is dropped
  useEffect(() => {
    let cancelled = false;

    const loadPreview = async () => {
      try {
        const { data } = await API.get("/api/holidays/import-preview", {
          params: { year },
        });
        if (cancelled) return;
        setRows(toRows(data));
        setPreview({
          missingRegular: (Array.isArray(data?.missingRegular)
            ? data.missingRegular
            : []
          ).map(String),
          leftOut: Number(data?.leftOut) || 0,
        });
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          refusalText(error, "Could not get the list of holidays. Try again."),
        );
      }
    };

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [year]);

  const loading = preview === null && !loadError;
  const newRows = rows.filter((row) => !row.listed);
  const tickedRows = newRows.filter((row) => row.ticked);
  const listedCount = rows.length - newRows.length;

  // Any change to a row (name, type, tick, Select all, Select none) clears the red box
  // of the last refused Save: it may no longer be true, and the next Save checks again
  const changeRow = (date, changes) => {
    setSaveError("");
    setRows((prev) =>
      prev.map((row) => (row.date === date ? { ...row, ...changes } : row)),
    );
  };

  // Select all and Select none: the new rows only
  const tickAll = (ticked) => {
    setSaveError("");
    setRows((prev) =>
      prev.map((row) => (row.listed ? row : { ...row, ticked })),
    );
  };

  const handleSave = async () => {
    if (saving || tickedRows.length === 0) return;

    setSaving(true);
    setSaveError("");
    try {
      const { data } = await API.post("/api/holidays/import", {
        year,
        holidays: tickedRows.map(({ date, name, type }) => ({
          date,
          name,
          type,
        })),
      });
      if (!open.current) return;
      onSaved(
        typeof data?.message === "string" && data.message
          ? data.message
          : `Saved the holidays for ${year}.`,
      );
    } catch (error) {
      if (!open.current) return;
      setSaving(false);
      setSaveError(refusalText(error, "Could not save the holidays."));
    }
  };

  return ReactDOM.createPortal(
    <div className="modal">
      <div
        className="modal-content import-holidays-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-holidays-title"
      >
        <h3 id="import-holidays-title">{`Import holidays for ${year}`}</h3>

        {loading && (
          <p className="import-holidays-loading" role="status">
            Getting the list from Nager.Date...
          </p>
        )}

        {loadError && (
          <p className="feedback-message error" role="alert">
            {loadError}
          </p>
        )}

        {preview && (
          <>
            <p className="import-holidays-note">
              {`From Nager.Date. Check each row against the President's proclamation for ${year} before saving. Eid'l Fitr and Eid'l Adha are not in this list: add them by hand when they are declared.`}
            </p>

            <p className="import-holidays-count">
              {`${rows.length} found: ${newRows.length} new, ${listedCount} already listed.`}
              {preview.leftOut > 0 && ` ${leftOutText(preview.leftOut)}`}
            </p>

            {preview.missingRegular.length > 0 && (
              <p className="feedback-message warning">
                {missingText(preview.missingRegular)}
              </p>
            )}

            {newRows.length > 0 && (
              <div className="import-holidays-select">
                <button
                  type="button"
                  className="import-holidays-link"
                  onClick={() => tickAll(true)}
                  disabled={saving}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="import-holidays-link"
                  onClick={() => tickAll(false)}
                  disabled={saving}
                >
                  Select none
                </button>
              </div>
            )}

            {rows.length > 0 && (
              <div className="import-holidays-table-wrap">
                <table className="import-holidays-table">
                  <thead>
                    <tr>
                      <th className="import-holidays-tick" aria-label="Import" />
                      <th className="import-holidays-date">Date</th>
                      <th className="import-holidays-day">Day</th>
                      <th>Name</th>
                      <th className="import-holidays-type">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const shortDate = formatHolidayDate(row.date);

                      // A date that already has a holiday: no tick box, plain text
                      if (row.listed) {
                        return (
                          <tr key={row.date} className="listed">
                            <td className="import-holidays-tick" />
                            <td>{shortDate}</td>
                            <td>{holidayDayName(row.date)}</td>
                            <td>{row.name}</td>
                            <td>
                              {`Already listed as ${row.listed.name} (${holidayTypeLabel(row.listed.type)})`}
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={row.date}>
                          <td className="import-holidays-tick">
                            <input
                              type="checkbox"
                              className="modal-checkbox"
                              aria-label={`Import ${shortDate}`}
                              checked={row.ticked}
                              disabled={saving}
                              onChange={(event) =>
                                changeRow(row.date, {
                                  ticked: event.target.checked,
                                })
                              }
                            />
                          </td>
                          <td>{shortDate}</td>
                          <td>{holidayDayName(row.date)}</td>
                          <td>
                            <input
                              type="text"
                              className="import-holidays-name"
                              aria-label={`Name of the holiday on ${shortDate}`}
                              value={row.name}
                              disabled={saving}
                              onChange={(event) =>
                                changeRow(row.date, { name: event.target.value })
                              }
                            />
                          </td>
                          <td>
                            <select
                              className="import-holidays-type-select"
                              aria-label={`Type of the holiday on ${shortDate}`}
                              value={row.type}
                              disabled={saving}
                              onChange={(event) =>
                                changeRow(row.date, { type: event.target.value })
                              }
                            >
                              {row.type === "" && (
                                <option value="">Select Type</option>
                              )}
                              {HOLIDAY_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {saveError && (
              <p className="feedback-message error" role="alert">
                {saveError}
              </p>
            )}
          </>
        )}

        <div className="modal-buttons">
          <button
            type="button"
            className="btn modal-button"
            onClick={onClose}
            disabled={saving}
          >
            {loadError ? "Close" : "Cancel"}
          </button>
          {preview && (
            <button
              type="button"
              className="btn modal-button"
              onClick={handleSave}
              disabled={saving || tickedRows.length === 0}
            >
              {saving ? "Saving..." : saveLabel(tickedRows.length)}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

ImportHolidaysModal.propTypes = {
  year: PropTypes.number.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default ImportHolidaysModal;
