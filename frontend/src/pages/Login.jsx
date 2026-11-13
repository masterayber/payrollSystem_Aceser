import { useState, useContext, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import { isAdminRole } from "../utils/roles";
import { CHANGE_PASSWORD_PATH, takeSignInNotice } from "../utils/session";
import { feedbackFromError } from "../utils/feedback";
import {
  IconUserFilled,
  IconLockFilled,
  IconEye,
  IconEyeClosed,
} from "@tabler/icons-react";
import "../styles/Login.css";

// The "Signing in..." circle stays up at least this long, so a quick sign-in shows
// a turn of the circle instead of a flash
const SIGNING_IN_MIN_MS = 600;

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // In-form { type, text } message: a refused sign-in (red), or the message kept by a
  // forced sign-out, inactivity (yellow) or a password reset (green)
  const [message, setMessage] = useState(null);
  // True from Log in until the dashboard opens: the two boxes give way to a spinning
  // circle and the Log in button is disabled, so a second click sends nothing
  const [signingIn, setSigningIn] = useState(false);
  const navigate = useNavigate();
  const { setInitialUserData } = useContext(UserContext);

  // Take the kept message once (it is removed as it is read). Under StrictMode the
  // effect runs twice; the second run finds nothing and leaves the message shown.
  useEffect(() => {
    const notice = takeSignInNotice();
    if (notice) setMessage(notice);
  }, []);

  const handlelogin = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSigningIn(true);
    const startedAt = Date.now();
    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/login",
        {
          username,
          password,
        },
      );

      const waitLeft = SIGNING_IN_MIN_MS - (Date.now() - startedAt);
      if (waitLeft > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitLeft));
      }

      // No "Login Successful" message: the dashboard opening is the confirmation
      const user = response.data.user;

      const updatedUserData = { ...(user || null) };

      localStorage.setItem("token", response.data.token);

      setInitialUserData(updatedUserData);

      if (user?.mustChangePassword) {
        // Signed in with a temporary password: it has to be replaced first
        navigate(CHANGE_PASSWORD_PATH);
      } else if (isAdminRole(response.data.user.role)) {
        navigate("/admin-dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      // Refused: the form comes back with the username still filled in
      setSigningIn(false);
      setMessage(feedbackFromError(error, "Login Failed"));
    }
  };

  return (
    <div className="auth-page login-container">
      <div className="logo-container">
        <img
          src="/assets/aceser-logo.png"
          alt="Company Logo"
          className="company-logo"
        />
      </div>
      <form className="login-form" onSubmit={handlelogin}>
        <h2>ACESER Portal Log In </h2>
        {signingIn ? (
          <div
            className="login-signing-in"
            role="status"
            aria-live="polite"
            aria-label="Signing in"
          >
            <span className="login-signing-in-spinner" aria-hidden="true" />
            <span className="login-signing-in-text" aria-hidden="true">
              Signing in...
            </span>
          </div>
        ) : (
          <>
            <div className="input-group">
              <span className="icon-container">
                <IconUserFilled stroke={2} className="icon" />
              </span>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <span className="icon-container">
                <IconLockFilled stroke={2} className="icon" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span className="icon-container">
                <button
                  type="button"
                  className="toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    // Open Eye Icon
                    <IconEye
                      stroke={2}
                      width={20}
                      height={20}
                      className="toggle"
                    />
                  ) : (
                    // Closed Eye Icon
                    <IconEyeClosed stroke={2} className="toggle" />
                  )}
                </button>
              </span>
            </div>
          </>
        )}

        {message && (
          <p className={`feedback-message ${message.type}`}>{message.text}</p>
        )}

        {!signingIn && (
          <div className="form-links">
            <Link to="/signup" className="sign-up">
              Sign Up
            </Link>
            <Link to="/forgot-password" className="forgot-password">
              Forgot Password?
            </Link>
          </div>
        )}

        <button
          type="submit"
          className="btn login-button"
          disabled={signingIn}
        >
          Log in
        </button>
      </form>
    </div>
  );
};

export default Login;
