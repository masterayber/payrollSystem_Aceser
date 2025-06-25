import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import "../../Modal.css";
import PropTypes from "prop-types";

const AddOptionModal = ({ title, message, onClose, onAddOption }) => {
  const [option, setOption] = useState("");

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  const handleAddClick = () => {
    if (option.trim() === "") {
      alert("Input cannot be empty");
      return;
    }
    onAddOption(option);
    setOption("");
  };
  return ReactDOM.createPortal(
    <div className="modal">
      <div className="modal-content">
        <h3>{title}</h3>
        <div className="message">
          <p>{message}</p>
        </div>
        <div className="input-group-signup">
          <input
            type="text"
            name="option"
            placeholder="Add Option"
            value={option}
            onChange={(e) => setOption(e.target.value)}
          />
        </div>
        <div className="modal-buttons">
          <button onClick={onClose} className="modal-button">
            Cancel
          </button>
          <button onClick={handleAddClick} className="modal-button">
            Add
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

AddOptionModal.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
  onClose: PropTypes.func,
  onAddOption: PropTypes.func.isRequired,
};

export default AddOptionModal;
