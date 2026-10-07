import { useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/Reset.css";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const setMessage = useState("");
  const [loading, setLoading] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const resetToken = location.state?.resetToken;

  if (!resetToken) {
    setTimeout(() => navigate("/forgot-password"), 3000);
    return alert("Invalid session. Redirecting...");
  }

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/reset-password",
        {
          resetToken,
          password,
        }
      );

      setMessage(response.data.message);
      alert("Password reset successfully! Please log in.");
      navigate("/");
    } catch (error) {
      setMessage(error.response?.data?.message || "Error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page reset-password-container">
      <form className="reset-form" onSubmit={handleResetPassword}>
        <h2>Reset Password</h2>
        <p>Please enter new password</p>
        <div className="input-container-reset">
          <div className="input-group-reset">
            <input
              type="password"
              name="password"
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="input-group-reset">
            <input
              type="password"
              name="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="button-container">
          <button className="cancel-button" onClick={() => navigate("/")}>
            Cancel
          </button>
          <button type="submit" className="reset-button" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ResetPassword;
