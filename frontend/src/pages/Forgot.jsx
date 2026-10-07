import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/Forgot.css";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true); // Start loading
    setMessage(""); // Reset the message

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage("Please enter a valid email address");
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/forgot-password",
        { email }
      );
      setMessage(response.data.message);
      navigate("/otp", {
        state: { email, expiresAt: response.data.expiresAt },
      });
    } catch (error) {
      setMessage(error.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false); // Stop loading
    }
  };

  return (
    <div className="auth-page forgotPassword-container">
      <form className="forgotPassword-form" onSubmit={handleForgot}>
        <h2>Find your account</h2>
        <p>
          Please enter your email to search for your account and reset your
          password
        </p>
        <div className="input-container">
          <div className="input-group-forgot">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>
        {message && <p className="feedback-message">{message}</p>}
        <div className="button-container">
          <button className="cancel-button" onClick={() => navigate("/")}>
            Cancel
          </button>
          <button type="submit" className="send-button" disabled={loading}>
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ForgotPassword;
