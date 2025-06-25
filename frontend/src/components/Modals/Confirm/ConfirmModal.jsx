import { useEffect } from "react";
import ReactDOM from "react-dom";
import "../Modal.css";
import PropTypes from "prop-types";

const ConfirmModal = ({
  title = "Confirmation",
  message,
  onClose,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
}) => {
  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  return ReactDOM.createPortal(
    <div className="modal">
      <div className="modal-content">
        <h3>{title}</h3>
        <div className="message">
          <p>{message}</p>
        </div>

        <div className="modal-buttons">
          <button onClick={onClose} className="modal-button">
            {cancelText}
          </button>
          <button onClick={onConfirm} className="modal-button">
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

ConfirmModal.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
  onClose: PropTypes.func,
  onConfirm: PropTypes.func,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
};

export default ConfirmModal;
