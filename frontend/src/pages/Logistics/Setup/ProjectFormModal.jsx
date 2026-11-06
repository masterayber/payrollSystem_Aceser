import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import API from "../../../api";
import Dropdown from "../../../components/Dropdown/Dropdown";
import ConfirmModal from "../../../components/Modals/Confirm/ConfirmModal";
import CancelModal from "../../../components/Modals/Cancel/CancelModal";
import ConfirmedMessageModal from "../../../components/Modals/Confirmed/ConfirmedMessageModal";
import "../../../components/Modals/Modal.css";
import "../../../components/Logistics/Logistics.css";

const STATUS_OPTIONS = [
  { label: "Active", value: "Active" },
  { label: "On Hold", value: "OnHold" },
  { label: "Completed", value: "Completed" },
  { label: "Closed", value: "Closed" },
];

const EMPTY_FORM = {
  code: "",
  name: "",
  location: "",
  status: "Active",
  startDate: "",
  remarks: "",
  inChargeId: "",
  documentControllerIds: [],
};

// Same values, ignoring the order the document controllers were ticked in
const sameForm = (a, b) =>
  Object.keys(EMPTY_FORM).every((key) =>
    Array.isArray(a[key])
      ? [...a[key]].sort().join(",") === [...b[key]].sort().join(",")
      : a[key] === b[key],
  );

const IN_CHARGE = "Project In-charge";
const DOCUMENT_CONTROLLER = "Document Controller";

// One warning line per current member who no longer fits the seat
const memberWarnings = (member, position) => {
  if (!member) return [];
  const lines = [];
  if (member.positionMatches === false) {
    lines.push(`${member.name} no longer holds the position ${position}`);
  }
  if (member.accountActive === false) {
    lines.push(`${member.name}'s account is not active`);
  }
  return lines;
};

// Eligible people plus the current members, so a flagged member still shows
const withCurrent = (eligible, current) => {
  const seen = new Set(eligible.map((person) => person._id));
  const extra = current.filter((person) => person && !seen.has(person._id));
  return [...eligible, ...extra];
};

// The server's required-field checks, in its order, so an incomplete form
// shows the message instead of opening the confirm. "" when the form passes.
const projectFormError = (form) => {
  if (!/^[A-Z0-9]{2,8}$/.test(form.code.trim().toUpperCase())) {
    return "Project code must be 2 to 8 letters or numbers.";
  }
  if (!form.name.trim()) return "Project name is required.";
  if (!form.location.trim()) return "Location is required.";
  return "";
};

// Create (projectId null) or edit a project, with the In-charge and Document
// Controller pickers filtered by position on the server
const ProjectFormModal = ({ projectId, onClose, onSaved }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  // What the form started with, to tell whether Cancel would lose changes
  const [initialForm, setInitialForm] = useState(EMPTY_FORM);
  const [inChargeOptions, setInChargeOptions] = useState([]);
  const [controllerOptions, setControllerOptions] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [savedProject, setSavedProject] = useState(null);
  // Set at once (state lands a render later), so a double click or a second
  // Enter can't send the project twice
  const savingRef = useRef(false);

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const eligible = (position) =>
          API.get("/api/logistics/projects/eligible", { params: { position } });
        const [inChargeRes, controllerRes, detailRes] = await Promise.all([
          eligible(IN_CHARGE),
          eligible(DOCUMENT_CONTROLLER),
          projectId ? API.get(`/api/logistics/projects/${projectId}`) : null,
        ]);
        if (cancelled) return;

        const detail = detailRes?.data;
        const currentControllers = detail?.documentControllers || [];
        setInChargeOptions(
          withCurrent(inChargeRes.data, detail?.inCharge ? [detail.inCharge] : []),
        );
        setControllerOptions(
          withCurrent(controllerRes.data, currentControllers),
        );

        if (detail) {
          // Only the members the server could name: a hidden (Super Admin or
          // Admin) or deleted account is left out, so it never shows as a raw
          // id and the next save drops it
          const loaded = {
            code: detail.code || "",
            name: detail.name || "",
            location: detail.location || "",
            status: detail.status || "Active",
            startDate: (detail.startDate || "").slice(0, 10),
            remarks: detail.remarks || "",
            inChargeId: detail.inCharge?._id || "",
            documentControllerIds: currentControllers.map((member) => member._id),
          };
          setForm(loaded);
          setInitialForm(loaded);
          setWarnings([
            ...memberWarnings(detail.inCharge, IN_CHARGE),
            ...currentControllers.flatMap((member) =>
              memberWarnings(member, DOCUMENT_CONTROLLER),
            ),
          ]);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error.response?.data?.message || "Could not load the project.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const setField = (name, value) =>
    setForm((prev) => ({ ...prev, [name]: value }));

  const handleChange = (event) => {
    const { name, value } = event.target;
    setField(name, name === "code" ? value.toUpperCase() : value);
  };

  const toggleController = (id) => {
    setForm((prev) => {
      const ids = prev.documentControllerIds.includes(id)
        ? prev.documentControllerIds.filter((other) => other !== id)
        : [...prev.documentControllerIds, id];
      return { ...prev, documentControllerIds: ids };
    });
  };

  const hasChanges = !sameForm(form, initialForm);

  const handleCancelClick = () => {
    if (hasChanges) setIsCancelOpen(true);
    else onClose();
  };

  // Save (or Enter in a field) checks the required fields, then asks first.
  // Ignored while loading or saving, or while a confirm, cancel or success
  // message is open, so Enter behind a dialog does nothing.
  const handleSubmit = (event) => {
    event.preventDefault();
    if (
      loading ||
      saving ||
      savingRef.current ||
      isConfirmOpen ||
      isCancelOpen ||
      successMessage
    ) {
      return;
    }
    const formError = projectFormError(form);
    setErrorMessage(formError);
    if (formError) return;
    setIsConfirmOpen(true);
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setErrorMessage("");
    const body = {
      code: form.code.trim(),
      name: form.name.trim(),
      location: form.location.trim(),
      status: form.status,
      startDate: form.startDate,
      remarks: form.remarks.trim(),
      inChargeId: form.inChargeId || null,
      documentControllerIds: form.documentControllerIds,
    };
    try {
      const { data } = projectId
        ? await API.put(`/api/logistics/projects/${projectId}`, body)
        : await API.post("/api/logistics/projects", body);
      const code = data?.code || body.code;
      setIsConfirmOpen(false);
      setSavedProject(data);
      setTimeout(
        () =>
          setSuccessMessage(
            projectId
              ? `Project ${code} updated successfully`
              : `Project ${code} added successfully`,
          ),
        300,
      );
    } catch (error) {
      setIsConfirmOpen(false);
      setErrorMessage(
        error.response?.data?.message || "Could not save the project.",
      );
      savingRef.current = false;
      setSaving(false);
    }
  };

  const confirmCode = form.code.trim();

  const inChargeChoices = [
    { label: "None", value: "" },
    ...inChargeOptions.map((person) => ({
      label: person.name,
      value: person._id,
    })),
  ];

  return ReactDOM.createPortal(
    <div className="modal">
      <div
        className="modal-content logistics-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-form-title"
      >
        <h3 id="project-form-title">
          {projectId ? "Edit project" : "New project"}
        </h3>

        <form onSubmit={handleSubmit}>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="form-container">
              <div className="input-row">
                <div className="input-container">
                  <div className="label-container">
                    <label htmlFor="project-code">Code</label>{" "}
                    <span className="required">*</span>
                  </div>
                  <div className="input-group-signup">
                    <input
                      id="project-code"
                      type="text"
                      name="code"
                      placeholder="ACE01"
                      value={form.code}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                  <p className="logistics-form-help">
                    2 to 8 letters or numbers; it numbers the project&apos;s
                    documents and can&apos;t change once they exist.
                  </p>
                </div>

                <div className="input-container">
                  <div className="label-container">
                    <label htmlFor="project-name">Name</label>{" "}
                    <span className="required">*</span>
                  </div>
                  <div className="input-group-signup">
                    <input
                      id="project-name"
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              <div className="input-row">
                <div className="input-container">
                  <div className="label-container">
                    <label htmlFor="project-location">Location</label>{" "}
                    <span className="required">*</span>
                  </div>
                  <div className="input-group-signup">
                    <input
                      id="project-location"
                      type="text"
                      name="location"
                      value={form.location}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="input-container">
                  <div className="label-container">
                    <label>Status</label>
                  </div>
                  <Dropdown
                    options={STATUS_OPTIONS}
                    value={form.status}
                    onSelect={(value) => setField("status", value)}
                  />
                </div>
              </div>

              <div className="input-row">
                <div className="input-container">
                  <div className="label-container">
                    <label htmlFor="project-start">Start date</label>
                  </div>
                  <div className="input-group-signup">
                    <input
                      id="project-start"
                      type="date"
                      name="startDate"
                      value={form.startDate}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="input-container">
                  <div className="label-container">
                    <label htmlFor="project-remarks">Remarks</label>
                  </div>
                  <div className="input-group-signup">
                    <input
                      id="project-remarks"
                      type="text"
                      name="remarks"
                      value={form.remarks}
                      onChange={handleChange}
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              <div className="input-row">
                <div className="input-container">
                  <div className="label-container">
                    <label>In-charge</label>
                  </div>
                  <Dropdown
                    options={inChargeChoices}
                    placeholder="Pick the Project In-charge"
                    value={form.inChargeId}
                    onSelect={(value) => setField("inChargeId", value)}
                  />
                  <p className="logistics-form-help">
                    Employees whose position is Project In-charge.
                  </p>
                </div>

                <div className="input-container">
                  <div className="label-container">
                    <label>Document Controllers</label>
                  </div>
                  {controllerOptions.length === 0 ? (
                    <p className="logistics-form-help">
                      No employee holds the position Document Controller.
                    </p>
                  ) : (
                    <div className="logistics-checklist">
                      {controllerOptions.map((person) => (
                        <label key={person._id} className="logistics-check-option">
                          <input
                            type="checkbox"
                            className="modal-checkbox"
                            checked={form.documentControllerIds.includes(
                              person._id,
                            )}
                            onChange={() => toggleController(person._id)}
                            disabled={saving}
                          />
                          <span>{person.name}</span>
                          <span className="logistics-check-meta">
                            {person.employeeId || person.position || ""}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {warnings.length > 0 && (
                <ul className="logistics-member-notes">
                  {warnings.map((line) => (
                    <li key={line} className="feedback-message warning">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {errorMessage && (
            <p className="feedback-message error">{errorMessage}</p>
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
              disabled={loading || saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>

      {isCancelOpen && (
        <CancelModal
          title="Cancel Changes"
          message={
            projectId
              ? "Are you sure you want to cancel editing this project?"
              : "Are you sure you want to cancel adding this project?"
          }
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
          title={projectId ? "Confirm Changes" : "Confirm New Project"}
          message={
            projectId
              ? `Are you sure you want to edit project ${confirmCode}?`
              : `Are you sure you want to add project ${confirmCode} (${form.name.trim()})?`
          }
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleSave}
          cancelText="No"
          confirmText={projectId ? "Yes, Edit" : "Yes, Add"}
        />
      )}

      {successMessage && (
        <ConfirmedMessageModal
          message={successMessage}
          onClose={() => onSaved(savedProject)}
        />
      )}
    </div>,
    document.body,
  );
};

ProjectFormModal.propTypes = {
  projectId: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  // Called with the saved project (detail shape)
  onSaved: PropTypes.func.isRequired,
};

export default ProjectFormModal;
