import { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import "../../Modal.css";
import PropTypes from "prop-types";

const EditOptionModal = ({
  title,
  message,
  onClose,
  onEditOption,
  confirmText,
  cancelText,
  currentOption,
}) => {
  const [option, setOption] = useState(currentOption || "");

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    setOption(currentOption || "");
  }, [currentOption]);

  const handleEditClick = () => {
    if (option.trim() === "") {
      alert("Input cannot be empty");
      return;
    }
    onEditOption(option);
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
            placeholder="Edit Option"
            value={option}
            onChange={(e) => setOption(e.target.value)}
          />
        </div>
        <div className="modal-buttons">
          <button onClick={onClose} className="modal-button">
            {cancelText}
          </button>
          <button onClick={handleEditClick} className="modal-button">
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

EditOptionModal.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
  onClose: PropTypes.func,
  onEditOption: PropTypes.func,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  currentOption: PropTypes.string,
};

export default EditOptionModal;
