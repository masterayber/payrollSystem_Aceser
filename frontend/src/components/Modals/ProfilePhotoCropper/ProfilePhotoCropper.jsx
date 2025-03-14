import React, { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "../../../utils/cropImage";
import "../Modal.css";
import ConfirmModal from "../Confirm/ConfirmModal";
import ConfimedMessageModal from "../Confirmed/ConfirmedMessageModal";

const ProfilePhotoCropper = ({ imageSrc, userId, onClose, onCropComplete }) => {
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

  const handleCropConfirm = async () => {
    if (!croppedAreaPixels) return;
    const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);

    try {
      const formData = new FormData();
      formData.append("profilePhoto", croppedImage);

      const response = await fetch(
        `http://localhost:5000/api/auth/users/${userId}/profile-photo`,
        {
          method: "PUT",
          body: formData,
        }
      );

      if (response.ok) {
        onCropComplete(croppedImage);
        setIsConfirmModalOpen(false);
        setTimeout(() => setIsConfirmedMessageModalOpen(true), 300);
      } else {
        console.error("Failed to update profile photo");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
    }

    onClose();
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
          onConfirm={handleCropConfirm}
          confirmText="Save"
        />
      )}

      {isConfirmedMessageModalOpen && (
        <ConfimedMessageModal
          message={`Photo saved successfully`}
          onClose={() => setIsConfirmedMessageModalOpen(false)}
        />
      )}
    </div>
  );
};

export default ProfilePhotoCropper;
