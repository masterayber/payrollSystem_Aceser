import { createContext, useCallback, useContext } from "react";
import PropTypes from "prop-types";
import { UserContext } from "./UserContext";

export const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const { userData, updateUserDataLocally } = useContext(UserContext);
  const settingsData = userData?.settings || null;
  const setSettingsData = useCallback(
    (value) => {
      const settings =
        typeof value === "function" ? value(settingsData) : value;
      updateUserDataLocally({ settings });
    },
    [settingsData, updateUserDataLocally],
  );

  return (
    <SettingsContext.Provider value={{ settingsData, setSettingsData }}>
      {children}
    </SettingsContext.Provider>
  );
};

SettingsProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
