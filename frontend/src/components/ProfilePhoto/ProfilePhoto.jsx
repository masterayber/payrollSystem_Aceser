import { useContext } from "react";
import { UserContext } from "../../context/UserContext";
import "./ProfilePhoto.css";
import PropTypes from "prop-types";

const ProfilePhoto = ({ size = "50px" }) => {
  const { userData } = useContext(UserContext);

  let profilePhoto = "/assets/user-circle.svg";

  const photo = userData?.profilePhoto;

  if (photo) {
    if (photo.startsWith("http")) {
      profilePhoto = photo;
    } else if (
      photo.endsWith(".jpg") ||
      photo.endsWith(".jpeg") ||
      photo.endsWith(".png") ||
      photo.endsWith(".svg")
    ) {
      profilePhoto = photo.startsWith("/assets")
        ? photo
        : `http://localhost:5000${photo}`;
    }
  }

  return (
    <div className="profile-icon">
      {profilePhoto ? (
        <img
          src={profilePhoto}
          alt="Profile"
          className="rounded-full"
          style={{ width: size, height: size, objectFit: "cover" }}
        />
      ) : (
        <img
          src={`/assets/user-circle.svg`}
          alt="Profile"
          className="rounded-full"
          style={{ width: size, height: size, objectFit: "cover" }}
        />
      )}
    </div>
  );
};

export default ProfilePhoto;

ProfilePhoto.propTypes = {
  size: PropTypes.string.isRequired,
};
