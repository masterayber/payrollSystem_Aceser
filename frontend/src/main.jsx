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
import Employees from "./pages/AdminPage/Employees";
import Deductions from "./pages/AdminPage/Deductions";
import AdminPayslips from "./pages/AdminPage/AdminPayslips";
import AdminAttendance from "./pages/AdminPage/AdminAttendance";
import AdminCalendar from "./pages/AdminPage/AdminCalendar";
import Reports from "./pages/AdminPage/Reports";
import AdminSettings from "./pages/AdminPage/AdminSettings";

import Dashboard from "./pages/UserPage/Dashboard";
import Payroll from "./pages/UserPage/Payroll";
import Payslips from "./pages/UserPage/Payslips";
import Attendance from "./pages/UserPage/Attendance";
import Calendar from "./pages/UserPage/Calendar";
import Filing from "./pages/UserPage/Filing";
import Settings from "./pages/UserPage/Settings";

import "./index.css";
import PrivateRoute from "./components/PrivateRoute";
import ScrollToTop from "./components/ScrollToTop/ScrollToTop";
import { UserProvider } from "./context/UserContext";
import { EmployeeProvider } from "./context/EmployeeContext";
import { SettingsProvider } from "./context/SettingsContext";
import { AttendanceProvider } from "./context/AttendanceContext";
import { FilingProvider } from "./context/FilingContext";
import MainLayout from "./layouts/MainLayout";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UserProvider>
      <EmployeeProvider>
        <SettingsProvider>
          <AttendanceProvider>
            <FilingProvider>
              <BrowserRouter>
                <ScrollToTop />
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Login />} />
                  <Route path="signup" element={<Signup />} />
                  <Route path="forgot-password" element={<ForgotPassword />} />
                  <Route path="otp" element={<OTP />} />
                  <Route path="reset-password" element={<ResetPassword />} />
                  <Route path="update-info" element={<AdditionalInfo />} />
                  <Route
                    path="created-account/:id"
                    element={<CreatedAccount />}
                  />

                  {/* Admin Routes */}
                  <Route
                    path="admin-dashboard"
                    element={
                      <PrivateRoute allowedRoles={["Admin"]}>
                        <MainLayout>
                          <AdminDashboard />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="employees"
                    element={
                      <PrivateRoute allowedRoles={["Admin"]}>
                        <MainLayout>
                          <Employees />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="deductions"
                    element={
                      <PrivateRoute allowedRoles={["Admin"]}>
                        <MainLayout>
                          <Deductions />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="admin-payslips"
                    element={
                      <PrivateRoute allowedRoles={["Admin"]}>
                        <MainLayout>
                          <AdminPayslips />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="admin-attendance"
                    element={
                      <PrivateRoute allowedRoles={["Admin"]}>
                        <MainLayout>
                          <AdminAttendance />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="admin-calendar"
                    element={
                      <PrivateRoute allowedRoles={["Admin"]}>
                        <MainLayout>
                          <AdminCalendar />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="reports"
                    element={
                      <PrivateRoute allowedRoles={["Admin"]}>
                        <MainLayout>
                          <Reports />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="admin-settings"
                    element={
                      <PrivateRoute allowedRoles={["Admin"]}>
                        <MainLayout>
                          <AdminSettings />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />

                  {/* Protected Routes with Employee Layout */}
                  <Route
                    path="dashboard"
                    element={
                      <PrivateRoute allowedRoles={["Employee"]}>
                        <MainLayout>
                          <Dashboard />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="payroll"
                    element={
                      <PrivateRoute allowedRoles={["Employee"]}>
                        <MainLayout>
                          <Payroll />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="payslips"
                    element={
                      <PrivateRoute allowedRoles={["Employee"]}>
                        <MainLayout>
                          <Payslips />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="attendance"
                    element={
                      <PrivateRoute allowedRoles={["Employee"]}>
                        <MainLayout>
                          <Attendance />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="calendar"
                    element={
                      <PrivateRoute allowedRoles={["Employee"]}>
                        <MainLayout>
                          <Calendar />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="filing"
                    element={
                      <PrivateRoute allowedRoles={["Employee"]}>
                        <MainLayout>
                          <Filing />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <PrivateRoute allowedRoles={["Employee"]}>
                        <MainLayout>
                          <Settings />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                </Routes>
              </BrowserRouter>
            </FilingProvider>
          </AttendanceProvider>
        </SettingsProvider>
      </EmployeeProvider>
    </UserProvider>
  </React.StrictMode>,
);
