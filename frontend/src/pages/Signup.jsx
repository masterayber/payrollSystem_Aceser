import { useState } from "react";
import axios from "axios";
import { IconArrowLeft } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import "../styles/Signup.css";

const Signup = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    // Validate passwords before proceeding
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    // Remove confirmPassword before sending the request
    const { ...dataToSend } = formData;

    try {
      setLoading(true);
      const response = await axios.post(
        "http://localhost:5000/api/auth/signup",
        dataToSend
      );

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("email", response.data.email);

      alert(response.data.message);
      navigate("/update-info");
    } catch (error) {
      alert(error.response?.data?.message || "Signup Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page signup-container">
      <form className="signup-form" onSubmit={handleSignup}>
        <button
          type="button"
          className="back-button"
          aria-label="Back to login"
          onClick={() => navigate("/")}
        >
          <IconArrowLeft stroke={2} />
        </button>
        <h2>Sign up</h2>
        <p>Sign up to Continue</p>

        <div className="input-section">
          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>
                  First Name <span className="required">*</span>
                </label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="firstName"
                  placeholder="Enter your First Name"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="input-container">
              <div className="label-container">
                <label>
                  Last Name <span className="required">*</span>
                </label>
              </div>
              <div className="input-group-signup">
                <input
                  type="text"
                  name="lastName"
                  placeholder="Enter your Last Name"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="input-container">
            <div className="label-container">
              <label>
                Email <span className="required">*</span>
              </label>
            </div>
            <div className="input-group-signup">
              <input
                type="email"
                name="email"
                placeholder="Enter your Email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="input-container">
            <div className="label-container">
              Username <span className="required">*</span>
            </div>
            <div className="input-group-signup">
              <input
                type="text"
                name="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="input-row">
            <div className="input-container">
              <div className="label-container">
                <label>
                  Password <span className="required">*</span>
                </label>
              </div>
              <div className="input-group-signup">
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="input-container">
              <div className="label-container">
                <label>
                  Confirm Password <span className="required">*</span>
                </label>
              </div>
              <div className="input-group-signup">
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>
        </div>

        <div className="terms-container">
          <div className="checkbox-container">
            <input type="checkbox" id="terms" className="terms" required />
          </div>
          <div>I agree to the Terms and Conditions</div>
        </div>

        <button type="submit" className="signup-button" disabled={loading}>
          {loading ? "Signing Up..." : "Sign up"}
        </button>

        <div className="signin-links">
          <div>Already have an account?</div>
          <div>
            <a href="/" className="sign-in">
              Sign In
            </a>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Signup;
