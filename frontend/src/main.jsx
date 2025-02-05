import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/Forgot";
import OTP from "./pages/OTP";
import ResetPassword from "./pages/ResetPassword";
import AdditionalInfo from "./pages/AdditionalInfo";
import CreatedAccount from "./pages/CreatedAccount";
import "./index.css";
import PrivateRoute from "./components/PrivateRoute";
import Dashboard from "./pages/Dashboard";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="otp" element={<OTP />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="update-info" element={<AdditionalInfo />} />
        <Route path="created-account/:id" element={<CreatedAccount />} />
        <Route
          path="dashboard"
          element={
            <PrivateRoute>
              <Dashboard /> {/* Create a Dashboard Content */}
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
