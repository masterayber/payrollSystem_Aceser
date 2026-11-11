import { PAY_NOT_SET_LABEL } from "../../utils/payVisibility";
import "./Restricted.css";

// "Pay needs an update" on the Employees list and the Employee Profile. The caller
// decides when to show it (isPayNotSet), so it never appears for hidden pay.
const PayNotSetBadge = () => (
  <span
    className="pay-not-set-badge"
    title="Enter this employee's basic pay in Edit employment."
  >
    {PAY_NOT_SET_LABEL}
  </span>
);

export default PayNotSetBadge;
