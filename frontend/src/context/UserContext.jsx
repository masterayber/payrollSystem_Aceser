import { createContext, useState, useEffect } from "react";
import propTypes from "prop-types";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("userData");
    if (storedUser) {
      setUserData(JSON.parse(storedUser));
    }
  }, []);

  const updateUserProfilePhoto = (newProfilePhoto) => {
    setUserData((prev) => {
      if (!prev) return null;
      const updatedUser = { ...prev, profilePhoto: newProfilePhoto };
      localStorage.setItem("userData", JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  return (
    <UserContext.Provider
      value={{ userData, setUserData, updateUserProfilePhoto }}
    >
      {children}
    </UserContext.Provider>
  );
};

UserProvider.propTypes = {
  children: propTypes.node.isRequired,
};
