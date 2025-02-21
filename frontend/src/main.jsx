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

import AdminDashboard from "./pages/AdminPage/AdminDashboard";

import Dashboard from "./pages/Dashboard";
import Payroll from "./pages/Payroll";
import Payslips from "./pages/Payslips";
import Attendance from "./pages/Attendance";
import Calendar from "./pages/Calendar";
import Filing from "./pages/Filing";
import Settings from "./pages/Settings";

import "./index.css";
import PrivateRoute from "./components/PrivateRoute";
import { UserProvider } from "./context/UserContext";
import MainLayout from "./layouts/MainLayout";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UserProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="otp" element={<OTP />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="update-info" element={<AdditionalInfo />} />
          <Route path="created-account/:id" element={<CreatedAccount />} />

          {/* Admin Routes */}
          <Route
            path="admin-dashboard"
            element={
              <PrivateRoute allowedRoles={["admin"]}>
                <MainLayout>
                  <AdminDashboard />
                </MainLayout>
              </PrivateRoute>
            }
          />

          {/* Protected Routes with User Layout */}
          <Route
            path="dashboard"
            element={
              <PrivateRoute allowedRoles={["user"]}>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="payroll"
            element={
              <PrivateRoute allowedRoles={["user"]}>
                <MainLayout>
                  <Payroll />
                </MainLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="payslips"
            element={
              <PrivateRoute allowedRoles={["user"]}>
                <MainLayout>
                  <Payslips />
                </MainLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="attendance"
            element={
              <PrivateRoute allowedRoles={["user"]}>
                <MainLayout>
                  <Attendance />
                </MainLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="calendar"
            element={
              <PrivateRoute allowedRoles={["user"]}>
                <MainLayout>
                  <Calendar />
                </MainLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="filing"
            element={
              <PrivateRoute allowedRoles={["user"]}>
                <MainLayout>
                  <Filing />
                </MainLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="settings"
            element={
              <PrivateRoute allowedRoles={["user"]}>
                <MainLayout>
                  <Settings />
                </MainLayout>
              </PrivateRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  </React.StrictMode>
);
