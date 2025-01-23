import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/Forgot-password.css";

const ForgotPassword = () => {
    const [email, setEmail] = useState(""); // To store the user's email
    const [loading, setLoading] = useState(false); // Loading state to disable the form during the request
    const [error, setError] = useState(""); // For displaying any errors
    const [successMessage, setSuccessMessage] = useState(""); // For displaying a success message
    const navigate = useNavigate();

    const handleForgotPassword = async (e) => {
        e.preventDefault(); // Prevent form submission from refreshing the page
        setError(""); // Clear previous errors
        setSuccessMessage(""); // Clear previous success message

        if (!email) {
            setError("Please enter your email address.");
            return;
        }

        try {
            setLoading(true); // Indicate loading state
            const response = await axios.post("http://localhost:5000/api/auth/forgot-password", { email });
            setSuccessMessage(response.data.message || "OTP sent to your email."); // Show success message
        } catch (err) {
            setError(err.response?.data?.message || "Failed to send OTP. Please try again.");
        } finally {
            setLoading(false); // Reset loading state
        }
    };

    return (
        <div className="forgot-password-container">
            <form className="forgot-password-form" onSubmit={handleForgotPassword}>
                {/* Back Button */}
                <div className="back-button" onClick={() => navigate("/")}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="icon"
                    >
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M5 12l14 0" />
                        <path d="M5 12l6 6" />
                        <path d="M5 12l6 -6" />
                    </svg>
                </div>

                <h2>Forgot Password</h2>
                <p>Enter your email to receive a password reset OTP.</p>

                {/* Email Input */}
                <div className="input-group">
                    <input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>

                {/* Error or Success Message */}
                {error && <p className="error-message">{error}</p>}
                {successMessage && <p className="success-message">{successMessage}</p>}

                {/* Submit Button */}
                <button type="submit" className="forgot-password-button" disabled={loading}>
                    {loading ? "Sending OTP..." : "Send OTP"}
                </button>
            </form>
        </div>
    );
};

export default ForgotPassword;
