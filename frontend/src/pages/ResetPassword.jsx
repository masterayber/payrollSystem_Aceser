import { useEffect, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/Reset.css";
import { feedbackFromError } from "../utils/feedback";
import { checkNewPassword, PASSWORD_HINT } from "../utils/password";
import { keepSignInNotice } from "../utils/session";

const RESET_DONE_MESSAGE = "Password reset successfully! Please log in.";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const resetToken = location.state?.resetToken;

  // Opened without a code check (typed address, page reload): back to Forgot Password
  useEffect(() => {
    if (resetToken) return undefined;
    const timer = setTimeout(() => navigate("/forgot-password"), 3000);
    return () => clearTimeout(timer);
  }, [resetToken, navigate]);

  if (!resetToken) {
    return (
      <div className="auth-page reset-password-container">
        <div className="reset-form">
          <h2 className="reset-title">Reset Password</h2>
          <p className="feedback-message error">
            Invalid session. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage({ type: "warning", text: "Passwords do not match" });
      return;
    }
    const passwordProblem = checkNewPassword(password);
    if (passwordProblem) {
      setMessage({ type: "warning", text: passwordProblem });
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/reset-password",
        {
          resetToken,
          password,
        },
      );

      // Green on this card, and kept for the sign-in page that opens next
      const text = response.data?.message || RESET_DONE_MESSAGE;
      setMessage({ type: "success", text });
      keepSignInNotice(text, "success");
      navigate("/");
    } catch (error) {
      setMessage(feedbackFromError(error, "Error occurred"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page reset-password-container">
      <form className="reset-form" onSubmit={handleResetPassword}>
        <h2 className="reset-title">Reset Password</h2>
        <p className="reset-sub">Please enter new password</p>
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

        <p className="password-rule">{PASSWORD_HINT}</p>

        {message && (
          <p className={`feedback-message ${message.type}`}>{message.text}</p>
        )}

        <button type="submit" className="reset-button" disabled={loading}>
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
