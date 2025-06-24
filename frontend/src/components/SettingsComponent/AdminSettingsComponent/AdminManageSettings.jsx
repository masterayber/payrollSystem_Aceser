import { useState, useEffect, useRef } from "react";
import {
  IconEdit,
  IconSquareRoundedX,
  IconDotsVertical,
  IconUserCog,
} from "@tabler/icons-react";
import AddModal from "../../Modals/DropdownOption/AddOption/AddOption";
import EditModal from "../../Modals/DropdownOption/EditOption/EditOption";
import ManageModal from "../../Modals/DropdownOption/ManagePosition/ManagePosition";
import ConfirmModal from "../../Modals/Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Modals/Confirmed/ConfirmedMessageModal";

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
    positions: [],
    employmentTypes: [],
  });

  const [showDropdownOption, setShowDropdownOption] = useState({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isManagePositionModalOpen, setIsManagePositionModalOpen] =
    useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedMessageModalOpen, setIsConfirmedMessageModalOpen] =
    useState(false);

  const [currentDropdownType, setCurrentDropdownType] = useState("");
  const [optionToAdd, setOptionToAdd] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [confirmAction, setConfirmAction] = useState(""); // ADD | EDIT | DELETE

  // Positions Management
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [positions, setPositions] = useState("");
  // const [isPositionAddModalOpen, setIsPositionAddModalOpen] = useState(false);
  // const [isPositionEditModalOpen, setIsPositionEditModalOpen] = useState(false);
  // const [positionToAdd, setPositionToAdd] = useState("");
  // const [selectedPosition, setSelectedPosition] = useState("");
  // const [positionToEdit, setPositionToEdit] = useState("");

  const addSvgRef = useRef(null);

  useEffect(() => {
    fetchDropdowns();
  }, []);

  useEffect(() => {
    if (selectedDepartment) {
      fetchPositions(selectedDepartment);
    } else {
      setPositions([]);
    }
  }, [selectedDepartment]);

  const fetchDropdowns = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/dropdownOption");
      const data = await res.json();
      setDropdownOptions(data);
    } catch (error) {
      console.error("Error fetching dropdowns:", error);
    }
  };

  const fetchPositions = async (department) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/dropdownOption/positions/${department}`
      );
      const data = await res.json();
      setPositions(data.positions || []);
    } catch {
      setPositions([]);
    }
  };

  const toggleDropdownOption = (type, event) => {
    event.stopPropagation();
    setShowDropdownOption((prev) => ({
      ...Object.fromEntries(DROPDOWN_TYPES.map((d) => [d.key, false])),
      [type]: !prev[type],
    }));
  };

  const handleAddClick = (type) => {
    setCurrentDropdownType(type);
    setShowDropdownOption((prev) => ({
      ...prev,
      [type]: false,
    }));
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

  const handleManageClick = () => {
    setIsManagePositionModalOpen(true);
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
      const dropdownMeta = DROPDOWN_TYPES.find(
        (d) => d.key === currentDropdownType
      );
      if (!dropdownMeta) return;

      let url = `http://localhost:5000/api/dropdownOption/${dropdownMeta.api}`;
      let method = "PUT";
      let body = {};
      if (confirmAction === "add") {
        url += "/add";
        body = { option: optionToAdd };
      } else if (confirmAction === "edit") {
        url += "/edit";
        body = { oldOption: selectedOption, newOption: optionToAdd };
      } else if (confirmAction === "delete") {
        url += "/delete";
        method = "DELETE";
        body = { option: selectedOption };
      }

      console.log("API URL:", url);
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to process action");

      await fetchDropdowns();

      setIsConfirmModalOpen(false);
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);

      setTimeout(() => setIsConfirmedMessageModalOpen(true), 300);
    } catch (error) {
      console.error(`Error during ${confirmAction}:`, error);
    }
  };

  const departmentsIndex = DROPDOWN_TYPES.findIndex(
    (d) => d.key === "departments"
  );

  return (
    <div className="settings-content">
      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Manage Employment Configuration</p>
        </div>

        {DROPDOWN_TYPES.slice(0, departmentsIndex + 1).map((dropdown) => (
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
                {dropdownOptions[dropdown.key]?.map((option, index) => (
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
                        onClick={() => handleDeleteClick(dropdown.key, option)}
                      >
                        <IconSquareRoundedX stroke={2} />
                        Delete
                      </button>
                    </article>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        <div className="setting-tab-table">
          <div className="table-container">
            <div className="table-title">
              <p>Positions</p>
            </div>
            <div className="manage-position">
              <p>Manage Position:</p>
              <button
                className="action-button"
                onClick={() => handleManageClick()}
              >
                <IconUserCog stroke={2} />
                Manage
              </button>
            </div>
          </div>
        </div>
      </div>

      {isAddModalOpen && (
        <AddModal
          title={`Add Option`}
          message={`Add a new ${
            DROPDOWN_TYPES.find((d) => d.key === currentDropdownType)
              ?.singular || ""
          } option:`}
          onClose={() => setIsAddModalOpen(false)}
          onAddOption={handleConfirmAdd}
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

      {isManagePositionModalOpen && (
        <ManageModal
          title="Manage Positions"
          message={`Select a department to edit the positions:`}
          cancelText="Cancel"
          confirmText="Save"
          onClose={() => setIsManagePositionModalOpen(false)}
          departments={dropdownOptions.departments}
          selectedDepartment={selectedDepartment}
          onSelectDepartment={setSelectedDepartment}
          positions={positions}
        />
      )}

      {isConfirmModalOpen && (
        <ConfirmModal
          title={`Confirm ${
            confirmAction.charAt(0).toUpperCase() + confirmAction.slice(1)
          }`}
          message={
            confirmAction === "add"
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
            confirmAction === "edit"
              ? `${selectedOption} has been changed to ${optionToAdd} successfully!`
              : confirmAction === "delete"
              ? `${selectedOption} has been deleted successfully!`
              : `${optionToAdd} has been added successfully!`
          }
          onClose={() => setIsConfirmedMessageModalOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminManageSettings;
