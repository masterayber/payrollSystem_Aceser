import { useState } from "react";
import "../Modal.css";
import PropTypes from "prop-types";

const EditEmployeeAttendanceModal = ({ employee, onClose, onUpdate }) => {
  const [editedAttendance, setEditedAttendance] = useState({
    timeIn: employee.timeIn || "",
    timeOut: employee.timeOut || "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    const digitsOnly = value.replace(/\D/g, "");

    const prevValue = editedAttendance[name].replace(":", "");
    const isDeleting = digitsOnly.length < prevValue.length;

    let formattedValue = "";

    if (digitsOnly.length === 0) {
      formattedValue = "";
    } else if (digitsOnly.length === 1) {
      formattedValue = digitsOnly;
    } else if (digitsOnly.length === 2) {
      formattedValue = isDeleting ? digitsOnly : `${digitsOnly}:`;
    } else if (digitsOnly.length <= 4) {
      formattedValue = `${digitsOnly.slice(0, 2)}:${digitsOnly.slice(2)}`;
    } else {
      formattedValue = `${digitsOnly.slice(0, 2)}:${digitsOnly.slice(2, 4)}`;
    }

    setEditedAttendance((prev) => ({
      ...prev,
      [name]: formattedValue,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(
        `http://localhost:5000/api/attendance/attendance/${employee.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            timeIn: editedAttendance.timeIn,
            timeOut: editedAttendance.timeOut,
          }),
        }
      );

      if (response.ok) {
        onUpdate();
      } else {
        console.error(
          "Failed to update attendance data. Please try again later"
        );
      }
    } catch (error) {
      console.error("Error updating attendance:", error);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Edit Attendance</h3>
        <form onSubmit={handleSubmit}>
          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>First Name</label>
              </div>
              <div className="input-group-signup">
                <input type="text" value={employee.firstName} disabled />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>First Name</label>
              </div>
              <div className="input-group-signup">
                <input type="text" value={employee.lastName} disabled />
              </div>
            </div>
          </div>

          <div className="input-container">
            <div className="label-container">
              <label>Date</label>
            </div>
            <div className="input-group-signup">
              <input type="date" value={employee.date} disabled />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>Time In</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="timeIn"
                  placeholder="HH:MM"
                  value={editedAttendance.timeIn}
                  onChange={handleChange}
                  maxLength={5}
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>Time Out</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="timeOut"
                  placeholder="HH:MM"
                  value={editedAttendance.timeOut}
                  onChange={handleChange}
                  maxLength={5}
                />
              </div>
            </div>
          </div>

          <div className="modal-buttons">
            <button onClick={onClose} className="modal-button">
              Cancel
            </button>
            <button className="modal-button">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEmployeeAttendanceModal;

EditEmployeeAttendanceModal.propTypes = {
  employee: PropTypes.shape({
    id: PropTypes.string,
    _id: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    date: PropTypes.string,
    timeIn: PropTypes.string,
    timeOut: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
};
