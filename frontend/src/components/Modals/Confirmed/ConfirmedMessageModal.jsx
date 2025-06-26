import { useEffect } from "react";
import ReactDOM from "react-dom";
import "../Modal.css";
import PropTypes from "prop-types";

const ConfirmedMessageModal = ({ message, onClose }) => {
  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "hidden";
    };
  }, []);

  return ReactDOM.createPortal(
    <div className="modal">
      <div className="modal-content">
        <h3>Success</h3>
        <div className="message">
          <p>{message}</p>
          <div className="modal-buttons">
            <button onClick={onClose} className="modal-button">
              OK
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmedMessageModal;

ConfirmedMessageModal.propTypes = {
  message: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};
