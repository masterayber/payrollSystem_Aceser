import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import XLSX from "xlsx-js-style";
import { IconEye, IconEyeClosed } from "@tabler/icons-react";
import API from "../../api";
import Dropdown from "../Dropdown/Dropdown";
import { formatPeso } from "../../utils/money";
import {
  CUTOFF_NOTE,
  YEAR_END_NOTE,
  asOfNote,
  basisNote,
  cutoffColumnLabel,
  flagLabels,
  getThirteenthMonthYearOptions,
  groupCutoffsByMonth,
  incompleteNote,
  isProjectedCutoff,
  totalsLabel,
} from "../../utils/thirteenthMonth";
import { ThirteenthMonthSheet } from "../../utils/reports/thirteenthMonth";

const DASH = "—";

const FIXED_COLUMNS = [
  "Employee ID",
  "Name",
  "Type",
  "Status",
  "Start date",
  "Last working day",
  "Monthly basic",
];
const SUMMARY_COLUMNS = ["Computed", "Projected", "Total for the year", "Notes"];

// Monthly basic stays hidden until the eye button is pressed, like Basic pay on the profile
const SecretAmount = ({ label, value }) => {
  const [isShown, setIsShown] = useState(false);
  if (!value) return null;

  return (
    <span className="thirteenth-secret">
      <span>{isShown ? value : "₱ •••••••"}</span>
      <button
        type="button"
        className="thirteenth-secret-toggle"
        aria-label={isShown ? `Hide ${label}` : `Show ${label}`}
        onClick={() => setIsShown(!isShown)}
      >
        {isShown ? (
          <IconEye stroke={2} size={16} />
        ) : (
          <IconEyeClosed stroke={2} size={16} />
        )}
      </button>
    </span>
  );
};

SecretAmount.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
};

const CutoffCell = ({ cell }) => {
  if (!cell) return <td />;
  if (cell.kind === "none") return <td className="is-none">{DASH}</td>;
  return (
    <td className={`amount ${cell.kind === "projected" ? "is-projected" : ""}`}>
      {formatPeso(cell.amount)}
    </td>
  );
};

CutoffCell.propTypes = {
  cell: PropTypes.shape({
    kind: PropTypes.string,
    amount: PropTypes.number,
  }),
};

// "13th Month Pay" card on the admin Reports page. Every amount comes from the server.
const ThirteenthMonthReport = () => {
  const yearOptions = getThirteenthMonthYearOptions();
  const [year, setYear] = useState(yearOptions[0].value);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let ignore = false;

    const fetchReport = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const { data } = await API.get("/api/thirteenth-month", {
          params: { year },
        });
        if (!ignore) setReport(data);
      } catch (error) {
        if (ignore) return;
        setReport(null);
        setErrorMessage(
          error.response?.data?.message ||
            "Could not load the 13th month pay.",
        );
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchReport();
    return () => {
      ignore = true;
    };
  }, [year]);

  const handleDownload = () => {
    const { ws } = ThirteenthMonthSheet(report);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, `13th Month ${report.year}`);
    XLSX.writeFile(workbook, `13th_Month_${report.year}.xlsx`);
  };

  const cutoffs = report?.cutoffs || [];
  const months = groupCutoffsByMonth(cutoffs);
  const columnCount =
    FIXED_COLUMNS.length + cutoffs.length + SUMMARY_COLUMNS.length;
  const note = [
    report ? asOfNote(report.asOf) : "",
    CUTOFF_NOTE,
    report ? basisNote(report.payHistoryStart) : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="data-card reports-export-card thirteenth-card"
      aria-busy={loading}
    >
      <div className="user-track-title">
        <p>13th Month Pay</p>
      </div>

      <div className="user-track-description reports-description">
        <p>{note}</p>
        <div className="reports-actions thirteenth-actions">
          <label className="reports-label">
            <p>Year</p>
            <Dropdown
              options={yearOptions}
              placeholder="Select Year"
              value={year}
              onSelect={setYear}
            />
          </label>
          <button
            type="button"
            className="btn reports-download-button"
            disabled={loading || !report}
            onClick={handleDownload}
          >
            {loading ? "Preparing..." : "Download 13th Month"}
          </button>
        </div>
      </div>

      {errorMessage && <p className="feedback-message error">{errorMessage}</p>}

      {!report && loading && <p className="thirteenth-status">Loading...</p>}

      {report && (
        <>
          <div className="thirteenth-table-wrap">
            <table className="thirteenth-table">
              <thead>
                <tr>
                  {FIXED_COLUMNS.map((label) => (
                    <th key={label} rowSpan={2} scope="col">
                      {label}
                    </th>
                  ))}
                  {months.map((month) => (
                    <th
                      key={month.month}
                      colSpan={month.cutoffs.length}
                      scope="colgroup"
                      className="month"
                    >
                      {month.label}
                    </th>
                  ))}
                  {SUMMARY_COLUMNS.map((label) => (
                    <th key={label} rowSpan={2} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {cutoffs.map((cutoff) => (
                    <th key={cutoff.cutoff} scope="col" className="half">
                      {cutoffColumnLabel(cutoff)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {report.rows.length === 0 && (
                  <tr>
                    <td colSpan={columnCount} className="is-muted">
                      No employees are included in {report.year}.
                    </td>
                  </tr>
                )}

                {/* The server's order (by Employee ID); Resigned rows stay in place */}
                {report.rows.map((row) => (
                  <tr
                    key={row.userId}
                    className={row.status === "Resigned" ? "resigned" : ""}
                  >
                    <td>{row.employeeId}</td>
                    <td className="name">{row.name}</td>
                    <td>{row.employmentType}</td>
                    <td>
                      <span
                        className={`thirteenth-status-badge ${row.status === "Resigned" ? "resigned" : ""}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>{row.startDate || ""}</td>
                    <td>{row.lastWorkingDay || ""}</td>
                    <td className="amount">
                      <SecretAmount
                        label={`monthly basic of ${row.name}`}
                        value={formatPeso(row.monthlyBasic)}
                      />
                    </td>
                    {cutoffs.map((cutoff, i) => (
                      <CutoffCell
                        key={cutoff.cutoff}
                        cell={
                          row.cutoffs.find(
                            (item) => item.cutoff === cutoff.cutoff,
                          ) || row.cutoffs[i]
                        }
                      />
                    ))}
                    <td className="amount">{formatPeso(row.computed)}</td>
                    <td className="amount">{formatPeso(row.projected)}</td>
                    <td className="amount total">{formatPeso(row.total)}</td>
                    <td className="notes">
                      {row.flags.length > 0 && (
                        <Link
                          to={`/employees/${row.userId}`}
                          title={`Open ${row.name}'s profile`}
                        >
                          {flagLabels(row.flags).join(", ")}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <th colSpan={FIXED_COLUMNS.length} scope="row">
                    {totalsLabel(report.totals.employees)}
                  </th>
                  {cutoffs.map((cutoff, i) => (
                    <td
                      key={cutoff.cutoff}
                      className={`amount ${isProjectedCutoff(cutoff, report.asOf) ? "is-projected" : ""}`}
                    >
                      {formatPeso(report.totals.byCutoff[i])}
                    </td>
                  ))}
                  <td className="amount">
                    {formatPeso(report.totals.computed)}
                  </td>
                  <td className="amount">
                    {formatPeso(report.totals.projected)}
                  </td>
                  <td className="amount total">
                    {formatPeso(report.totals.total)}
                  </td>
                  <td className="notes">
                    {report.incomplete > 0 &&
                      incompleteNote(report.incomplete)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <ul className="thirteenth-legend">
            <li>
              <span className="is-projected">Grey italics</span>: projected
              (cut-off not yet ended).
            </li>
            <li>{DASH}: not employed during that cut-off.</li>
            <li>{YEAR_END_NOTE}</li>
          </ul>
        </>
      )}
    </div>
  );
};

export default ThirteenthMonthReport;
