import { createContext, useEffect, useState } from "react";
import axios from "axios";

export const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [settingsData, setSettingsData] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(
          "http://localhost:5000/api/auth/settings"
        );
        setSettingsData(response.data);
      } catch (error) {
        console.error("Error fetching settings data:", error);
      }
    };

    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settingsData, setSettingsData }}>
      {children}
    </SettingsContext.Provider>
  );
};
