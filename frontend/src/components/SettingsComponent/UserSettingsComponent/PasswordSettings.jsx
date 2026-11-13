import usePasswordChange from "../../PasswordChange/usePasswordChange";
import { PASSWORD_HINT } from "../../../utils/password";
import "../../Profile/Profile.css";
import "../SettingsComponent.css";

const FIELDS = {
  currentPassword: { label: "Current password", autoComplete: "current-password" },
  newPassword: { label: "New password", autoComplete: "new-password" },
  confirmPassword: { label: "Confirm new password", autoComplete: "new-password" },
};

// "Password" card for the signed-in account's own password: employee Settings >
// Manage, and at the bottom of admin Settings > General (GeneralSettings
// `showPassword`, since D2). Drawn as a profile card; shows no role. Same route and
// checks as the change-password screen; the fields clear when the change is saved.
const PasswordSettings = () => {
  const { fields, setField, message, saving, submit } = usePasswordChange();

  const renderField = (name) => (
    <div className="input-container" key={name}>
      <div className="label-container">
        <label htmlFor={`password-${name}`}>{FIELDS[name].label}</label>
      </div>
      <div className="input-group-signup">
        <input
          id={`password-${name}`}
          type="password"
          name={name}
          placeholder={`Enter ${FIELDS[name].label}`}
          autoComplete={FIELDS[name].autoComplete}
          value={fields[name]}
          onChange={(event) => setField(name, event.target.value)}
        />
      </div>
    </div>
  );

  return (
    <section className="profile-card password-settings">
      <h4 className="profile-card-title">Password</h4>

      <form className="password-settings-form" onSubmit={submit} noValidate>
        {renderField("currentPassword")}
        <div className="input-row">
          {renderField("newPassword")}
          {renderField("confirmPassword")}
        </div>

        <p className="setting-section-text-description">{PASSWORD_HINT}</p>

        {message && (
          <p className={`feedback-message ${message.type}`}>{message.text}</p>
        )}

        <div className="settings-button-option-container">
          <button
            type="submit"
            className={`btn settings-button-option ${saving ? "disabled" : ""}`}
            disabled={saving}
          >
            {saving ? "Saving..." : "Change password"}
          </button>
        </div>
      </form>
    </section>
  );
};

export default PasswordSettings;
