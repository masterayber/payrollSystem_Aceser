import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Verify Pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/Forgot";
import OTP from "./pages/OTP";
import ResetPassword from "./pages/ResetPassword";
import AdditionalInfo from "./pages/AdditionalInfo";
import CreatedAccount from "./pages/CreatedAccount";

// Admin Pages
import AdminDashboard from "./pages/AdminPage/AdminDashboard";
import Employees from "./pages/AdminPage/Employees";
import Deductions from "./pages/AdminPage/Deductions";
import AdminPayslips from "./pages/AdminPage/AdminPayslips";
import AdminAttendance from "./pages/AdminPage/AdminAttendance";
import AdminCalendar from "./pages/AdminPage/AdminCalendar";
import AdminFiling from "./pages/AdminPage/AdminFiling";
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
                      <PrivateRoute
                        allowedRoles={["Admin"]}
                        pageKey="admin-dashboard"
                      >
                        <MainLayout>
                          <AdminDashboard />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="employees"
                    element={
                      <PrivateRoute
                        allowedRoles={["Admin"]}
                        pageKey="employees"
                      >
                        <MainLayout>
                          <Employees />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="deductions"
                    element={
                      <PrivateRoute
                        allowedRoles={["Admin"]}
                        pageKey="deductions"
                      >
                        <MainLayout>
                          <Deductions />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="admin-payslips"
                    element={
                      <PrivateRoute
                        allowedRoles={["Admin"]}
                        pageKey="admin-payslips"
                      >
                        <MainLayout>
                          <AdminPayslips />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="admin-attendance"
                    element={
                      <PrivateRoute
                        allowedRoles={["Admin"]}
                        pageKey="admin-attendance"
                      >
                        <MainLayout>
                          <AdminAttendance />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="admin-calendar"
                    element={
                      <PrivateRoute
                        allowedRoles={["Admin"]}
                        pageKey="admin-calendar"
                      >
                        <MainLayout>
                          <AdminCalendar />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="admin-filing"
                    element={
                      <PrivateRoute
                        allowedRoles={["Admin"]}
                        pageKey="admin-filing"
                      >
                        <MainLayout>
                          <AdminFiling />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="reports"
                    element={
                      <PrivateRoute allowedRoles={["Admin"]} pageKey="reports">
                        <MainLayout>
                          <Reports />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="admin-settings"
                    element={
                      <PrivateRoute
                        allowedRoles={["Admin"]}
                        pageKey="admin-settings"
                      >
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
                      <PrivateRoute
                        allowedRoles={["Employee"]}
                        pageKey="dashboard"
                      >
                        <MainLayout>
                          <Dashboard />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="payroll"
                    element={
                      <PrivateRoute
                        allowedRoles={["Employee"]}
                        pageKey="payroll"
                      >
                        <MainLayout>
                          <Payroll />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="payslips"
                    element={
                      <PrivateRoute
                        allowedRoles={["Employee"]}
                        pageKey="payslips"
                      >
                        <MainLayout>
                          <Payslips />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="attendance"
                    element={
                      <PrivateRoute
                        allowedRoles={["Employee"]}
                        pageKey="attendance"
                      >
                        <MainLayout>
                          <Attendance />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="calendar"
                    element={
                      <PrivateRoute
                        allowedRoles={["Employee"]}
                        pageKey="calendar"
                      >
                        <MainLayout>
                          <Calendar />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="filing"
                    element={
                      <PrivateRoute
                        allowedRoles={["Employee"]}
                        pageKey="filing"
                      >
                        <MainLayout>
                          <Filing />
                        </MainLayout>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <PrivateRoute
                        allowedRoles={["Employee"]}
                        pageKey="settings"
                      >
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
