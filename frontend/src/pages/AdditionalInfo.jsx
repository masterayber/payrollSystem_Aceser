import axios from "axios";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/AdditionalInfo.css";

const AdditionalInfo = () => {
  const [address, setAddress] = useState("");
  const [birthday, setBirthday] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [gender, setGender] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactEmergency, setContactEmergency] = useState("");
  const [contactAddress, setContactAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const email = localStorage.getItem("email");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:5000/api/auth/update-info", {
        email,
        address,
        birthday,
        contactNumber,
        gender,
        contactFirstName,
        contactLastName,
        contactEmergency,
        contactAddress,
      });

      alert("Additional info updated successfully!");
      navigate("/dashboard");
    } catch (error) {
      console.error("Error updating info: ", error);
      alert("Failed to update info");
    }
  };

  return (
    <div className="additional-container">
      <form className="additional-form" onSubmit={handleSubmit}>
        <h2>Additional Information</h2>
        <p>Please enter your additional information to continue.</p>

        <div className="input-container-additional">
          <div className="label-container">
            <label>
              Address <span className="required">*</span>
            </label>
          </div>
          <div className="input-group-additional">
            <input
              type="text"
              name="address"
              placeholder="Enter your Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="input-row">
          <div className="input-container-additional">
            <div className="label-container">
              <label>
                Birthday <span className="required">*</span>
              </label>
            </div>
            <div className="input-group-additional">
              <input
                type="date"
                name="birthday"
                placeholder="Enter your Birthday"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-container-additional">
            <div className="label-container">
              <label>
                Contact Number <span className="required">*</span>
              </label>
            </div>
            <div className="input-group-additional">
              <input
                type="text"
                name="contact"
                placeholder="Enter your Contact Number"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className="input-container-additional">
          <label>
            Gender <span className="required">*</span>
          </label>
          <div className="gender-options">
            {["Male", "Female", "Other"].map((option) => (
              <label key={option}>
                <input
                  type="radio"
                  name="gender"
                  value={option}
                  checked={gender === option}
                  onChange={(e) => setGender(e.target.value)}
                />
                {option}
              </label>
            ))}
          </div>
        </div>

        <h2 className="contact-emergency">Emergency Contact Information</h2>

        <div className="input-row">
          <div className="input-container-additional">
            <div className="label-container">
              <label>
                First Name <span className="required">*</span>
              </label>
            </div>
            <div className="input-group-additional">
              <input
                type="text"
                name="firstName"
                placeholder="First Name"
                value={contactFirstName}
                onChange={(e) => setContactFirstName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-container-additional">
            <div className="label-container">
              <label>
                Last Name <span className="required">*</span>
              </label>
            </div>
            <div className="input-group-additional">
              <input
                type="text"
                name="lastName"
                placeholder="Last Name"
                value={contactLastName}
                onChange={(e) => setContactLastName(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className="input-container-additional">
          <div className="label-container">
            <label>
              Contact Emergency Number <span className="required">*</span>
            </label>
          </div>
          <div className="input-group-additional">
            <input
              type="text"
              name="contactEmergencyNumber"
              placeholder="Contact Number"
              value={contactEmergency}
              onChange={(e) => setContactEmergency(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="input-container-additional">
          <div className="label-container">
            <label>
              Contact Emergency Address <span className="required">*</span>
            </label>
          </div>
          <div className="input-group-additional">
            <input
              type="text"
              name="contactEmergencyAddress"
              placeholder="Address"
              value={contactAddress}
              onChange={(e) => setContactAddress(e.target.value)}
              required
            />
          </div>
        </div>

        <button type="submit" className="register-button" disabled={loading}>
          {loading ? "Processing..." : "Register"}
        </button>
      </form>
    </div>
  );
};

export default AdditionalInfo;
