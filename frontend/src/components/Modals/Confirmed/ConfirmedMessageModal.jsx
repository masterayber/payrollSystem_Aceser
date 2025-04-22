import "react";
import "../Modal.css";
import PropTypes from "prop-types";

const ConfirmedMessageModal = ({ message, onClose }) => {
  return (
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
    </div>
  );
};

export default ConfirmedMessageModal;

ConfirmedMessageModal.propTypes = {
  message: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};
