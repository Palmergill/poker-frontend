// src/components/Profile.js
import React, { useState, useEffect } from 'react';
import { playerService } from '../services/apiService';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await playerService.getProfile();
      setProfile(response.data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load profile');
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading profile...</div>;
  }

  return (
    <div className="profile">
      <h2>Player Profile</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      {profile && (
        <div className="profile-details">
          <p><strong>Username:</strong> {profile.user.username}</p>
          <p><strong>Email:</strong> {profile.user.email}</p>
          
          <div className="profile-note">
            <p><strong>Note:</strong> Each poker game tracks your performance independently. 
               You can buy in for any amount within the table limits for each game.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;