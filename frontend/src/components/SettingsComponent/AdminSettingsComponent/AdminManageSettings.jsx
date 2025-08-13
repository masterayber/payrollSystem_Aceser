import { useState, useEffect, useRef } from "react";
import {
  IconEdit,
  IconSquareRoundedX,
  IconDotsVertical,
} from "@tabler/icons-react";
import AddModal from "../../Modals/DropdownOption/AddOption/AddOption";
import EditModal from "../../Modals/DropdownOption/EditOption/EditOption";
import ConfirmModal from "../../Modals/Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Modals/Confirmed/ConfirmedMessageModal";
import Dropdown from "../../Dropdown/Dropdown";

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

const AdminManageSettings = () => {
  const [dropdownOptions, setDropdownOptions] = useState({
    designations: [],
    departments: [],
    employmentTypes: [],
    positions: [],
  });

  const [showDropdownOption, setShowDropdownOption] = useState({});
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

  const addSvgRef = useRef(null);

  useEffect(() => {
    fetchDropdowns();
  }, []);

  const fetchDropdowns = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/dropdownOption");
      const data = await res.json();

      // Ensure all expected properties exists with default empty arrays
      const safeData = {
        designations: data?.designations || [],
        departments: data?.departments || [],
        employmentTypes: data?.employmentTypes || [],
        positions: data?.positions || {},
      };

      setDropdownOptions(safeData);
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

  const toggleDropdownOption = (type, event) => {
    event.stopPropagation();
    setShowDropdownOption((prev) => ({
      ...Object.fromEntries(DROPDOWN_TYPES.map((d) => [d.key, false])),
      [type]: !prev[type],
    }));
  };

  const handleAddClick = (type, department = "") => {
    setCurrentDropdownType(type);
    setShowDropdownOption((prev) => ({
      ...prev,
      [type]: false,
    }));
    if (type === "positions") {
      setSelectedDepartment(department);
    }
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

      const baseUrl = "http://localhost:5000/api/dropdownOption";
      const url = isPositions
        ? `${baseUrl}/positions/${selectedDepartment}/${confirmAction}`
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

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Failed to ${confirmAction}`);

      await fetchDropdowns();

      setIsConfirmModalOpen(false);
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);

      setTimeout(() => setIsConfirmedMessageModalOpen(true), 300);
    } catch (error) {
      console.error(`Error during ${confirmAction}:`, error);
      alert("An error occurred while processing request.");
    }
  };

  const handleDropdownChange = (type, value) => {
    if (type === "department") {
      setSelectedDepartment(value);
    }
  };

  const getDropdownOptions = (key) => {
    return dropdownOptions[key] || [];
  };

  const getPositionsForDepartment = (department) => {
    return dropdownOptions.positions?.[department] || [];
  };

  return (
    <div className="settings-content">
      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Manage Employment Configuration</p>
        </div>

        {DROPDOWN_TYPES.map((dropdown) => (
          <div className="setting-tab-table" key={dropdown.key}>
            <div className="table-container">
              <div className="table-title">
                <p>{dropdown.label}</p>
                <div className="dots-button-container">
                  <IconDotsVertical
                    stroke={2}
                    onClick={(e) => toggleDropdownOption(dropdown.key, e)}
                    ref={addSvgRef}
                    className="dots-button"
                  />
                  {showDropdownOption[dropdown.key] && (
                    <div className="dropdown-details" ref={addSvgRef}>
                      <button
                        className="dropdown-item-details"
                        onClick={() => handleAddClick(dropdown.key)}
                      >
                        Add Option
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="table">
                <div className="table-header">
                  <article className="table-header-container">
                    <p>{dropdown.singular}</p>
                  </article>
                  <hr className="header-hr" />
                  <article className="table-header-container">
                    <p>Action</p>
                  </article>
                </div>
                {getDropdownOptions(dropdown.key).length > 0 ? (
                  dropdownOptions[dropdown.key]?.map((option, index) => (
                    <div className="table-content" key={index}>
                      <article className="table-content-container">
                        <p>{option}</p>
                      </article>
                      <article className="table-content-container">
                        <button
                          className="action-button"
                          onClick={() => handleEditClick(dropdown.key, option)}
                        >
                          <IconEdit stroke={2} />
                          Edit
                        </button>
                        <button
                          className="action-button"
                          onClick={() =>
                            handleDeleteClick(dropdown.key, option)
                          }
                        >
                          <IconSquareRoundedX stroke={2} />
                          Delete
                        </button>
                      </article>
                    </div>
                  ))
                ) : (
                  <p className="no-data">No {dropdown.singular} found.</p>
                )}
              </div>
            </div>
          </div>
        ))}

        <div className="setting-tab-table">
          <div className="table-container">
            <div className="table-title">
              <p>Position</p>
            </div>
            <div className="input-container department-dropdown-container">
              <Dropdown
                options={[
                  "--Select Department--",
                  ...dropdownOptions.departments,
                ]}
                placeholder="--Select Department--"
                value={selectedDepartment}
                onSelect={(value) => handleDropdownChange("department", value)}
              />
            </div>
            {selectedDepartment && (
              <>
                <div className="add-position-btn-container">
                  <button
                    className="action-button"
                    onClick={() =>
                      handleAddClick("positions", selectedDepartment)
                    }
                  >
                    Add Position
                  </button>
                </div>
                <div className="table">
                  <div className="table-header">
                    <article className="table-header-container">
                      <p>Positions</p>
                    </article>
                    <hr className="header-hr" />
                    <article className="table-header-container">
                      <p>Action</p>
                    </article>
                  </div>
                  {(dropdownOptions.positions?.[selectedDepartment] || [])
                    .length === 0 ? (
                    <p className="no-data">No Positions for this department.</p>
                  ) : (
                    dropdownOptions.positions[selectedDepartment].map(
                      (option, index) => (
                        <div className="table-content" key={index}>
                          <article className="table-content-container">
                            <p>{option}</p>
                          </article>
                          <article className="table-content-container">
                            <button
                              className="action-button"
                              onClick={() =>
                                handleEditClick("positions", option)
                              }
                            >
                              <IconEdit stroke={2} />
                              Edit
                            </button>
                            <button
                              className="action-button"
                              onClick={() =>
                                handleDeleteClick("positions", option)
                              }
                            >
                              <IconSquareRoundedX stroke={2} />
                              Delete
                            </button>
                          </article>
                        </div>
                      )
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {isAddModalOpen && (
        <AddModal
          title={`Add Option`}
          message={
            currentDropdownType === "positions"
              ? `Add a new position for ${selectedDepartment}:`
              : `Add a new ${
                  DROPDOWN_TYPES.find((d) => d.key === currentDropdownType)
                    ?.singular || ""
                } option:`
          }
          onClose={() => setIsAddModalOpen(false)}
          onAddOption={handleConfirmAdd}
          disabled={currentDropdownType === "positions" && !selectedDepartment}
        />
      )}

      {isEditModalOpen && (
        <EditModal
          title="Edit Option"
          message={`Edit the ${
            DROPDOWN_TYPES.find((d) => d.key === currentDropdownType)
              ?.singular || ""
          } option:`}
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
              ? `Are you sure you want to add "${optionToAdd}" as a new ${
                  DROPDOWN_TYPES.find((d) => d.key === currentDropdownType)
                    ?.singular
                }?`
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
              ? "Edited"
              : confirmAction === "delete"
              ? "Deleted"
              : "Added"
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
