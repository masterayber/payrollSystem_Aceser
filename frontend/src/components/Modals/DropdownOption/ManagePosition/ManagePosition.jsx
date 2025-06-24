import "../../Modal.css";
import Dropdown from "../../../Dropdown/Dropdown";
import PropTypes from "prop-types";

const ManagePositionModal = ({
  title,
  message,
  cancelText,
  confirmText,
  onClose,
  departments,
}) => {
  return (
    <div className="modal">
      <div className="modal-content">
        <h3>{title}</h3>
        <div className="message">
          <p>{message}</p>
        </div>
        <div className="input-container">
          <Dropdown options={["--Select Department--", ...departments]} />
        </div>
        <div className="modal-buttons">
          <button onClick={onClose} className="modal-button">
            {cancelText}
          </button>
          <button className="modal-button">{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

export default ManagePositionModal;

ManagePositionModal.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
  onClose: PropTypes.func,
  cancelText: PropTypes.string,
  confirmText: PropTypes.string,
  departments: PropTypes.arrayOf(PropTypes.string).isRequired,
};
