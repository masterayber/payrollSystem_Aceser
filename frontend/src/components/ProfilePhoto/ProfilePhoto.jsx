import React, { useContext } from "react";
import { UserContext } from "../../context/UserContext";
import "./ProfilePhoto.css";

const ProfilePhoto = ({ size = "50px" }) => {
  const { userData } = useContext(UserContext);
  const backendUrl = "http://localhost:5000";

  let profilePhoto = userData?.photoURL?.startsWith("http")
    ? userData.photoURL
    : userData?.profilePhoto || "/assets/user-circle.svg";

  if (userData?.photoURL) {
    if (userData.photoURL.startsWith("http")) {
      profilePhoto = userData.photoURL;
    } else if (
      userData.photoURL.endsWith(".jpg") ||
      userData.photoURL.endsWith(".jpeg") ||
      userData.photoURL.endsWith(".png")
    ) {
      profilePhoto = `${backendUrl}${userData?.photoURL}`;
    } else if (userData.photoURL.endsWith(".svg")) {
      profilePhoto = userData.photoURL;
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
