import React, { useEffect, useState, useRef, useContext } from "react";
import { IconCamera } from "@tabler/icons-react";
import { UserContext } from "../../../context/UserContext";
import ProfilePhoto from "../../ProfilePhoto/ProfilePhoto";
import ProfilePhotoCropper from "../../Modals/ProfilePhotoCropper/ProfilePhotoCropper";
import ConfirmModal from "../../Modals/Confirm/ConfirmModal";

const GeneralSettings = () => {
  const { userData, setUserData, updateUserProfilePhoto } =
    useContext(UserContext);

  const changePhotoRef = useRef(null);
  const fileInputRef = useRef(null);

  const [showPhotoChange, setShowPhotoChange] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  const [settings, setSettings] = useState({
    firstName: "",
    lastName: "",
  });

  useEffect(() => {
    const fetchUserSettings = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/auth/${userData._id}`
        );
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        } else {
          console.error("Failed to fetch user settings");
        }
      } catch (error) {
        console.error("Error fetching user settings", error);
      }
    };

    if (userData?._id) {
      fetchUserSettings();
    }
  }, [userData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSettings((prevSettings) => ({
      ...prevSettings,
      [name]: value,
    }));
  };

  const togglePhotoChange = (event) => {
    event.stopPropagation();
    setShowPhotoChange((prev) => !prev);
  };

  const handleUploadClick = () => {
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const handleRemoveClick = () => {
    setShowConfirmModal(true);
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

  const handleCropComplete = (croppedImage) => {
    setUserData((prevData) => ({
      ...prevData,
      photoURL: croppedImage,
    }));
    setShowCropper(false);
  };

  const handleRemovePhoto = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/auth/remove-profile-photo/${userData._id}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        updateUserProfilePhoto(null);
      } else {
        console.error("Failed to remove profile photo");
      }
    } catch (error) {
      console.error("Error removing profile photo", error);
    }

    setShowConfirmModal(false);
  };

  const handleClickOutside = (event) => {
    if (
      changePhotoRef.current &&
      !changePhotoRef.current.contains(event.target)
    ) {
      setShowPhotoChange(false);
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  });

  const fullName = `${userData?.firstName} ${userData?.lastName}`;

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
              {userData?.photoURL && (
                <>
                  <hr />
                  <button className="dropdown-item" onClick={handleRemoveClick}>
                    Remove
                  </button>
                </>
              )}
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="image*/"
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

      {showConfirmModal && (
        <ConfirmModal
          title="Remove Profile Photo"
          message="Are you sure you want to remove your profile photo?"
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleRemovePhoto}
          confirmText="Yes"
          cancelText="No"
        />
      )}

      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Personal Information</p>
        </div>
        <div className="setting-tab-flex">
          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>First Name</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="firstName"
                  placeholder="First Name"
                  value={userData?.firstName}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>Last Name</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="lastName"
                  placeholder="Last Name"
                  value={userData?.lastName}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="setting-tab-container">
          <div className="input-container">
            <div className="label-container">
              <label>Email</label>
            </div>
            <div className="input-group-signup">
              <input
                type="text"
                name="email"
                placeholder="Email"
                value={userData?.email}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>
        <div className="setting-tab-flex">
          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>Contact Number</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="contactNumber"
                  placeholder="Contact Number"
                  value={userData?.contactNumber}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>Last Name</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="lastName"
                  placeholder="Last Name"
                  value={userData?.lastName}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralSettings;
