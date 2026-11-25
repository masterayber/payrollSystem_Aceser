import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { IconRefresh } from "@tabler/icons-react";
import API from "../../../api";
import { refusalText } from "../../../utils/adminAccounts";
import {
  EMPTY_FILTERS,
  MESSAGES,
  activityQuery,
  checkDates,
  detailLines,
  emptyText,
  hasFilters,
  hasNewer,
  hasOlder,
  kindOptions,
  pageText,
  personOptions,
  whenText,
  whoText,
} from "../../../utils/activityLog";

// How long the search box waits after the last key before it asks the server
const SEARCH_DELAY_MS = 400;

const KIND_OPTIONS = kindOptions();

// Settings > Admins > Activity log: who changed what, on which record and when, newest
// first, 50 a page. Read-only: an entry has no buttons. The filters live in
// AdminAccountsSettings, so the Activity button on an Admin row can set Person and they
// survive a switch to Accounts and back. `admins` is the list that tab already loads.
const ActivityLogPanel = ({ admins, filters, onFiltersChange }) => {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // The search box as typed; it reaches `filters.q` after a short pause
  const [searchText, setSearchText] = useState(filters.q);
  // Only the newest request's reply is shown
  const requestRef = useRef(0);

  const dateWarning = checkDates(filters);

  const load = useCallback(
    async (wantedPage) => {
      const request = requestRef.current + 1;
      requestRef.current = request;
      setLoading(true);
      setLoadError("");
      try {
        const { data } = await API.get(
          `/api/admins/activity${activityQuery(filters, wantedPage)}`,
        );
        if (requestRef.current !== request) return;
        setEntries(Array.isArray(data?.entries) ? data.entries : []);
        setTotal(Number(data?.total) || 0);
        setPage(Number(data?.page) || wantedPage);
        setPageSize(Number(data?.pageSize) || 50);
        setLoaded(true);
      } catch (error) {
        if (requestRef.current !== request) return;
        setLoadError(refusalText(error, MESSAGES.loadFailed));
      } finally {
        if (requestRef.current === request) setLoading(false);
      }
    },
    [filters],
  );

  // New filters start again at the newest entries. A From after To is not sent: the
  // yellow box says why and the last list stays.
  useEffect(() => {
    if (checkDates(filters)) {
      requestRef.current += 1;
      setLoading(false);
      return;
    }
    load(1);
  }, [filters, load]);

  // Typing in the search box asks the server after a short pause
  useEffect(() => {
    if (searchText === filters.q) return undefined;
    const timer = setTimeout(() => {
      onFiltersChange({ ...filters, q: searchText });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText, filters, onFiltersChange]);

  const setFilter = (key, value) => onFiltersChange({ ...filters, [key]: value });

  const clearFilters = () => {
    setSearchText("");
    onFiltersChange(EMPTY_FILTERS);
  };

  const filtered = hasFilters(filters);
  const blocked = loading || dateWarning !== "";
  const shown = pageText({ page, pageSize, total, count: entries.length });

  return (
    <div className="activity-log">
      <div className="activity-log-filters">
        <label className="activity-log-field">
          <span>Person</span>
          <select
            value={filters.by}
            onChange={(event) => setFilter("by", event.target.value)}
          >
            {personOptions(admins).map((option) => (
              <option key={option.value || "everyone"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="activity-log-field">
          <span>Kind</span>
          <select
            value={filters.group}
            onChange={(event) => setFilter("group", event.target.value)}
          >
            {KIND_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="activity-log-field">
          <span>From</span>
          <input
            type="date"
            value={filters.from}
            onChange={(event) => setFilter("from", event.target.value)}
          />
        </label>

        <label className="activity-log-field">
          <span>To</span>
          <input
            type="date"
            value={filters.to}
            onChange={(event) => setFilter("to", event.target.value)}
          />
        </label>

        <label className="activity-log-field activity-log-search">
          <span>Record</span>
          <input
            type="search"
            placeholder="Search by record"
            aria-label="Search by record"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </label>

        <div className="activity-log-filter-actions">
          <button
            type="button"
            className="activity-log-link"
            onClick={clearFilters}
            disabled={!filtered && searchText === ""}
          >
            Clear filters
          </button>
          <button
            type="button"
            className="admin-accounts-action activity-log-refresh"
            onClick={() => load(page)}
            disabled={blocked}
          >
            <IconRefresh size={15} stroke={2} />
            Refresh
          </button>
        </div>
      </div>

      {dateWarning && (
        <p className="feedback-message warning" role="alert">
          {dateWarning}
        </p>
      )}

      {loadError && (
        <div
          className="feedback-message error admin-accounts-load-error"
          role="alert"
        >
          <span>{loadError}</span>
          <button
            type="button"
            className="admin-accounts-action"
            onClick={() => load(loaded ? page : 1)}
            disabled={blocked}
          >
            Retry
          </button>
        </div>
      )}

      {loading && entries.length === 0 && (
        <p className="admin-accounts-empty">{MESSAGES.loading}</p>
      )}

      {!loading && loaded && !loadError && entries.length === 0 && (
        <p className="admin-accounts-empty">{emptyText({ filtered, total })}</p>
      )}

      {entries.length > 0 && (
        <div
          className={`admin-accounts-table-wrap ${loading ? "activity-log-busy" : ""}`}
          aria-busy={loading}
        >
          <table className="admin-accounts-table activity-log-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Who</th>
                <th scope="col">What</th>
                <th scope="col">Record</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="activity-log-when">{whenText(entry.at)}</td>
                  <td className="activity-log-who">{whoText(entry.by)}</td>
                  <td className="activity-log-what">{entry.label}</td>
                  <td>{entry.targetName}</td>
                  <td className="activity-log-details">
                    {detailLines(entry).map((line, index) => (
                      // At most two fixed lines: the changed fields, then the note
                      <span key={index}>{line}</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(shown || hasNewer(page)) && (
        <div className="activity-log-paging">
          <span>{shown}</span>
          <div className="admin-accounts-actions">
            <button
              type="button"
              className="admin-accounts-action"
              onClick={() => load(page - 1)}
              disabled={blocked || !hasNewer(page)}
            >
              Newer
            </button>
            <button
              type="button"
              className="admin-accounts-action"
              onClick={() => load(page + 1)}
              disabled={blocked || !hasOlder({ page, pageSize, total })}
            >
              Older
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

ActivityLogPanel.propTypes = {
  admins: PropTypes.arrayOf(PropTypes.object).isRequired,
  filters: PropTypes.shape({
    by: PropTypes.string.isRequired,
    group: PropTypes.string.isRequired,
    from: PropTypes.string.isRequired,
    to: PropTypes.string.isRequired,
    q: PropTypes.string.isRequired,
  }).isRequired,
  onFiltersChange: PropTypes.func.isRequired,
};

export default ActivityLogPanel;
