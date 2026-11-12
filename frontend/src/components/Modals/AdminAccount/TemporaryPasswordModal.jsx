import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import { temporaryPasswordNote } from "../../../utils/adminAccounts";
import "../Modal.css";

// The one time a temporary password is shown, after Add Admin and after Reset password.
// The password lives only in the caller's state while this box is open: it is never
// stored, logged or put in the address. Only "Done" closes the box.
const TemporaryPasswordModal = ({ intro, password, name, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const passwordRef = useRef(null);

  useEffect(() => {
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
      // Ready to be copied by hand
      passwordRef.current?.select();
    }
  };

  return ReactDOM.createPortal(
    <div className="modal">
      <div
        className="modal-content admin-password-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="temporary-password-title"
      >
        <h3 id="temporary-password-title">Temporary password</h3>
        <div className="message">
          <p>{intro} Temporary password:</p>
        </div>

        <div className="admin-password-row">
          <div className="input-group-signup">
            <input
              type="text"
              readOnly
              ref={passwordRef}
              className="admin-password-value"
              aria-label="Temporary password"
              value={password}
              onFocus={(event) => event.target.select()}
            />
          </div>
          <button type="button" className="btn modal-button" onClick={handleCopy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="message">
          <p>{temporaryPasswordNote(name)}</p>
        </div>

        {copyFailed && (
          <p className="feedback-message warning">
            Could not copy. Select the password and copy it by hand.
          </p>
        )}

        <div className="modal-buttons">
          <button type="button" className="btn modal-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

TemporaryPasswordModal.propTypes = {
  intro: PropTypes.string.isRequired,
  password: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default TemporaryPasswordModal;
