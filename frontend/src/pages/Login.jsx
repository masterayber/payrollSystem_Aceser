import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import '../styles/Login.css'; //Importing CSS file

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

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
        }catch (error) {
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
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="icon"><path d="M12.5001 4.16669C13.6052 4.16669 14.665 4.60567 15.4464 5.38708C16.2278 6.16848 16.6667 7.22829 16.6667 8.33335C16.6667 9.43842 16.2278 10.4982 15.4464 11.2796C14.665 12.061 13.6052 12.5 12.5001 12.5C11.395 12.5 10.3352 12.061 9.5538 11.2796C8.7724 10.4982 8.33342 9.43842 8.33342 8.33335C8.33342 7.22829 8.7724 6.16848 9.5538 5.38708C10.3352 4.60567 11.395 4.16669 12.5001 4.16669ZM12.5001 14.5834C17.1042 14.5834 20.8334 16.4479 20.8334 18.75V20.8334H4.16675V18.75C4.16675 16.4479 7.89592 14.5834 12.5001 14.5834Z" /></svg>
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
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="icon"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 2a5 5 0 0 1 5 5v3a3 3 0 0 1 3 3v6a3 3 0 0 1 -3 3h-10a3 3 0 0 1 -3 -3v-6a3 3 0 0 1 3 -3v-3a5 5 0 0 1 5 -5m0 12a2 2 0 0 0 -1.995 1.85l-.005 .15a2 2 0 1 0 2 -2m0 -10a3 3 0 0 0 -3 3v3h6v-3a3 3 0 0 0 -3 -3" /></svg>
                    </span>
                    <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <span className="icon-container">
                        <button
                            type="button"
                            className="toggle-password"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? (
                                // Open Eye Icon
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="toggle-password"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>
                            ) : (
                                // Closed Eye Icon
                                <svg  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="toggle-password"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" /><path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" /><path d="M3 3l18 18" /></svg>
                            )}
                        </button>
                    </span>
                </div>
                <div className="form-links">
                    <Link to="/signup" className="sign-up">
                        Sign Up
                    </Link>
                    <Link to="/forgot-password" className="forgot-password">
                        Forgot Password?
                    </Link>
                </div>
                <button type="submit" className="login-button">Log in</button>
            </form>
        </div>
    );
};

export default Login;