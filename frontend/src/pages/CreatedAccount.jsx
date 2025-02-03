import { useNavigate } from "react-router-dom";
import "../styles/CreatedAccount.css";

const CreatedAccount = () => {
  const navigate = useNavigate();
  return (
    <div className="created-container">
      <form className="created-form">
        <h2>Account Created Successfully!</h2>

        <span className="icon-container">
          <svg
            width="70"
            height="70"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="14"
              cy="14"
              r="12"
              stroke="#000000"
              strokeWidth="2"
              fill="white"
            />

            <circle cx="14" cy="9" r="4" fill="#000000" />

            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M7 22C7 18 10 15 14 15C18 15 21 18 21 22H7Z"
              fill="#000000"
            />
          </svg>
        </span>
        <p>
          The account has been created successfully. You can now go to
          dashboard.
        </p>

        <button
          className="dashboard-button"
          onClick={() => navigate("/dashboard")}
        >
          Go to Dashboard
        </button>
      </form>
    </div>
  );
};

export default CreatedAccount;
