import PropTypes from "prop-types";
import "./Profile.css";

// Photo, name, subtitle and badges on the left, actions on the right.
// Badges with an empty label are skipped.
const ProfileHeader = ({ photo, name, subtitle, badges = [], children }) => {
  const shownBadges = badges.filter((badge) => badge?.label);

  return (
    <div className="profile-header">
      <div className="profile-identity">
        {photo}
        <div className="profile-identity-text">
          <h2>{name}</h2>
          {subtitle && <p className="profile-subtitle">{subtitle}</p>}
          {shownBadges.length > 0 && (
            <div className="profile-badges">
              {shownBadges.map((badge) => (
                <span
                  key={badge.label}
                  className={`profile-badge ${badge.className || ""}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {children && <div className="profile-actions">{children}</div>}
    </div>
  );
};

ProfileHeader.propTypes = {
  photo: PropTypes.node,
  name: PropTypes.string,
  subtitle: PropTypes.string,
  badges: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      className: PropTypes.string,
    }),
  ),
  children: PropTypes.node,
};

export default ProfileHeader;
