// src/components/Navbar.js
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/apiService';

const Navbar = ({ connectionStatus }) => {
  const navigate = useNavigate();
  const isAuthenticated = authService.isAuthenticated();
  const user = isAuthenticated ? JSON.parse(localStorage.getItem('user')) : null;

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  // Render connection status indicator
  const renderConnectionStatus = () => {
    if (!connectionStatus) return null;

    const statusColors = {
      connected: "#4caf50",
      connecting: "#ff9800", 
      disconnected: "#f44336",
      error: "#f44336",
    };

    return (
      <div 
        className="connection-status"
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: statusColors[connectionStatus] || "#ccc",
          marginRight: "12px",
          display: "flex",
          alignItems: "center"
        }}
        title={connectionStatus} // Show status on hover
      />
    );
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <div className="navbar-brand">
          <Link to="/">🏠 Poker App</Link>
        </div>
        
        {isAuthenticated && (
          <div className="navbar-nav">
            <Link to="/tables" className="nav-link">Tables</Link>
            <Link to="/history" className="nav-link">Match History</Link>
            <Link to="/profile" className="nav-link">Profile</Link>
          </div>
        )}
      </div>
      
      <div className="navbar-right">
        {renderConnectionStatus()}
        {isAuthenticated ? (
          <>
            {user && (
              <span className="nav-item username">Hello, {user.username}</span>
            )}
            <button onClick={handleLogout} className="nav-link logout-btn">Logout</button>
          </>
        ) : (
          <div className="navbar-nav">
            <Link to="/login" className="nav-link">Login</Link>
            <Link to="/register" className="nav-link">Register</Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
