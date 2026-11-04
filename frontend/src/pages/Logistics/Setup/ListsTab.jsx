import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import API from "../../../api";
import AddModal from "../../../components/Modals/DropdownOption/AddOption/AddOption";
import EditModal from "../../../components/Modals/DropdownOption/EditOption/EditOption";
import ConfirmModal from "../../../components/Modals/Confirm/ConfirmModal";
import ReservedValuesBanner from "../../../components/Logistics/ReservedValuesBanner";
import "../../../components/SettingsComponent/AdminSettingsComponent/AdminManageSettings.css";
import "../../../components/Logistics/Logistics.css";

// The two dropdown fields the Logistics module adds; same routes as Settings > Manage
const LISTS = [
  { field: "itemCategories", label: "Item categories", singular: "category" },
  { field: "unitsOfMeasure", label: "Units of measure", singular: "unit" },
];

const ListCard = ({ list, options, onAdd, onEdit, onDelete }) => (
  <section className="manage-card">
    <div className="manage-card-header">
      <div className="manage-card-title">
        <h3>{list.label}</h3>
        <span className="manage-count">{options.length}</span>
      </div>
      <button type="button" className="manage-add-button" onClick={onAdd}>
        <IconPlus size={16} stroke={2.5} />
        Add
      </button>
    </div>
    {options.length === 0 ? (
      <p className="manage-empty">No {list.label.toLowerCase()} yet.</p>
    ) : (
      <ul className="manage-list">
        {options.map((option) => (
          <li className="manage-row" key={option}>
            <span className="manage-row-name" title={option}>
              {option}
            </span>
            <div className="manage-row-actions">
              <button
                type="button"
                className="manage-icon-button"
                title="Edit"
                aria-label={`Edit ${option}`}
                onClick={() => onEdit(option)}
              >
                <IconEdit size={18} stroke={2} />
              </button>
              <button
                type="button"
                className="manage-icon-button danger"
                title="Delete"
                aria-label={`Delete ${option}`}
                onClick={() => onDelete(option)}
              >
                <IconTrash size={18} stroke={2} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
);

ListCard.propTypes = {
  list: PropTypes.shape({
    field: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
  }).isRequired,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  onAdd: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

// Setup > Lists: item categories and units of measure, plus the reserved-value banner
const ListsTab = () => {
  const [lists, setLists] = useState({ itemCategories: [], unitsOfMeasure: [] });
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  // { action: "add" | "edit" | "delete", list, option }
  const [pending, setPending] = useState(null);

  const loadLists = useCallback(async () => {
    try {
      const { data } = await API.get("/api/dropdownOption");
      setLists({
        itemCategories: data?.itemCategories || [],
        unitsOfMeasure: data?.unitsOfMeasure || [],
      });
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message || "Could not load the lists.",
      );
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const start = (action, list, option = "") => {
    setErrorMessage("");
    setSuccessMessage("");
    setPending({ action, list, option });
  };

  const run = async (request, doneMessage) => {
    try {
      await request();
      setPending(null);
      setSuccessMessage(doneMessage);
      await loadLists();
    } catch (error) {
      setPending(null);
      setErrorMessage(
        error.response?.data?.message || "Could not update the list.",
      );
    }
  };

  const base = (list) => `/api/dropdownOption/${list.field}`;

  const handleAdd = (value) => {
    const option = value.trim();
    const { list } = pending;
    run(
      () => API.post(`${base(list)}/add`, { option }),
      `"${option}" added to ${list.label}.`,
    );
  };

  const handleEdit = (value) => {
    const newOption = value.trim();
    const { list, option } = pending;
    run(
      () => API.put(`${base(list)}/edit`, { oldOption: option, newOption }),
      `"${option}" changed to "${newOption}".`,
    );
  };

  const handleDelete = () => {
    const { list, option } = pending;
    run(
      () => API.delete(`${base(list)}/delete`, { data: { option } }),
      `"${option}" deleted from ${list.label}.`,
    );
  };

  return (
    <div className="logistics-panel logistics-lists manage-settings">
      <ReservedValuesBanner onSeeded={loadLists} />

      {errorMessage && <p className="feedback-message error">{errorMessage}</p>}
      {successMessage && (
        <p className="feedback-message success">{successMessage}</p>
      )}

      <div className="manage-grid">
        {LISTS.map((list) => (
          <ListCard
            key={list.field}
            list={list}
            options={lists[list.field]}
            onAdd={() => start("add", list)}
            onEdit={(option) => start("edit", list, option)}
            onDelete={(option) => start("delete", list, option)}
          />
        ))}
      </div>

      {pending?.action === "add" && (
        <AddModal
          title={`Add ${pending.list.singular}`}
          message={`Add a new ${pending.list.singular}:`}
          onClose={() => setPending(null)}
          onAddOption={handleAdd}
        />
      )}

      {pending?.action === "edit" && (
        <EditModal
          title={`Edit ${pending.list.singular}`}
          message={`Edit the ${pending.list.singular}:`}
          currentOption={pending.option}
          onClose={() => setPending(null)}
          onEditOption={handleEdit}
          confirmText="Save"
          cancelText="Cancel"
        />
      )}

      {pending?.action === "delete" && (
        <ConfirmModal
          title="Confirm Delete"
          message={`Delete "${pending.option}" from ${pending.list.label}?`}
          onClose={() => setPending(null)}
          onConfirm={handleDelete}
          confirmText="Yes, Delete"
          cancelText="No"
        />
      )}
    </div>
  );
};

export default ListsTab;
