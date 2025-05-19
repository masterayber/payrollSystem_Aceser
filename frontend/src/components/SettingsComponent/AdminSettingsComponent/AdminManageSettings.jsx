import { useState, useEffect, useRef } from "react";
import {
  IconEdit,
  IconSquareRoundedX,
  IconDotsVertical,
} from "@tabler/icons-react";
import AddModal from "../../Modals/AddOption/AddOption";

const AdminManageSettings = () => {
  const [dropdowns, setDropdowns] = useState([]);
  const [showAddOption, setShowAddOption] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingOption, setPendingOption] = useState("");

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

  const handleAddOption = async (newOption) => {
    try {
      const res = await fetch(
        "http://localhost:5000/api/dropdownOption/department",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ option: newOption }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        setDropdowns(data.Departments);
        setIsAddModalOpen(false);
      } else {
        console.error(data.message || "Failed to add option");
      }
    } catch (error) {
      console.error("Error adding option:", error);
    }
  };

  return (
    <div className="settings-content">
      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Manage Employment Configuration</p>
        </div>
        <div className="setting-tab-container">
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
                    <button className="action-button">
                      <IconEdit stroke={2} />
                      Edit
                    </button>
                    <button className="action-button">
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
          title="Add Department"
          message="Add a new department option:"
          onClose={() => setIsAddModalOpen(false)}
          onAddOption={handleAddOption}
        />
      )}
    </div>
  );
};

export default AdminManageSettings;
