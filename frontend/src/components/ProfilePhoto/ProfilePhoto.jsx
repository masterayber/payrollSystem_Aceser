import React, { useContext } from "react";
import { IconUserCircle } from "@tabler/icons-react";
import { UserContext } from "../../context/UserContext";
import "./ProfilePhoto.css";

const ProfilePhoto = ({ size = "50px" }) => {
  const { userData } = useContext(UserContext);
  const profilePhoto = userData?.photoURL || null;

  const getDefaultPhoto = () => {
    if (userData?.role === "admin") {
      return <IconUserCircle strokeWidth={1.5} width={size} height={size} />;
    } else if (userData?.role === "user") {
      return (
        <img
          src={userData?.gender === "male" ? "/male.svg" : "/female.svg"}
          alt="Default Profile"
          className="rounded-full"
          style={{ width: size, height: size, objectFit: "cover" }}
        />
      );
    }
    return <IconUserCircle strokeWidth={1.5} width={size} height={size} />;
  };

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
        getDefaultPhoto()
      )}
    </div>
  );
};

export default ProfilePhoto;
