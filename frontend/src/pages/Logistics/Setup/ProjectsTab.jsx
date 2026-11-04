import { useCallback, useContext, useEffect, useState } from "react";
import { IconEdit, IconPlus } from "@tabler/icons-react";
import API from "../../../api";
import { EmployeeContext } from "../../../context/EmployeeContext";
import ReservedValuesBanner from "../../../components/Logistics/ReservedValuesBanner";
import ProjectFormModal from "./ProjectFormModal";
import "../../../components/Logistics/Logistics.css";

const STATUS_LABELS = { OnHold: "On Hold" };
const statusLabel = (status) => STATUS_LABELS[status] || status || "";

const COLUMNS =
  "minmax(90px, 0.6fr) minmax(180px, 1.6fr) minmax(150px, 1.2fr) " +
  "minmax(100px, 0.7fr) minmax(160px, 1.2fr) minmax(130px, 0.9fr) minmax(110px, 0.8fr) " +
  "64px";

// Setup > Projects: the list, and the form for creating or editing one
const ProjectsTab = () => {
  const { employeeData } = useContext(EmployeeContext);
  const [projects, setProjects] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  // null = closed; "" = new project; an id = edit that project
  const [editingId, setEditingId] = useState(null);

  // Names for the In-charge column: the list carries ids only
  const nameOf = (id) => {
    const person = employeeData.find((employee) => employee._id === id);
    return person ? `${person.firstName} ${person.lastName}` : "";
  };

  const loadProjects = useCallback(async () => {
    try {
      const { data } = await API.get("/api/logistics/projects");
      setProjects(data);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Could not load the projects.",
      );
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const openForm = (id) => setEditingId(id);

  // OK on the success message: close the form and refresh the list
  const handleSaved = () => {
    setEditingId(null);
    loadProjects();
  };

  return (
    <div className="logistics-panel">
      <ReservedValuesBanner />

      <div className="logistics-toolbar">
        <p className="logistics-form-help">
          Membership is edited here; a person&apos;s role comes from their
          position in Settings.
        </p>
        <div className="logistics-actions">
          <button type="button" className="btn" onClick={() => openForm("")}>
            <IconPlus stroke={2} />
            New project
          </button>
        </div>
      </div>

      {errorMessage && <p className="feedback-message error">{errorMessage}</p>}

      <div
        className="table logistics-table"
        style={{ "--logistics-columns": COLUMNS, "--logistics-min-width": "1024px" }}
      >
        <div className="table-header">
          {[
            "Code",
            "Name",
            "Location",
            "Status",
            "In-charge",
            "Document Controllers",
            "Start date",
            "",
          ].map((title) => (
            <article className="table-header-container" key={title || "actions"}>
              <p>{title}</p>
            </article>
          ))}
        </div>

        {projects.map((project) => (
          <div className="table-content" key={project._id}>
            <article className="table-content-container">
              <p>{project.code}</p>
            </article>
            <article className="table-content-container">
              <p>{project.name}</p>
            </article>
            <article className="table-content-container">
              <p>{project.location}</p>
            </article>
            <article className="table-content-container">
              <p>
                <span
                  className={`logistics-badge ${String(project.status || "").toLowerCase()}`}
                >
                  {statusLabel(project.status)}
                </span>
              </p>
            </article>
            <article className="table-content-container">
              <p>{project.inCharge?.name || nameOf(project.inChargeId) || "—"}</p>
            </article>
            <article className="table-content-container">
              <p>{(project.documentControllerIds || []).length}</p>
            </article>
            <article className="table-content-container">
              <p>{(project.startDate || "").slice(0, 10) || "—"}</p>
            </article>
            <article className="table-content-container logistics-row-actions">
              <button
                type="button"
                className="manage-icon-button"
                title="Edit"
                aria-label={`Edit project ${project.code}`}
                onClick={() => openForm(project._id)}
              >
                <IconEdit size={18} stroke={2} />
              </button>
            </article>
          </div>
        ))}

        {projects.length === 0 && (
          <p className="logistics-empty">No projects yet.</p>
        )}
      </div>

      {editingId !== null && (
        <ProjectFormModal
          projectId={editingId || undefined}
          onClose={() => setEditingId(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default ProjectsTab;
