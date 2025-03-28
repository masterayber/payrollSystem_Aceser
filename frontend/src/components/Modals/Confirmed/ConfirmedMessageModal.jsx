import React from "react";
import "../Modal.css";

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
