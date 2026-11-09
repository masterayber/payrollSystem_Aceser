import PasswordSettings from "./PasswordSettings";

// Employee Settings > Manage: the account's own password
const ManageSettings = () => {
  return (
    <div className="settings-content">
      <div className="setting-tab">
        <PasswordSettings />
      </div>
    </div>
  );
};

export default ManageSettings;
