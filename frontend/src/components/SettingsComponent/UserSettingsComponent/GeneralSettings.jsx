import React, { useEffect, useState, useRef, useContext } from "react";
import { IconCamera, IconCancel, IconEdit } from "@tabler/icons-react";
import { UserContext } from "../../../context/UserContext";
import ProfilePhoto from "../../ProfilePhoto/ProfilePhoto";
import ProfilePhotoCropper from "../../Modals/ProfilePhotoCropper/ProfilePhotoCropper";
import ConfirmModal from "../../Modals/Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Modals/Confirmed/ConfirmedMessageModal";

const GeneralSettings = () => {
  const { userData, setUserData, updateUserProfilePhoto } =
    useContext(UserContext);

  const changePhotoRef = useRef(null);
  const fileInputRef = useRef(null);

  const [showPhotoChange, setShowPhotoChange] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [IsRemoveConfirmMdoalOpen, setIsRemoveConfirmModalOpen] =
    useState(false);
  const [isConfirmedMessageModalOpen, setIsConfirmedMessageModalOpen] =
    useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const [tempData, setTempData] = useState({
    address: userData?.employee?.address || {
      country: "",
      region: "",
      province: "",
      city: "",
      barangay: "",
      street: "",
      postalCode: "",
    },
    emergencyDetails: userData?.employee?.emergencyDetails || {
      contactFirstName: "",
      contactLastName: "",
      contactEmergency: "",
      contactAddress: "",
    },
    ...userData,
  });

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setTempData((prevData) => {
      let updatedData = { ...prevData };

      if (name === "email") {
        updatedData.email = value || "";
        if (updatedData.employee) {
          updatedData.employee.email = value || "";
        }
      } else if (name in prevData.employee) {
        updatedData.employee = {
          ...prevData.employee,
          [name]: value || "",
        };
      } else if (name in prevData.address) {
        updatedData.address = {
          ...prevData.address,
          [name]: value || "",
        };
      } else if (name in prevData.emergencyDetails) {
        updatedData.emergencyDetails = {
          ...prevData.emergencyDetails,
          [name]: value || "",
        };
      } else {
        updatedData[name] = value || "";
      }

      return updatedData;
    });

    setIsChanged(true);
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
    setIsRemoveConfirmModalOpen(true);
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

    setTimeout(() => setIsConfirmedMessageModalOpen(true), 300);
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

    setIsRemoveConfirmModalOpen(false);

    setTimeout(() => setIsConfirmedMessageModalOpen(true), 300);
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

  const handleCancel = () => {
    setTempData(userData);
    setIsChanged(false);
    setIsEditing(false);
  };

  const toggleEdit = () => {
    if (isEditing) {
      setTempData({
        address: userData?.employee?.address || {
          country: "",
          region: "",
          province: "",
          city: "",
          barangay: "",
          street: "",
          postalCode: "",
        },
        emergencyDetails: userData?.employee?.emergencyDetails || {
          contactFirstName: "",
          contactLastName: "",
          contactEmergency: "",
          contactAddress: "",
        },
        ...userData,
      });
      setIsChanged(false);
    }
    setIsEditing(!isEditing);
  };

  const handleSaveClick = () => {
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSave = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/auth/updateGeneralSettings/${userData._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(tempData),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update user data");
      }

      const updatedUser = await response.json();
      setUserData(updatedUser);
      localStorage.setItem("userData", JSON.stringify(updatedUser));

      setIsEditing(false);
      setIsChanged(false);
      setIsConfirmModalOpen(false);

      setTimeout(() => setIsConfirmedMessageModalOpen(true), 300);
    } catch (error) {
      console.error("Error editing profile:", error);
    }
  };

  const fullName = `${userData?.employee?.firstName} ${userData?.employee?.lastName}`;
  const isAdmin = userData?.employee?.role === "Admin";

  return (
    <div className="settings-content">
      <div className="settings-profile">
        <div className="profile-section">
          <div className="profile-picture">
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
                    <button
                      className="dropdown-item"
                      onClick={handleRemoveClick}
                    >
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

        <button className="tooltip-button" onClick={toggleEdit}>
          {isEditing ? <IconCancel stroke={2} /> : <IconEdit stroke={2} />}
          {isEditing ? "Cancel" : "Edit Profile"}
        </button>
      </div>

      {showCropper && (
        <ProfilePhotoCropper
          imageSrc={selectedImage}
          userId={userData?._id}
          onClose={() => setShowCropper(false)}
          onCropComplete={handleCropComplete}
        />
      )}

      {IsRemoveConfirmMdoalOpen && (
        <ConfirmModal
          title="Remove Profile Photo"
          message="Are you sure you want to remove your profile photo?"
          onClose={() => setIsRemoveConfirmModalOpen(false)}
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
                  placeholder={
                    isEditing || tempData?.employee?.firstName
                      ? "Enter First Name"
                      : ""
                  }
                  value={tempData?.employee?.firstName || ""}
                  onChange={handleInputChange}
                  disabled={!isEditing}
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
                  placeholder={
                    isEditing || tempData?.employee?.lastName
                      ? "Enter Last Name"
                      : ""
                  }
                  value={tempData?.employee?.lastName || ""}
                  onChange={handleInputChange}
                  disabled={!isEditing}
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
                placeholder={isEditing || tempData?.email ? "Enter Email" : ""}
                value={tempData?.email || ""}
                onChange={handleInputChange}
                disabled={!isEditing}
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
                  value={
                    tempData?.employee?.birthday
                      ? tempData.employee?.birthday.split("T")[0]
                      : ""
                  }
                  onChange={handleInputChange}
                  disabled={!isEditing}
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
                  placeholder={
                    isEditing || tempData?.employee?.gender
                      ? "Enter Gender"
                      : ""
                  }
                  value={tempData?.employee?.gender || ""}
                  onChange={handleInputChange}
                  disabled={!isEditing}
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
                  placeholder={
                    isEditing || tempData?.employee?.contactNumber
                      ? "Enter Contact Number"
                      : ""
                  }
                  value={tempData?.employee?.contactNumber || ""}
                  onChange={handleInputChange}
                  disabled={!isEditing}
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
                  placeholder={
                    isEditing || tempData?.address?.country
                      ? "Enter Country"
                      : ""
                  }
                  value={tempData?.address?.country}
                  onChange={handleInputChange}
                  disabled={!isEditing}
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
                  placeholder={
                    isEditing || tempData?.address?.region ? "Enter Region" : ""
                  }
                  value={tempData?.address?.region}
                  onChange={handleInputChange}
                  disabled={!isEditing}
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
                  placeholder={
                    isEditing || tempData?.address?.province
                      ? "Enter Province"
                      : ""
                  }
                  value={tempData?.address?.province}
                  onChange={handleInputChange}
                  disabled={!isEditing}
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
                  placeholder={
                    isEditing || tempData?.address?.city ? "Enter City" : ""
                  }
                  value={tempData?.address?.city}
                  onChange={handleInputChange}
                  disabled={!isEditing}
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
                  placeholder={
                    isEditing || tempData?.address?.baranagay
                      ? "Enter Barangay"
                      : ""
                  }
                  value={tempData?.address?.barangay}
                  onChange={handleInputChange}
                  disabled={!isEditing}
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
                  placeholder={
                    isEditing || tempData?.address?.street ? "Enter Street" : ""
                  }
                  value={tempData?.address?.street}
                  onChange={handleInputChange}
                  disabled={!isEditing}
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
                  placeholder={
                    isEditing || tempData?.address?.postalCode
                      ? "Enter Postal Code"
                      : ""
                  }
                  value={tempData?.address?.postalCode}
                  onChange={handleInputChange}
                  disabled={!isEditing}
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
                disabled={!isAdmin}
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
                  onChange={handleInputChange}
                  disabled={!isAdmin}
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
                  disabled={!isAdmin}
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
                  placeholder={
                    isEditing || tempData?.emergencyDetails?.contactFirstName
                      ? "Enter Contact First Name"
                      : ""
                  }
                  value={tempData?.emergencyDetails?.contactFirstName}
                  onChange={handleInputChange}
                  disabled={!isEditing}
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
                  placeholder={
                    isEditing || tempData?.emergencyDetails?.contactLastName
                      ? "Enter Contact Last Name"
                      : ""
                  }
                  value={tempData?.emergencyDetails?.contactLastName}
                  onChange={handleInputChange}
                  disabled={!isEditing}
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
                placeholder={
                  isEditing || tempData?.emergencyDetails?.contactEmergency
                    ? "Enter Contact Emergency Number"
                    : ""
                }
                value={tempData?.emergencyDetails?.contactEmergency}
                onChange={handleInputChange}
                disabled={!isEditing}
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
                placeholder={
                  isEditing || tempData?.emergencyDetails?.contactAddress
                    ? "Enter Contact Address"
                    : ""
                }
                value={tempData?.emergencyDetails?.contactAddress}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="settings-button-option-container">
        <button
          className={`settings-button-option ${!isChanged ? "disabled" : ""}`}
          onClick={handleSaveClick}
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

      {isConfirmModalOpen && (
        <ConfirmModal
          title="Confirm Changes"
          message="Are you sure you want to save changes?"
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={handleConfirmSave}
        />
      )}

      {isConfirmedMessageModalOpen && (
        <ConfirmedMessageModal
          message="Save changes successfully."
          onClose={() => setIsConfirmedMessageModalOpen(false)}
        />
      )}
    </div>
  );
};

export default GeneralSettings;
