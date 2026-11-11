import {
  RESTRICTED_LABEL,
  RESTRICTED_TITLE,
} from "../../utils/payVisibility";
import "./Restricted.css";

// "Restricted" in muted grey where a pay amount would be. Never blank or ₱0.00,
// which would read as "no pay set", and nothing to click to reveal it.
const Restricted = () => (
  <span className="restricted-value" title={RESTRICTED_TITLE}>
    {RESTRICTED_LABEL}
  </span>
);

export default Restricted;
