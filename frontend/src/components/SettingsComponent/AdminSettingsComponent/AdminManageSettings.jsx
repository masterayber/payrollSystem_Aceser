import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { IconEdit, IconPlus, IconTrash } from "@tabler/icons-react";
import API from "../../../api";
import AddModal from "../../Modals/DropdownOption/AddOption/AddOption";
import EditModal from "../../Modals/DropdownOption/EditOption/EditOption";
import ConfirmModal from "../../Modals/Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Modals/Confirmed/ConfirmedMessageModal";
import Dropdown from "../../Dropdown/Dropdown";
import "./AdminManageSettings.css";

const DROPDOWN_TYPES = [
  {
    key: "designations",
    label: "Designations",
    singular: "Designation",
    api: "designations",
  },
  {
    key: "departments",
    label: "Departments",
    singular: "Department",
    api: "departments",
  },
  {
    key: "employmentTypes",
    label: "Employment Types",
    singular: "Employment Type",
    api: "employmentTypes",
  },
  // Add dropdowns here when needed
];

const singularOf = (type) =>
  type === "positions"
    ? "Position"
    : DROPDOWN_TYPES.find((d) => d.key === type)?.singular || "";

// The rows of one card; Edit and Delete are icon buttons labelled for screen readers
const OptionList = ({ options, emptyText, onEdit, onDelete }) => {
  if (options.length === 0) {
    return <p className="manage-empty">{emptyText}</p>;
  }

  return (
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
  );
};

OptionList.propTypes = {
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
  emptyText: PropTypes.string.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

const AdminManageSettings = () => {
  const [dropdownOptions, setDropdownOptions] = useState({
    designations: [],
    departments: [],
    employmentTypes: [],
    positions: {},
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedMessageModalOpen, setIsConfirmedMessageModalOpen] =
    useState(false);

  const [currentDropdownType, setCurrentDropdownType] = useState("");
  const [optionToAdd, setOptionToAdd] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [confirmAction, setConfirmAction] = useState(""); // ADD | EDIT | DELETE

  // Positions Management
  const [selectedDepartment, setSelectedDepartment] = useState("");

  useEffect(() => {
    fetchDropdowns();
  }, []);

  const fetchDropdowns = async () => {
    try {
      const { data } = await API.get("/api/dropdownOption");

      // Ensure all expected properties exists with default empty arrays
      const safeData = {
        designations: data?.designations || [],
        departments: data?.departments || [],
        employmentTypes: data?.employmentTypes || [],
        positions: data?.positions || {},
      };

      setDropdownOptions(safeData);
      // Clear the picked department once it's renamed or deleted
      setSelectedDepartment((prev) =>
        safeData.departments.includes(prev) ? prev : "",
      );
    } catch (error) {
      console.error("Error fetching dropdowns:", error);
      // Set Default empty state on error
      setDropdownOptions({
        designations: [],
        departments: [],
        employmentTypes: [],
        positions: {},
      });
    }
  };

  const handleAddClick = (type) => {
    setCurrentDropdownType(type);
    setIsAddModalOpen(true);
  };

  const handleEditClick = (type, option) => {
    setCurrentDropdownType(type);
    setSelectedOption(option);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (type, option) => {
    setCurrentDropdownType(type);
    setSelectedOption(option);
    setConfirmAction("delete");
    setIsConfirmModalOpen(true);
  };

  const handleConfirmAdd = (newOption) => {
    setOptionToAdd(newOption);
    setConfirmAction("add");
    setIsConfirmModalOpen(true);
  };

  const handleConfirmEdit = (newOption) => {
    setOptionToAdd(newOption);
    setConfirmAction("edit");
    setIsConfirmModalOpen(true);
  };

  const handleConfirmedAction = async () => {
    try {
      if (confirmAction === "add" && !optionToAdd?.trim()) {
        alert("Please enter a valid option.");
        return;
      }

      const isPositions = currentDropdownType === "positions";

      if (isPositions && !selectedDepartment) {
        alert("Please select a department");
        return;
      }

      const dropdownMeta = !isPositions
        ? DROPDOWN_TYPES.find((d) => d.key === currentDropdownType)
        : null;
      if (!isPositions && !dropdownMeta) return;

      const baseUrl = "/api/dropdownOption";
      const url = isPositions
        ? `${baseUrl}/positions/${encodeURIComponent(selectedDepartment)}/${confirmAction}`
        : `${baseUrl}/${dropdownMeta.api}/${confirmAction}`;

      const bodyMap = {
        add: isPositions
          ? { option: optionToAdd.trim(), department: selectedDepartment }
          : { option: optionToAdd.trim() },
        edit: isPositions
          ? {
              oldOption: selectedOption,
              newOption: optionToAdd.trim(),
              department: selectedDepartment,
            }
          : { oldOption: selectedOption, newOption: optionToAdd.trim() },
        delete: { option: selectedOption },
      };

      const methodMap = {
        add: "POST",
        edit: "PUT",
        delete: "DELETE",
      };

      const method = methodMap[confirmAction];
      const body = bodyMap[confirmAction];

      if (!method || !body) {
        alert("Invalid Action.");
        return;
      }

      await API.request({ url, method, data: body });

      await fetchDropdowns();

      setIsConfirmModalOpen(false);
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);

      setTimeout(() => setIsConfirmedMessageModalOpen(true), 300);
    } catch (error) {
      console.error(`Error during ${confirmAction}:`, error);
      alert(
        error.response?.data?.message ||
          "An error occurred while processing request.",
      );
    }
  };

  const hasDepartments = dropdownOptions.departments.length > 0;
  const positionOptions = selectedDepartment
    ? dropdownOptions.positions[selectedDepartment] || []
    : [];
  const positionsEmptyText = !hasDepartments
    ? "Add a department first."
    : selectedDepartment
      ? `No positions in ${selectedDepartment} yet.`
      : "Pick a department to see its positions.";

  return (
    <div className="settings-content manage-settings">
      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Manage Employment Configuration</p>
        </div>

        <div className="manage-grid">
          {DROPDOWN_TYPES.map((dropdown) => {
            const options = dropdownOptions[dropdown.key] || [];

            return (
              <section className="manage-card" key={dropdown.key}>
                <div className="manage-card-header">
                  <div className="manage-card-title">
                    <h3>{dropdown.label}</h3>
                    <span className="manage-count">{options.length}</span>
                  </div>
                  <button
                    type="button"
                    className="manage-add-button"
                    onClick={() => handleAddClick(dropdown.key)}
                  >
                    <IconPlus size={16} stroke={2.5} />
                    Add
                  </button>
                </div>
                <OptionList
                  options={options}
                  emptyText={`No ${dropdown.label.toLowerCase()} yet.`}
                  onEdit={(option) => handleEditClick(dropdown.key, option)}
                  onDelete={(option) => handleDeleteClick(dropdown.key, option)}
                />
              </section>
            );
          })}

          <section className="manage-card">
            <div className="manage-card-header">
              <div className="manage-card-title">
                <h3>Positions</h3>
                {selectedDepartment && (
                  <span className="manage-count">{positionOptions.length}</span>
                )}
              </div>
              <button
                type="button"
                className="manage-add-button"
                onClick={() => handleAddClick("positions")}
                disabled={!selectedDepartment}
                title={selectedDepartment ? undefined : "Pick a department first"}
              >
                <IconPlus size={16} stroke={2.5} />
                Add
              </button>
            </div>
            <div className="manage-department-picker">
              <p>Department</p>
              <Dropdown
                options={dropdownOptions.departments}
                placeholder="Select a department"
                value={selectedDepartment}
                onSelect={setSelectedDepartment}
              />
            </div>
            <OptionList
              options={positionOptions}
              emptyText={positionsEmptyText}
              onEdit={(option) => handleEditClick("positions", option)}
              onDelete={(option) => handleDeleteClick("positions", option)}
            />
          </section>
        </div>
      </div>

      {isAddModalOpen && (
        <AddModal
          title={`Add ${singularOf(currentDropdownType)}`}
          message={
            currentDropdownType === "positions"
              ? `Add a new position for ${selectedDepartment}:`
              : `Add a new ${singularOf(currentDropdownType)} option:`
          }
          onClose={() => setIsAddModalOpen(false)}
          onAddOption={handleConfirmAdd}
          disabled={currentDropdownType === "positions" && !selectedDepartment}
        />
      )}

      {isEditModalOpen && (
        <EditModal
          title={`Edit ${singularOf(currentDropdownType)}`}
          message={
            currentDropdownType === "positions"
              ? `Edit the position in ${selectedDepartment}:`
              : `Edit the ${singularOf(currentDropdownType)} option:`
          }
          onClose={() => setIsEditModalOpen(false)}
          onEditOption={handleConfirmEdit}
          confirmText="Edit"
          cancelText="Cancel"
          currentOption={selectedOption}
        />
      )}

      {isConfirmModalOpen && (
        <ConfirmModal
          title={`Confirm ${
            confirmAction.charAt(0).toUpperCase() + confirmAction.slice(1)
          }`}
          message={
            currentDropdownType === "positions"
              ? confirmAction === "add"
                ? `Are you sure you want to add ${optionToAdd} to the ${selectedDepartment} department?`
                : confirmAction === "edit"
                  ? `Are you sure you want to change ${selectedOption} to ${optionToAdd} in the ${selectedDepartment} department?`
                  : `Are you sure you want to delete ${selectedOption} from the ${selectedDepartment} department?`
              : confirmAction === "add"
                ? `Are you sure you want to add "${optionToAdd}" as a new ${singularOf(currentDropdownType)}?`
                : confirmAction === "edit"
                  ? `Are you sure you want to change "${selectedOption}" to "${optionToAdd}"?`
                  : `Are you sure you want to delete "${selectedOption}"?`
          }
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={handleConfirmedAction}
        />
      )}

      {isConfirmedMessageModalOpen && (
        <ConfirmedMessageModal
          title={`Option ${
            confirmAction === "edit"
              ? "Edited Successfully"
              : confirmAction === "delete"
                ? "Deleted Successfully"
                : "Added Successfully"
          }`}
          message={
            currentDropdownType === "positions"
              ? confirmAction === "edit"
                ? `"${selectedOption}" has been changed to "${optionToAdd}" in the "${selectedDepartment}" department successfully!`
                : confirmAction === "delete"
                  ? `"${selectedOption}" has been deleted from the "${selectedDepartment}" department successfully!`
                  : `"${optionToAdd}" has been added to the "${selectedDepartment}" department successfully!`
              : confirmAction === "edit"
                ? `"${selectedOption}" has been changed to "${optionToAdd}" successfully!`
                : confirmAction === "delete"
                  ? `"${selectedOption}" has been deleted successfully!`
                  : `"${optionToAdd}" has been added successfully!`
          }
          onClose={() => setIsConfirmedMessageModalOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminManageSettings;
