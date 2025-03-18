import React, { useCallback, useState, useContext } from "react";
import Cropper from "react-easy-crop";
import { UserContext } from "../../../context/UserContext";
import { getCroppedImg } from "../../../utils/cropImage";
import "../Modal.css";
import ConfirmModal from "../Confirm/ConfirmModal";
import ConfirmedMessageModal from "../Confirmed/ConfirmedMessageModal";

const ProfilePhotoCropper = ({ imageSrc, userId, onClose, onCropComplete }) => {
  const { updateUserProfilePhoto } = useContext(UserContext);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedMessageModalOpen, setIsConfirmedMessageModalOpen] =
    useState(false);

  const onCropChange = (crop) => setCrop(crop);
  const onZoomChange = (zoom) => setZoom(zoom);

  const onCropCompleteHandler = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirmedMessage = async () => {
    setIsConfirmModalOpen(false);

    setTimeout(() => setIsConfirmedMessageModalOpen(true), 200);
  };

  const handleCropConfirm = async () => {
    if (!userId) {
      console.error("User ID not provided");
      return;
    }

    if (!croppedAreaPixels) return;

    const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);

    const byteString = atob(croppedImage.split(",")[1]);
    const mimeString = croppedImage.split(",")[0].split(":")[1].split(";")[0];
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([arrayBuffer], { type: mimeString });
    const file = new File([blob], "profile-photo.jpg", { type: mimeString });

    try {
      const formData = new FormData();
      formData.append("profilePhoto", file);

      const response = await fetch(
        `http://localhost:5000/api/auth/users/${userId}/profile-photo`,
        {
          method: "PUT",
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        const newPhotoURL = `http://localhost:5000${data.photoURL}`;
        updateUserProfilePhoto(newPhotoURL);
        onCropComplete(newPhotoURL);
      } else {
        console.error("Failed to update profile photo");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Crop Image</h3>
        <div className="cropper-container">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteHandler}
            onZoomChange={onZoomChange}
          />
        </div>
        <div className="cropper-buttons">
          <button className="cropper-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="cropper-button"
            onClick={() => setIsConfirmModalOpen(true)}
          >
            Save
          </button>
        </div>
      </div>

      {isConfirmModalOpen && (
        <ConfirmModal
          title="Confirm Image"
          message="Are you sure want to save this cropped image?"
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={handleConfirmedMessage}
          confirmText="Save"
        />
      )}

      {isConfirmedMessageModalOpen && (
        <ConfirmedMessageModal
          message="Photo has been successfully updated!"
          onClose={() => setIsConfirmedMessageModalOpen(false)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
};

export default ProfilePhotoCropper;
