import { useEffect, useState } from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
} from "@tabler/icons-react";
import API from "../../api";
import CalendarComponent from "../../components/CalendarComponent/CalendarComponent";
import Dropdown from "../../components/Dropdown/Dropdown";
import ConfirmModal from "../../components/Modals/Confirm/ConfirmModal";
import { manilaToday } from "../../utils/cutoff";
import {
  HOLIDAY_TYPE_OPTIONS,
  formatHolidayDate,
  holidayDateKey,
  holidayDayName,
  holidayTypeLabel,
} from "../../utils/holidays";
import "../../styles/AdminCSS/AdminCalendar.css";

const EMPTY_HOLIDAY_FORM = { date: "", name: "", type: "" };

// The server's own words for a refusal, or `fallback` when it sent none
const refusalText = (error, fallback) => {
  const message = error?.response?.data?.message;
  return typeof message === "string" && message.trim() !== ""
    ? message
    : fallback;
};

const AdminCalendar = () => {
  // The company holiday list (GET /api/holidays), one year at a time, from the current
  // Manila year. The page is behind the Calendar tick, and so are Save and Remove on the
  // server; the server does every check and its message is shown as it is.
  const [year, setYear] = useState(() => Number(manilaToday().slice(0, 4)));
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Raised after a save or a removal, to read the list again
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState(EMPTY_HOLIDAY_FORM);
  const [saving, setSaving] = useState(false);
  // { type: "success" | "error", text }: one under the form, one above the list
  const [formMessage, setFormMessage] = useState(null);
  const [listMessage, setListMessage] = useState(null);
  // The holiday the confirm box is asking about, and the id being removed
  const [holidayToRemove, setHolidayToRemove] = useState(null);
  const [removingId, setRemovingId] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadHolidays = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const { data } = await API.get("/api/holidays", { params: { year } });
        if (cancelled) return;
        setHolidays(Array.isArray(data) ? data : []);
      } catch (error) {
        if (cancelled) return;
        setHolidays([]);
        setLoadError(
          refusalText(error, "Could not load the holidays. Reload the page."),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadHolidays();
    return () => {
      cancelled = true;
    };
  }, [year, reloadKey]);

  // Another year's rows are dropped at once, so the old year is never shown under the new one
  const showYear = (nextYear) => {
    if (nextYear === year) return;
    setHolidays([]);
    setLoading(true);
    setYear(nextYear);
  };

  const changeYear = (offset) => {
    setFormMessage(null);
    setListMessage(null);
    showYear(year + offset);
  };

  const handleFormChange = (name, value) =>
    setForm((prev) => ({ ...prev, [name]: value }));

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setFormMessage(null);
    setListMessage(null);
    try {
      const { data } = await API.post("/api/holidays", {
        date: form.date,
        name: form.name,
        type: form.type,
      });
      const savedYear = Number(
        holidayDateKey(data?.holiday?.date || form.date).slice(0, 4),
      );

      setForm(EMPTY_HOLIDAY_FORM);
      setFormMessage({
        type: "success",
        text: data?.message || "Holiday saved.",
      });
      // A holiday saved for another year: show that year
      if (savedYear) showYear(savedYear);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setFormMessage({
        type: "error",
        text: refusalText(error, "Could not save the holiday."),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRemove = async () => {
    const holiday = holidayToRemove;
    setHolidayToRemove(null);
    if (!holiday || removingId) return;

    setRemovingId(holiday.id);
    setFormMessage(null);
    setListMessage(null);
    try {
      const { data } = await API.delete(`/api/holidays/${holiday.id}`);
      setListMessage({
        type: "success",
        text: data?.message || "Holiday removed.",
      });
    } catch (error) {
      setListMessage({
        type: "error",
        text: refusalText(error, "Could not remove the holiday."),
      });
    } finally {
      setRemovingId("");
      // Also after a refusal: "Holiday not found." means the list on screen is out of date
      setReloadKey((key) => key + 1);
    }
  };

  return (
    <div className="main-content admin-calendar-page">
      <div className="data-card admin-month-card">
        <CalendarComponent isAdmin />
      </div>

      <div className="data-card-container admin-calendar-lists">
        <div className="data-card admin-calendar-list-card">
          <div className="user-track-title">
            <p>Events</p>
            <IconDotsVertical stroke={2} />
          </div>

          <div className="table calendar-events-table">
            <div className="table-header">
              <article className="table-header-container">
                <p>Date</p>
              </article>
              <article className="table-header-container">
                <p>Day</p>
              </article>
              <article className="table-header-container">
                <p>Event</p>
              </article>
            </div>
            <div className="table-content">
              <article className="table-content-container">
                <p>03/04/25</p>
              </article>
              <article className="table-content-container">
                <p>Tuesday</p>
              </article>
              <article className="table-content-container">
                <p>PT</p>
              </article>
            </div>
            <div className="table-content">
              <article className="table-content-container">
                <p>03/06/25</p>
              </article>
              <article className="table-content-container">
                <p>Thursday</p>
              </article>
              <article className="table-content-container">
                <p>PT</p>
              </article>
            </div>
            <div className="table-content">
              <article className="table-content-container">
                <p>03/11/25</p>
              </article>
              <article className="table-content-container">
                <p>Tuesday</p>
              </article>
              <article className="table-content-container">
                <p>PT</p>
              </article>
            </div>
          </div>
        </div>

        <div className="data-card admin-calendar-list-card admin-holidays-card">
          <div className="user-track-title">
            <p>List of Holidays</p>
            <div className="calendar-year-switch">
              <button
                type="button"
                className="calendar-button"
                aria-label="Previous year"
                onClick={() => changeYear(-1)}
              >
                <IconChevronLeft stroke={2} />
              </button>
              <span className="calendar-year-label" aria-live="polite">
                {year}
              </span>
              <button
                type="button"
                className="calendar-button"
                aria-label="Next year"
                onClick={() => changeYear(1)}
              >
                <IconChevronRight stroke={2} />
              </button>
            </div>
          </div>

          <form
            className="calendar-holiday-form"
            onSubmit={handleSave}
            noValidate
          >
            <div className="input-container">
              <div className="label-container">
                <label htmlFor="holiday-date">Date</label>
              </div>
              <input
                id="holiday-date"
                type="date"
                value={form.date}
                onChange={(event) =>
                  handleFormChange("date", event.target.value)
                }
              />
            </div>
            <div className="input-container">
              <div className="label-container">
                <label htmlFor="holiday-name">Name of Holiday</label>
              </div>
              <input
                id="holiday-name"
                type="text"
                className="calendar-holiday-name"
                placeholder="Enter Name of Holiday"
                value={form.name}
                onChange={(event) =>
                  handleFormChange("name", event.target.value)
                }
              />
            </div>
            <div className="input-container">
              <div className="label-container">
                <label>Type</label>
              </div>
              <Dropdown
                options={HOLIDAY_TYPE_OPTIONS}
                placeholder="Select Type"
                value={form.type}
                onSelect={(value) => handleFormChange("type", value)}
              />
            </div>
            <button
              type="submit"
              className="btn calendar-holiday-save"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </form>

          {formMessage && (
            <p
              className={`feedback-message ${formMessage.type}`}
              role={formMessage.type === "error" ? "alert" : "status"}
            >
              {formMessage.text}
            </p>
          )}

          {loadError && (
            <p className="feedback-message error" role="alert">
              {loadError}
            </p>
          )}

          {listMessage && (
            <p
              className={`feedback-message ${listMessage.type}`}
              role={listMessage.type === "error" ? "alert" : "status"}
            >
              {listMessage.text}
            </p>
          )}

          <div className="table calendar-holidays-table">
            <div className="table-header">
              <article className="table-header-container">
                <p>Date</p>
              </article>
              <article className="table-header-container">
                <p>Day</p>
              </article>
              <article className="table-header-container">
                <p>Name of Holiday</p>
              </article>
              <article className="table-header-container">
                <p>Type</p>
              </article>
              <article className="table-header-container">
                <p>Action</p>
              </article>
            </div>

            {holidays.map((holiday) => {
              const dateKey = holidayDateKey(holiday.date);

              return (
                <div className="table-content" key={holiday.id}>
                  <article className="table-content-container">
                    <p>{formatHolidayDate(dateKey)}</p>
                  </article>
                  <article className="table-content-container">
                    <p>{holidayDayName(dateKey)}</p>
                  </article>
                  <article className="table-content-container">
                    <p title={holiday.name}>{holiday.name}</p>
                  </article>
                  <article className="table-content-container">
                    <p>{holidayTypeLabel(holiday.type)}</p>
                  </article>
                  <article className="table-content-container">
                    <button
                      type="button"
                      className="calendar-holiday-remove"
                      onClick={() => setHolidayToRemove(holiday)}
                      disabled={Boolean(removingId)}
                    >
                      {removingId === holiday.id ? "Removing..." : "Remove"}
                    </button>
                  </article>
                </div>
              );
            })}

            {holidays.length === 0 && loading && (
              <p className="calendar-holidays-empty">Loading...</p>
            )}

            {holidays.length === 0 && !loading && !loadError && (
              <p className="calendar-holidays-empty">
                No holidays for {year} yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {holidayToRemove && (
        <ConfirmModal
          title="Remove Holiday"
          message={`Remove ${holidayToRemove.name} (${formatHolidayDate(
            holidayToRemove.date,
          )}) from the list of holidays?`}
          onClose={() => setHolidayToRemove(null)}
          onConfirm={handleConfirmRemove}
          confirmText="Yes, Remove"
        />
      )}
    </div>
  );
};

export default AdminCalendar;
