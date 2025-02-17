import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

const MainLayout = ({ children }) => {
  return (
    <div className="page-container">
      <Sidebar />
      <Header />
      {children}
    </div>
  );
};

export default MainLayout;
