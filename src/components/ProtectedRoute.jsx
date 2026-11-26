import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, session, loading, isConfigured } = useAuth();
  const location = useLocation();

  if (!isConfigured) {
    return (
      <div className="center-container">
        <div className="card notice-card">
          <h2>⚠️ Supabase Not Configured</h2>
          <p>Please check your .env file and restart the development server.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="center-container">
        <div className="spinner"></div>
        <p className="loading-text">Loading GrowthDesk...</p>
      </div>
    );
  }

  if (!user || !session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

