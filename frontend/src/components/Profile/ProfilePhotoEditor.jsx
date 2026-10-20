import { useContext, useEffect, useRef, useState } from "react";
import { IconCamera } from "@tabler/icons-react";
import { UserContext } from "../../context/UserContext";
import API from "../../api";
import ProfilePhoto from "../ProfilePhoto/ProfilePhoto";
import ProfilePhotoCropper from "../Modals/ProfilePhotoCropper/ProfilePhotoCropper";
import ConfirmModal from "../Modals/Confirm/ConfirmModal";
import ConfirmedMessageModal from "../Modals/Confirmed/ConfirmedMessageModal";

// The signed-in user's photo with the camera menu (set / remove), the cropper
// and the confirmation modals. Shared by both General settings tabs.
const ProfilePhotoEditor = () => {
  const { userData, updateUserProfilePhoto } = useContext(UserContext);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  const [showMenu, setShowMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [isSavedOpen, setIsSavedOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const toggleMenu = (event) => {
    event.stopPropagation();
    setShowMenu((prev) => !prev);
  };

  const handleUploadClick = () => {
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  // The cropper uploads the photo and updates the context itself
  const handleCropComplete = () => {
    setShowCropper(false);
    setTimeout(() => setIsSavedOpen(true), 300);
  };

  const handleRemovePhoto = async () => {
    try {
      const { data } = await API.delete(
        `/api/settings/remove-profile-photo/${userData._id}`,
      );
      updateUserProfilePhoto(data?.user?.profilePhoto);
    } catch (error) {
      console.error("Error removing profile photo", error);
    }
    setIsRemoveConfirmOpen(false);
    setTimeout(() => setIsSavedOpen(true), 300);
  };

  return (
    <>
      <div className="profile-photo-container">
        <ProfilePhoto size="100px" />
        <div className="camera-icon" onClick={toggleMenu}>
          <IconCamera strokeWidth={2} />
        </div>

        {showMenu && (
          <div className="change-photo" ref={menuRef}>
            <button className="dropdown-item" onClick={handleUploadClick}>
              Set Profile Photo
            </button>
            {userData?.profilePhoto && (
              <>
                <hr />
                <button
                  className="dropdown-item"
                  onClick={() => setIsRemoveConfirmOpen(true)}
                >
                  Remove
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={handleFileChange}
      />

      {showCropper && (
        <ProfilePhotoCropper
          imageSrc={selectedImage}
          userId={userData?._id}
          onClose={() => setShowCropper(false)}
          onCropComplete={handleCropComplete}
        />
      )}

      {isRemoveConfirmOpen && (
        <ConfirmModal
          title="Remove Profile Photo"
          message="Are you sure you want to remove your profile photo?"
          onClose={() => setIsRemoveConfirmOpen(false)}
          onConfirm={handleRemovePhoto}
          confirmText="Yes"
          cancelText="No"
        />
      )}

      {isSavedOpen && (
        <ConfirmedMessageModal
          message="Save changes successfully."
          onClose={() => setIsSavedOpen(false)}
        />
      )}
    </>
  );
};

export default ProfilePhotoEditor;
