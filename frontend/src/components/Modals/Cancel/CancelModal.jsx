import "../Modal.css";
import PropTypes from "prop-types";

const CancelModal = ({
  title,
  message,
  onClose,
  onConfirm,
  cancelText,
  confirmText,
}) => {
  return (
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
    </div>
  );
};

CancelModal.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
  onClose: PropTypes.func,
  onConfirm: PropTypes.func,
  cancelText: PropTypes.string,
  confirmText: PropTypes.string,
};

export default CancelModal;
