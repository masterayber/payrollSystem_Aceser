import React, { useContext } from "react";
import { UserContext } from "../../context/UserContext";
import "./ProfilePhoto.css";

const ProfilePhoto = ({ size = "50px" }) => {
  const { userData } = useContext(UserContext);
  const backendUrl = "http://localhost:5000";

  let profilePhoto = "/assets/user-circle.svg"; // Default profile photo

  const photo = userData?.photoURL || userData?.profilePhoto;

  if (photo) {
    if (photo.startsWith("http")) {
      profilePhoto = photo;
    } else if (
      photo.endsWith(".jpg") ||
      photo.endsWith(".jpeg") ||
      photo.endsWith(".png")
    ) {
      profilePhoto = `${backendUrl}${photo}`;
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
