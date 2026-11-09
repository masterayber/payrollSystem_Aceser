import { useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import usePasswordChange from "../components/PasswordChange/usePasswordChange";
import { homePath } from "../utils/roles";
import { PASSWORD_HINT } from "../utils/password";
import "../styles/ChangePassword.css";

// How long "Password changed." stays on screen before the home page opens
const SUCCESS_DELAY_MS = 1200;

// First sign-in with a temporary password: the account must choose its own password
// before any other page opens (PrivateRoute and the API interceptor send it here).
const ChangePassword = () => {
  const { userData, loading, clearSession } = useContext(UserContext);
  const [isDone, setIsDone] = useState(false);
  const { fields, setField, message, saving, submit } = usePasswordChange({
    onSuccess: () => setIsDone(true),
  });

  // Full page load on purpose: the contexts that were refused while the password was
  // temporary load their data again.
  useEffect(() => {
    if (!isDone) return undefined;
    const timer = setTimeout(
      () => window.location.replace(homePath(userData?.role)),
      SUCCESS_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [isDone, userData?.role]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!localStorage.getItem("token") || !userData) {
    return <Navigate to="/" replace />;
  }

  if (!userData.mustChangePassword && !isDone) {
    return <Navigate to={homePath(userData.role)} replace />;
  }

  const handleSignOut = (event) => {
    event.preventDefault();
    clearSession("");
  };

  return (
    <div className="auth-page reset-password-container change-password-container">
      <form className="reset-form" onSubmit={submit} noValidate>
        <h2 className="reset-title">Set your password</h2>
        <p className="reset-sub">
          You signed in with a temporary password. Choose your own password to
          continue.
        </p>
        <div className="input-container-reset">
          <div className="input-group-reset">
            <input
              type="password"
              name="currentPassword"
              placeholder="Temporary password"
              aria-label="Temporary password"
              autoComplete="current-password"
              value={fields.currentPassword}
              onChange={(e) => setField("currentPassword", e.target.value)}
              disabled={isDone}
            />
          </div>
          <div className="input-group-reset">
            <input
              type="password"
              name="newPassword"
              placeholder="New password"
              aria-label="New password"
              autoComplete="new-password"
              value={fields.newPassword}
              onChange={(e) => setField("newPassword", e.target.value)}
              disabled={isDone}
            />
          </div>
          <div className="input-group-reset">
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm new password"
              aria-label="Confirm new password"
              autoComplete="new-password"
              value={fields.confirmPassword}
              onChange={(e) => setField("confirmPassword", e.target.value)}
              disabled={isDone}
            />
          </div>
        </div>

        <p className="password-rule">{PASSWORD_HINT}</p>

        {message && (
          <p className={`feedback-message ${message.type}`}>{message.text}</p>
        )}

        <button
          type="submit"
          className="reset-button"
          disabled={saving || isDone}
        >
          {saving ? "Saving..." : "Save password"}
        </button>

        <div className="change-password-links">
          <a href="/" className="sign-out-link" onClick={handleSignOut}>
            Sign out
          </a>
        </div>
      </form>
    </div>
  );
};

export default ChangePassword;
