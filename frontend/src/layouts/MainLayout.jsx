import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { useContext } from "react";
import { UserContext } from "../context/UserContext";

const MainLayout = ({ children }) => {
  const { userData } = useContext(UserContext);
  return (
    <div className="page-container">
      <Sidebar role={userData?.role} allowedPages={userData?.allowedPages} />
      <Header role={userData?.role} />
      {children}
    </div>
  );
};

export default MainLayout;
