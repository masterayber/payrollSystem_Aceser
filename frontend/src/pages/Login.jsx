import { useState, useContext } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import {
  IconUserFilled,
  IconLockFilled,
  IconEye,
  IconEyeClosed,
} from "@tabler/icons-react";
import "../styles/Login.css"; //Importing CSS file

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { setInitialUserData } = useContext(UserContext);

  const handlelogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        "http://localhost:5000/api/auth/login",
        {
          username,
          password,
        },
      );

      alert(response.data.message);

      const user = response.data.user;

      const updatedUserData = { ...(user || null) };

      localStorage.setItem("token", response.data.token);

      setInitialUserData(updatedUserData);

      if (response.data.user.role === "Admin") {
        navigate("/admin-dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      alert(error.response?.data?.message || "Login Failed");
    }
  };

  return (
    <div className="login-container">
      <div className="logo-container">
        <img
          src="/assets/aceser-logo.png"
          alt="Company Logo"
          className="company-logo"
        />
      </div>
      <form className="login-form" onSubmit={handlelogin}>
        <h2>Log In Portal</h2>
        <div className="input-group">
          <span className="icon-container">
            <IconUserFilled
              stroke={2}
              width={24}
              height={24}
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
            <IconLockFilled
              stroke={2}
              width={24}
              height={24}
              className="icon"
            />
          </span>
          <input
            type={showPassword ? "text" : "password"}
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
                <IconEye
                  stroke={2}
                  width={20}
                  height={20}
                  className="toggle-password"
                />
              ) : (
                // Closed Eye Icon
                <IconEyeClosed
                  stroke={2}
                  width={20}
                  height={20}
                  className="toggle-password"
                />
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

        <button type="submit" className="login-button">
          Log in
        </button>
      </form>
    </div>
  );
};

export default Login;
