import { useEffect, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import API from "../../api";
import Pagination from "../Pagination/Pagination";
import EmployeeItemsModal from "../Modals/PayItem/EmployeeItemsModal";
import { refusalText } from "../../utils/feedback";
import { formatDayKey } from "../../utils/deductionTables";
import {
  DASH,
  LOG_LOAD_ERROR,
  NO_LOG_ROWS,
  NO_SEARCH_MATCH,
  employeeName,
  filterLogRows,
  itemCountText,
  moneyText,
  orderLogRows,
} from "../../utils/payItems";

const ITEMS_PER_PAGE = 7;

// Deductions > Employee Deduction Log (DED-4): one row per employee on the caller's pay
// list (GET /api/deductions/log, which the server already limits), Active first, then
// the Resigned ones with their badge. Withholding Tax and Deductions come from the latest
// issued payslip and show a dash until payslips exist; Loans is the open balance of the
// employee's deduction items. The search looks at the Employee ID and name only. A row
// opens the employee's pay items.
const DeductionLogCard = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  // The userId of the employee whose items are open
  const [openUserId, setOpenUserId] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadLog = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const { data } = await API.get("/api/deductions/log");
        if (cancelled) return;
        setRows(orderLogRows(data));
      } catch (error) {
        if (cancelled) return;
        setLoadError(refusalText(error, LOG_LOAD_ERROR));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadLog();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const filteredRows = filterLogRows(rows, searchQuery);
  const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE);
  // A reload can shorten the list: stay on a page that exists
  const page = Math.min(currentPage, Math.max(totalPages, 1));
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const pageRows = filteredRows.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const openRow = rows.find((row) => row.userId === openUserId);

  const emptyText = loading
    ? "Loading..."
    : loadError
      ? "No employees to show."
      : rows.length === 0
        ? NO_LOG_ROWS
        : NO_SEARCH_MATCH;

  return (
    <>
      <div className="deduction-toolbar">
        <div className="search-container deduction-search">
          <span className="icon-container">
            <IconSearch stroke={2} className="icon" />
          </span>

          <input
            type="text"
            aria-label="Search by Employee ID or name"
            placeholder="Search by Employee ID or name"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <div className="table-container employee-deduction-log">
        <div className="table-title">
          <p>Employee Deduction Log</p>
        </div>

        <p className="deduction-card-note">
          Withholding tax and deductions come from each employee&apos;s latest
          issued payslip. Loans is what is still owed on deductions paid in
          instalments. Open a row to see or change the employee&apos;s pay items.
        </p>

        {loadError && (
          <p className="feedback-message error" role="alert">
            {loadError}
          </p>
        )}

        <div className="table employee-deduction-table">
          <div className="table-header">
            <article className="table-header-container">
              <p>Employee ID</p>
            </article>
            <article className="table-header-container">
              <p>Employee Name</p>
            </article>
            <article className="table-header-container">
              <p>Withholding Tax</p>
            </article>
            <article className="table-header-container">
              <p>Deductions</p>
            </article>
            <article className="table-header-container">
              <p>Loans</p>
            </article>
            <article className="table-header-container">
              <p>Pay Items</p>
            </article>
          </div>

          {pageRows.map((row) => {
            const name = employeeName(row);
            const resigned = row.status === "Resigned";

            return (
              <div
                className={`table-content deduction-log-row ${resigned ? "resigned" : ""}`}
                key={row.userId}
                role="button"
                tabIndex={0}
                aria-label={`Open the pay items of ${name}`}
                onClick={() => setOpenUserId(row.userId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setOpenUserId(row.userId);
                  }
                }}
              >
                <article className="table-content-container">
                  <p>{row.employeeId || DASH}</p>
                </article>
                <article className="table-content-container deduction-name-cell">
                  <p title={name}>{name || DASH}</p>
                  {resigned && (
                    <span
                      className="deduction-status-badge resigned"
                      title={
                        row.resignationDate
                          ? `Last working day ${formatDayKey(row.resignationDate)}`
                          : "Resigned"
                      }
                    >
                      Resigned
                    </span>
                  )}
                </article>
                <article className="table-content-container">
                  <p>{moneyText(row.withholdingTax)}</p>
                </article>
                <article className="table-content-container">
                  <p>{moneyText(row.deductions)}</p>
                </article>
                <article className="table-content-container">
                  <p>{moneyText(row.loans ?? 0)}</p>
                </article>
                <article className="table-content-container">
                  <p>{itemCountText(row.itemCount)}</p>
                </article>
              </div>
            );
          })}

          {pageRows.length === 0 && <p className="no-results">{emptyText}</p>}
        </div>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {openRow && (
        <EmployeeItemsModal
          employee={openRow}
          onClose={() => setOpenUserId("")}
          onChanged={() => setReloadKey((key) => key + 1)}
        />
      )}
    </>
  );
};

export default DeductionLogCard;
