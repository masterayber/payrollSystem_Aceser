import { useEffect, useState, useRef, useContext } from "react";
import { IconCamera } from "@tabler/icons-react";
import { UserContext } from "../../../context/UserContext";
import { SettingsContext } from "../../../context/SettingsContext";
import ProfilePhoto from "../../ProfilePhoto/ProfilePhoto";
import ProfilePhotoCropper from "../../Modals/ProfilePhotoCropper/ProfilePhotoCropper";
import ConfirmModal from "../../Modals/Confirm/ConfirmModal";
import "../SettingsComponent.css";

const AdminGeneralSettings = () => {
  const { settingsData, setSettingsData } = useContext(SettingsContext);
  const { userData, setUserData, updateUserProfilePhoto } =
    useContext(UserContext);

  const [formData, setFormData] = useState({});
  const [initialFormData, setInitialFormData] = useState(null);
  const [isChanged, setIsChanged] = useState(false);

  const changePhotoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showPhotoChange, setShowPhotoChange] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (settingsData) {
      setFormData(settingsData);
      console.log("Fetched Data", settingsData);
    }
  }, [settingsData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prevData) => {
      const updatedData = { ...prevData, [name]: value };

      setIsChanged(
        Object.keys(updatedData).some(
          (key) => updatedData[key] !== initialFormData[key]
        )
      );
      return updatedData;
    });
  };

  // useEffect(() => {
  //   const hasChanged = Object.keys(initialFormData).some(
  //     (key) => formData[key] !== initialFormData[key]
  //   );
  //   setIsChanged(hasChanged);
  // }, [formData, initialFormData]);

  const handleCancel = () => {
    setFormData(initialFormData);
    setIsChanged(false);
  };

  const handleSaveGeneralSettings = async () => {
    try {
      await setSettingsData({ formData });
      setInitialFormData(formData);
      setIsChanged(false);
    } catch (error) {
      console.error("Failed to update settings:", error);
    }
  };

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
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const handleRemoveClick = () => {
    setShowConfirmModal(true);
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
                  value={formData.firstName}
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
                  value={formData.lastName}
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
                value={formData.email}
                onChange={handleInputChange}
              />
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
                value={formData.companyName}
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
                  placeholder="Choose file"
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
                  value={formData.companyContact}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Address Details</p>
        </div>
        <div className="setting-tab-flex">
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
                  value={formData.country}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
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
                  value={formData.region}
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
                  value={formData.city}
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
                  value={formData.barangay}
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
                  value={formData.street}
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
                  value={formData.postalCode}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Time & Date Settings</p>
        </div>
        <div className="setting-tab-flex">
          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>Date Format</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="dateFormat"
                  placeholder="MM-DD-YYYY"
                  value={formData.dateFormat}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
          <div className="setting-tab-container">
            <div className="input-container">
              <div className="label-container">
                <label>Time Format</label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="timeFormat"
                  placeholder="12 Hour"
                  value={formData.timeFormat}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-button-option-container">
        <button
          className={`settings-button-option ${!isChanged ? "disabled" : ""}`}
          onClick={handleSaveGeneralSettings}
          disabled={!isChanged}
        >
          Save
        </button>
        <button
          className={`settings-button-option ${!isChanged ? "disabled" : ""}`}
          onClick={handleCancel}
          disabled={!isChanged}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AdminGeneralSettings;
