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

const AdminManageSettings = () => {
  const [dropdowns, setDropdowns] = useState([]);
  const [showAddOption, setShowAddOption] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [optionToAdd, setOptionToAdd] = useState("");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedMessageModalOpen, setIsConfirmedMessageModalOpen] =
    useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState("");
  const [confirmAction, setConfirmAction] = useState(""); // ADD | EDIT | DELETE

  const addSvgRef = useRef(null);

  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/dropdownOption");
        const data = await res.json();
        setDropdowns(data.Departments);
      } catch (error) {
        console.error("Error fetching dropdowns:", error);
      }
    };

    fetchDropdowns();
  }, []);

  const toggleAddOption = (event) => {
    event.stopPropagation();
    setShowAddOption((prev) => !prev);
  };

  const handleAddClick = () => {
    setShowAddOption(false);
    setIsAddModalOpen(true);
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
      let res;

      if (confirmAction === "add") {
        res = await fetch(
          "http://localhost:5000/api/dropdownOption/department",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ option: optionToAdd }),
          }
        );
      } else if (confirmAction === "edit") {
        res = await fetch(
          "http://localhost:5000/api/dropdownOption/department/edit",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              oldOption: selectedOption,
              newOption: optionToAdd,
            }),
          }
        );
      } else if (confirmAction === "delete") {
        res = await fetch(
          "http://localhost:5000/api/dropdownOption/department/delete",
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ option: selectedOption }),
          }
        );
      }

      if (!res.ok) throw new Error("Failed to process action");

      const data = await res.json();
      setDropdowns(data.Departments);

      setIsConfirmModalOpen(false);
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);

      setTimeout(() => setIsConfirmedMessageModalOpen(true), 300);
    } catch (error) {
      console.error(`Error during ${confirmAction}:`, error);
    }
  };

  const handleEditClick = (dept) => {
    setSelectedOption(dept);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (dept) => {
    setSelectedOption(dept);
    setConfirmAction("delete");
    setIsConfirmModalOpen(true);
  };

  return (
    <div className="settings-content">
      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Manage Employment Configuration</p>
        </div>
        <div className="setting-tab-table">
          <div className="table-container">
            <div className="table-title">
              <p>Departments</p>
              <div className="dots-button-container">
                <IconDotsVertical
                  stroke={2}
                  onClick={toggleAddOption}
                  ref={addSvgRef}
                  className="dots-button"
                />
                {showAddOption && (
                  <div className="dropdown-details" ref={addSvgRef}>
                    <button
                      className="dropdown-item-details"
                      onClick={() => handleAddClick()}
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
                  <p>Department</p>
                </article>
                <hr className="header-hr"></hr>
                <article className="table-header-container">
                  <p>Action</p>
                </article>
              </div>

              {dropdowns?.map((dept, index) => (
                <div className="table-content" key={index}>
                  <article className="table-content-container">
                    <p>{dept}</p>
                  </article>
                  <article className="table-content-container">
                    <button
                      className="action-button"
                      onClick={() => handleEditClick(dept)}
                    >
                      <IconEdit stroke={2} />
                      Edit
                    </button>
                    <button
                      className="action-button"
                      onClick={() => handleDeleteClick(dept)}
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

        <div className="setting-tab-table">
          <div className="table-container">
            <div className="table-title">
              <p>Designations</p>
              <div className="dots-button-container">
                <IconDotsVertical
                  stroke={2}
                  onClick={toggleAddOption}
                  ref={addSvgRef}
                  className="dots-button"
                />
                {showAddOption && (
                  <div className="dropdown-details" ref={addSvgRef}>
                    <button
                      className="dropdown-item-details"
                      onClick={() => handleAddClick()}
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
                  <p>Designation</p>
                </article>
                <hr className="header-hr"></hr>
                <article className="table-header-container">
                  <p>Action</p>
                </article>
              </div>

              {dropdowns?.map((dept, index) => (
                <div className="table-content" key={index}>
                  <article className="table-content-container">
                    <p>{dept}</p>
                  </article>
                  <article className="table-content-container">
                    <button
                      className="action-button"
                      onClick={() => handleEditClick(dept)}
                    >
                      <IconEdit stroke={2} />
                      Edit
                    </button>
                    <button
                      className="action-button"
                      onClick={() => handleDeleteClick(dept)}
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
      </div>

      {isAddModalOpen && (
        <AddModal
          title="Add Option"
          message="Add a new department option:"
          onClose={() => setIsAddModalOpen(false)}
          onAddOption={handleConfirmAdd}
        />
      )}

      {isEditModalOpen && (
        <EditModal
          title="Edit Option"
          message={`Edit the department option:`}
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
            confirmAction === "add"
              ? `Are you sure you want to add "${optionToAdd}" as a new Department`
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
