import { useEffect, useState } from "react";
import { UserContext } from "../../../context/UserContext";
import ConfirmModal from "../../Modals/Confirm/ConfirmModal";
import ConfirmedMessageModal from "../../Modals/Confirmed/ConfirmedMessageModal";

const ManageSettings = () => {
  return (
    <div className="settings-content">
      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Manage Account</p>
        </div>
        <div className="setting-tab-container">
          <div className="input-container">
            <div className="label-container">
              <label>Username</label>
            </div>
            <div className="input-group-signup">
              <input type="text" name="username" placeholder="Your Username" />
            </div>
          </div>
        </div>
        <div className="setting-tab-container">
          <div className="input-container">
            <div className="label-container">
              <label>Role</label>
            </div>
            <div className="input-group-signup">
              <input type="text" name="role" placeholder="Your Role" />
            </div>
          </div>
        </div>
        <div className="setting-tab-container">
          <div className="input-container">
            <div className="label-container">
              <label>Status</label>
            </div>
            <div className="input-group-signup">
              <input type="text" name="status" placeholder="Your Status" />
            </div>
          </div>
        </div>
      </div>

      <div className="setting-tab">
        <div className="setting-tab-title">
          <p>Manage Password</p>
        </div>
        <div className="setting-tab-container">
          <div className="input-container">
            <div className="label-container">
              <label>Current Password</label>
            </div>
            <div className="input-group-signup">
              <input
                type="password"
                name="password"
                placeholder="Your Current Password"
              />
            </div>
          </div>
        </div>

        <div className="setting-tab-container">
          <div className="input-container">
            <div className="label-container">
              <label>New Password</label>
            </div>
            <div className="input-group-signup">
              <input
                type="password"
                name="newPassword"
                placeholder="New Password"
              />
            </div>
          </div>
        </div>

        <div className="setting-tab-container">
          <div className="input-container">
            <div className="label-container">
              <label>Confirm Password</label>
            </div>
            <div className="input-group-signup">
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm Password"
              />
            </div>
          </div>
        </div>
        <div className="settings-button-option-container">
          <button className="btn settings-button-option">Save</button>
          <button className="btn settings-button-option">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default ManageSettings;
