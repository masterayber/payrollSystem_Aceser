import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css'; //Importing CSS file

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handlelogin = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:5000/api/auth/login', {
                username,
                password,
            });
            alert(response.data.message);
            localStorage.setItem('token', response.data.token);
            //Redirect to another page after login(e.g., Dashboard)
            navigate('/dashboard');
        }   catch (error) {
            alert(error.response?.data?.message || 'Login Failed');
        }
    };

    return (
        <div className="login-container">
            <div className="logo-container">
                <img
                    src="/assets/aceser-logo.jpg"
                    alt="Company Logo"
                    className="logo"
                />
            </div>
            <form className="login-form" onSubmit={handlelogin}>
                <h2>Log In Portal</h2>
                <div className="input-group">
                    <span className="icon-container">
                        <img
                            src='/assets/icons/user.svg'
                            alt="Username Icon"
                            className="icon"
                        />
                    </span>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                <div className="input-group">
                    <span className="icon-container">
                        <img
                            src='/assets/icons/lock.svg'
                            alt="Username Icon"
                            className="icon"
                        />
                    </span>
                    <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button
                        type="button"
                        className="toggle-password"
                        onClick={() => setShowPassword(!showPassword)}
                    >
                        <img
                            src={
                                showPassword
                                    ? '/assets/icons/eye-icon-open.svg'
                                    : '/assets/icons/eye-icon-closed.svg'
                            }
                            alt={showPassword ? "Hide Password" : "Show Password"}
                        />
                    </button>
                </div>
                <div className="form-links">
                    <a href="/signup" className="sign-up">
                        Sign Up
                    </a>
                    <a href="/forgot-password" className="forgot-password">
                        Forgot Password?
                    </a>
                </div>
                <button type="submit" className="login-button">Log in</button>
            </form>
        </div>
    );
};

export default Login;