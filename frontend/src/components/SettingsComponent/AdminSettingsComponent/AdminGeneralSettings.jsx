import React, { useEffect, useState, useRef, useContext } from "react";
import { IconCamera } from "@tabler/icons-react";
import { UserContext } from "../../../context/UserContext";
import ProfilePhoto from "../../ProfilePhoto/ProfilePhoto";
import ProfilePhotoCropper from "../../Modals/ProfilePhotoCropper/ProfilePhotoCropper";
import "../AdminSettingsComponent.css";

const AdminGeneralSettings = () => {
  const [showPhotoChange, setShowPhotoChange] = useState(false);
  const { userData, setUserData } = useContext(UserContext);
  const changePhotoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  const fullName = `${userData?.firstName} ${userData?.lastName}`;

  const togglePhotoChange = (event) => {
    event.stopPropagation();
    setShowPhotoChange((prev) => !prev);
  };

  const handleClickOutside = (event) => {
    if (
      changePhotoRef.current &&
      !changePhotoRef.current.contains(event.target)
    ) {
      setShowPhotoChange(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleRemovePhoto = () => {
    setUserData((prevData) => ({
      ...prevData,
      photoURL: null,
    }));
  };

  const handleCropComplete = (croppedImage) => {
    setUserData((prevData) => ({
      ...prevData,
      photoURL: croppedImage,
    }));
    setShowCropper(false);
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <div className="settings-content">
      <div className="settings-profile">
        <div className="profile-section">
          <ProfilePhoto size="100px" />
          <div className="camera-icon" onClick={togglePhotoChange}>
            <IconCamera strokeWidth={2} />
          </div>
          {showPhotoChange && (
            <div className="change-photo" ref={changePhotoRef}>
              <button className="dropdown-item" onClick={handleUploadClick}>
                Set Profile Photo
              </button>
              <hr />
              <button className="dropdown-item" onClick={handleRemovePhoto}>
                Remove
              </button>
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>

        <div className="profile-details">
          <p className="profile-name">{fullName}</p>
          <p className="profile-role">{userData?.role}</p>
        </div>
      </div>

      {showCropper && (
        <ProfilePhotoCropper
          imageSrc={selectedImage}
          userId={userData?._id}
          onClose={() => setShowCropper(false)}
          onCropComplete={handleCropComplete}
        />
      )}

      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Company Information</p>
        </div>
        <div className="setting-tab-container">
          <div className="input-container">
            <div className="label-container">
              <label>Company Name</label>
            </div>
            <div className="input-group-signup">
              <input
                type="text"
                name="companyName"
                placeholder="Company Name"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminGeneralSettings;
