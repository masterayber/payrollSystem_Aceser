import { useState, useEffect } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/OTP.css";
import { feedbackFromError } from "../utils/feedback";

const OTP = () => {
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300000); // Initial timer in milliseconds
  const [expiresAt, setExpiresAt] = useState(Date.now() + 300000); // Initial expiration time
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      setMessage({
        type: "error",
        text: "Invalid session. Please try again.",
      });

      setTimeout(() => {
        navigate("/forgot-password");
      }, 3000);
    }
  }, [email, navigate]);

  useEffect(() => {
    const countdown = () => {
      const now = Date.now();
      const timeRemaining = Math.max(0, expiresAt - now);
      setTimeLeft(timeRemaining);

      if (timeRemaining === 0) {
        clearInterval(timer); // Stop the timer if it reaches 0
      }
    };

    countdown(); // Call it immediately to set the initial state
    const timer = setInterval(() => {
      countdown();
    }, 1000); // Then run every second

    return () => clearInterval(timer); // Cleanup on component unmount
  }, [expiresAt]);

  const handleOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await axios.post("http://localhost:5000/api/auth/otp", {
        email,
        otp,
      });
      setMessage({ type: "success", text: response.data.message });
      alert(response.data.message);
      navigate("/reset-password", {
        state: { resetToken: response.data.resetToken },
      });
    } catch (error) {
      setMessage(feedbackFromError(error, "Error occurred"));
      alert(error.response?.data?.message || "Error Occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/forgot-password",
        { email },
      );
      setMessage({ type: "success", text: response.data.message });

      const newExpiresAt = response.data.expiresAt; // Get new expiration time
      setExpiresAt(newExpiresAt); // Update the expiration time
      setTimeLeft(newExpiresAt - Date.now()); // Reset the timer
    } catch (error) {
      setMessage(feedbackFromError(error, "Error occurred"));
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 1000 / 60);
    const seconds = Math.floor((time / 1000) % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="auth-page otp-container">
      <form className="otp-form" onSubmit={handleOtp}>
        <h2 className="otp-title">OTP</h2>
        <p className="otp-sub">Please enter your OTP sent to your email</p>
        <div className="email-container">
          <p>
            Your email is: <b>{email}</b>
          </p>
        </div>

        <div className="otp-input-row">
          <div className="input-group-otp">
            <input
              type="text"
              name="otp"
              placeholder="Enter 6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="\d{6}"
              title="Enter the 6-digit code from your email"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              required
            />
          </div>

          <button
            type="button"
            className="timer-button"
            disabled={timeLeft > 0 || loading}
            onClick={handleResend}
          >
            {timeLeft > 0 ? formatTime(timeLeft) : "Resend OTP"}
          </button>
        </div>

        {message && (
          <p className={`feedback-message ${message.type}`}>{message.text}</p>
        )}

        <div className="button-container">
          <button type="submit" className="verify-button" disabled={loading}>
            {loading ? "Verifying..." : "Verify"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OTP;
