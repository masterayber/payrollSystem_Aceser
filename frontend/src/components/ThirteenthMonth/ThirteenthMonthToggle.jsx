import PropTypes from "prop-types";
import { IconEye, IconEyeClosed } from "@tabler/icons-react";
import "../Profile/Profile.css";

// The Show/Hide button of a 13th month section (the profile card, the Reports
// section). It sits to the right of the title inside a `profile-card-header`, which
// styles it (Profile.css).
const ThirteenthMonthToggle = ({ isVisible, onToggle }) => (
  <button
    type="button"
    className="btn"
    aria-expanded={isVisible}
    aria-label={isVisible ? "Hide 13th month pay" : "Show 13th month pay"}
    onClick={onToggle}
  >
    {/* The same eye as Basic pay: open while the figures show */}
    {isVisible ? (
      <IconEye stroke={2} size={16} />
    ) : (
      <IconEyeClosed stroke={2} size={16} />
    )}
    {isVisible ? "Hide" : "Show"}
  </button>
);

ThirteenthMonthToggle.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

export default ThirteenthMonthToggle;
