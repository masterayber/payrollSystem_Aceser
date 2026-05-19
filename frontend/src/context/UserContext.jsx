import { createContext, useState, useEffect, useCallback } from "react";
import propTypes from "prop-types";
import API from "../api";

const INACTIVITY_LIMIT = 60 * 60 * 1000;
const ACTIVITY_EVENTS = [
  "click",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
];

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const clearSession = useCallback((reason = "") => {
    localStorage.removeItem("token");
    localStorage.removeItem("userData");
    localStorage.removeItem("lastActivity");
    setUserData(null);
    if (reason === "inactive") {
      window.alert("session ended due to inactivity.");
    }
    window.location.replace("/");
  }, []);

  const refreshLastActivity = useCallback(() => {
    if (!localStorage.getItem("token") || !localStorage.getItem("userData")) {
      return;
    }
    localStorage.setItem("lastActivity", Date.now().toString());
  }, []);

  const setInitialUserData = useCallback((user) => {
    if (!user) return;
    setUserData(user);
    localStorage.setItem("userData", JSON.stringify(user));
    localStorage.setItem("lastActivity", Date.now().toString());
  }, []);

  const refreshUserData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setIsRefreshing(true);
      const response = await API.get("/api/auth/me");
      const user = response.data.user;

      if (user) {
        setUserData(user);
        localStorage.setItem("userData", JSON.stringify(user));
        localStorage.setItem("lastActivity", Date.now().toString());
      }
      return true;
    } catch (error) {
      console.error("Error refreshing user data:", error);
      clearSession();
      return false;
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, [clearSession]);

  const refreshDataSection = useCallback(
    async (sections = ["attendance", "leaveRequests", "overtimeRequests"]) => {
      const token = localStorage.getItem("token");
      if (!token || !userData?._id) return;

      try {
        setIsRefreshing(true);
        const response = await API.get("/api/auth/me");
        const freshData = response.data.user;

        setUserData((prev) => {
          if (!prev) return prev;
          const updated = { ...prev };

          sections.forEach((section) => {
            if (freshData[section] !== undefined) {
              updated[section] = freshData[section];
            }
          });

          localStorage.setItem("userData", JSON.stringify(updated));
          return updated;
        });

        return true;
      } catch (error) {
        console.error("Error refreshing data section:", error);
        return false;
      } finally {
        setIsRefreshing(false);
      }
    },
    [userData],
  );

  const updateUserDataLocally = useCallback((updates) => {
    setUserData((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem("userData", JSON.stringify(updated));
      return updated;
    });
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem("userData");
    const lastActivity = Number(localStorage.getItem("lastActivity"));

    if (storedUser) {
      setUserData(JSON.parse(storedUser));
    }

    if (!localStorage.getItem("token")) {
      setLoading(false);
      return;
    }

    if (!lastActivity || Date.now() - lastActivity > INACTIVITY_LIMIT) {
      clearSession("inactive");
      return;
    }

    refreshUserData();
  }, [clearSession, refreshUserData]);

  useEffect(() => {
    const handleActivity = () => {
      if (!userData) return;
      refreshLastActivity();
    };

    ACTIVITY_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, handleActivity);
    });

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, handleActivity);
      });
    };
  }, [refreshLastActivity, userData]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const lastActivity = Number(localStorage.getItem("lastActivity"));
      const token = localStorage.getItem("token");

      if (!token) {
        return;
      }

      if (!lastActivity || Date.now() - lastActivity > INACTIVITY_LIMIT) {
        clearSession("inactive");
      }
    }, 60 * 1000);

    return () => clearInterval(intervalId);
  }, [clearSession]);

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
      value={{
        userData,
        setUserData,
        setInitialUserData,
        refreshUserData,
        refreshDataSection,
        updateUserDataLocally,
        clearSession,
        loading,
        isRefreshing,
        updateUserProfilePhoto,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

UserProvider.propTypes = {
  children: propTypes.node.isRequired,
};
