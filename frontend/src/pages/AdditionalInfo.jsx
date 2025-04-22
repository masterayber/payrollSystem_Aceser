import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/AdditionalInfo.css";

const AdditionalInfo = () => {
  const [formData, setFormData] = useState({
    birthday: "",
    contactNumber: "",
    gender: "",
    contactFirstName: "",
    contactLastName: "",
    contactEmergency: "",
    contactAddress: "",
  });

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const email = localStorage.getItem("email");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/update-info",
        {
          email,
          ...formData,
        }
      );

      if (response.data.userId) {
        navigate(`/created-account/${response.data.userId}`);
      } else {
        alert("User ID not found in response");
      }
    } catch (error) {
      alert(error.response?.data?.message || "Update Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="additional-container">
      <form className="additional-form" onSubmit={handleSubmit}>
        <h2>Additional Information</h2>
        <p>Please enter your additional information to continue.</p>

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
                value={formData.birthday}
                onChange={handleChange}
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
                name="contactNumber"
                placeholder="Enter your Contact Number"
                value={formData.contactNumber}
                onChange={handleChange}
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
            {["Male", "Female"].map((option) => (
              <label key={option}>
                <input
                  type="radio"
                  name="gender"
                  value={option}
                  checked={formData.gender === option}
                  onChange={handleChange}
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
                name="contactFirstName"
                placeholder="First Name"
                value={formData.contactFirstName}
                onChange={handleChange}
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
                name="contactLastName"
                placeholder="Last Name"
                value={formData.contactLastName}
                onChange={handleChange}
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
              name="contactEmergency"
              placeholder="Contact Number"
              value={formData.contactEmergency}
              onChange={handleChange}
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
              name="contactAddress"
              placeholder="Address"
              value={formData.contactAddress}
              onChange={handleChange}
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
