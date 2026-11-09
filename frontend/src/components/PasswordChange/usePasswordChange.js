import { useContext, useState } from "react";
import API from "../../api";
import { UserContext } from "../../context/UserContext";
import { feedbackFromError } from "../../utils/feedback";
import { checkNewPassword } from "../../utils/password";

const EMPTY_FIELDS = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

// Form state and submit for POST /api/auth/change-password. Shared by the
// change-password screen and the Password card in Settings (employee Manage tab,
// admin Security & Privacy tab).
// message is { type, text } for a feedback-message box; onSuccess runs after the
// server accepted the change and mustChangePassword was cleared in userData.
const usePasswordChange = ({ onSuccess } = {}) => {
  const { updateUserDataLocally } = useContext(UserContext);
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const setField = (name, value) =>
    setFields((prev) => ({ ...prev, [name]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const { currentPassword, newPassword, confirmPassword } = fields;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: "warning", text: "Please fill in all three fields." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "warning", text: "Passwords do not match." });
      return;
    }
    const passwordProblem = checkNewPassword(newPassword);
    if (passwordProblem) {
      setMessage({ type: "warning", text: passwordProblem });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const { data } = await API.post("/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      updateUserDataLocally({ mustChangePassword: false });
      setFields(EMPTY_FIELDS);
      setMessage({ type: "success", text: data?.message || "Password changed." });
      onSuccess?.();
    } catch (error) {
      setMessage(feedbackFromError(error, "Could not change the password."));
    } finally {
      setSaving(false);
    }
  };

  return { fields, setField, message, saving, submit };
};

export default usePasswordChange;
