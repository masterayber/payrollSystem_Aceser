import React, { useContext } from "react";
import { IconUserCircle } from "@tabler/icons-react";
import { UserContext } from "../../context/UserContext";
import "./ProfilePhoto.css";

const ProfilePhoto = ({ size = "50px" }) => {
  const { userData } = useContext(UserContext);
  const backendUrl = "http://localhost:5000";

  const profilePhoto = userData?.photoURL?.startsWith("http")
    ? userData.photoURL
    : userData?.photoURL
    ? `${backendUrl}${userData.photoURL}`
    : null;

  return (
    <div className="profile-icon">
      {profilePhoto ? (
        <img
          src={
            profilePhoto ? (
              profilePhoto
            ) : (
              <IconUserCircle strokeWidth={1.5} width={size} height={size} />
            )
          }
          alt="Profile"
          className="rounded-full"
          style={{ width: size, height: size, objectFit: "cover" }}
        />
      ) : (
        <IconUserCircle strokeWidth={1.5} width={size} height={size} />
      )}
    </div>
  );
};

export default ProfilePhoto;
