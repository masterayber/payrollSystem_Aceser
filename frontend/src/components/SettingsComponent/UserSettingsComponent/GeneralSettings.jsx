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
                <label>Birthday</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="date"
                  name="birthday"
                  placeholder="Contact Number"
                  value={
                    userData?.birthday ? userData.birthday.split("T")[0] : ""
                  }
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>Gender</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="gender"
                  placeholder="Gender"
                  value={userData?.gender}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Contact Details</p>
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
                <label>Country</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="country"
                  placeholder="Country"
                  value={userData?.address?.country || ""}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="setting-tab-flex">
          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>Region</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="region"
                  placeholder="Region"
                  value={userData?.address?.region || ""}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>Province</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="province"
                  placeholder="Province"
                  value={userData?.address?.province || ""}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="setting-tab-flex">
          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>City</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="city"
                  placeholder="City"
                  value={userData?.address?.city || ""}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>Barangay</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="barangay"
                  placeholder="Barangay"
                  value={userData?.address?.barangay || ""}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="setting-tab-flex">
          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>Street</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="street"
                  placeholder="Street"
                  value={userData?.address?.street || ""}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>Postal Code</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="postalCode"
                  placeholder="Postal Code"
                  value={userData?.address?.postalCode || ""}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

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
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        <div className="setting-tab-flex">
          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>Company Logo</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="file"
                  accept="image/*"
                  name="companyLogo"
                  placeholder="Choose a file"
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>Company Contact</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="companyContact"
                  placeholder="Company Contact"
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Emergency Contact</p>
        </div>
        <div className="setting-tab-flex">
          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>Contact First Name</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="contactFirstName"
                  placeholder="Contact First Name"
                  value={userData?.emergencyDetails?.contactFirstName}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>Contact Last Name</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="contactLastName"
                  placeholder="Contact Last Name"
                  value={userData?.emergencyDetails?.contactLastName}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="setting-tab-container">
          <div className="input-container">
            <div className="label-container">
              <label>Contact Emergency Number</label>
            </div>
            <div className="input-group-signup">
              <input
                type="text"
                name="contactEmergency"
                placeholder="Contact Emergency Number"
                value={userData?.emergencyDetails?.contactEmergency}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        <div className="setting-tab-container">
          <div className="input-container">
            <div className="label-container">
              <label>Contact Address</label>
            </div>
            <div className="input-group-signup">
              <input
                type="text"
                name="contactAddress"
                placeholder="Contact Address"
                value={userData?.emergencyDetails?.contactAddress}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralSettings;
