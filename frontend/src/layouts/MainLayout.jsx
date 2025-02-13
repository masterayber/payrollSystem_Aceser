import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

const MainLayout = ({ children }) => {
  return (
    <div className="page-container">
      <Sidebar />

      <div className="header-content-container">
        <Header />

        {children}
      </div>
    </div>
  );
};

export default MainLayout;
