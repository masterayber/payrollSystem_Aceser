import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// import App from './App';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/Forgot';
import './index.css';
import PrivateRoute from './components/PrivateRoute';
import Dashboard from './pages/Dashboard';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
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