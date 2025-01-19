import React  from "react";

const Dashboard = () => {
    const handleLogout = () => {
        localStorage.removeItem('token');
        window.location.href = '/';
    };

    return (
        <div>
            <h1>Welcome to the Dashboard</h1>
            <p>This is the protected route that only logged-in users can access.</p>
            <p>If this page shows, the login page works :&gt;</p>
            <button onClick={handleLogout}>Logout</button>
        </div>
    );
};

export default Dashboard;