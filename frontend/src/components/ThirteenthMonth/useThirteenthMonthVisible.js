import { useState } from "react";

// The Show/Hide choice of a 13th month section, one per browser. The profile card
// and the Reports section keep one each, so opening one does not open the other.
export const CARD_VISIBLE_KEY = "aceser.thirteenthMonthCard.visible";
export const REPORT_VISIBLE_KEY = "aceser.thirteenthMonthReport.visible";

// Hidden unless "true" was saved; any storage error (blocked, private mode) falls
// back to hidden.
const readVisible = (key) => {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
};

const saveVisible = (key, isVisible) => {
  try {
    localStorage.setItem(key, String(isVisible));
  } catch {
    // Not remembered; the section still opens and closes for this visit
  }
};

// [isVisible, toggleVisible] for the section remembered under `key`
const useThirteenthMonthVisible = (key) => {
  const [isVisible, setIsVisible] = useState(() => readVisible(key));

  const toggleVisible = () => {
    const next = !isVisible;
    setIsVisible(next);
    saveVisible(key, next);
  };

  return [isVisible, toggleVisible];
};

export default useThirteenthMonthVisible;
