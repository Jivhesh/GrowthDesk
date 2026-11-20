import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const BUSINESS_TYPES = [
  'Salon / Spa',
  'Gym / Fitness',
  'Restaurant / Cafe',
  'Coaching Centre / Tutor',
  'Dental / Clinic',
  'Retail Store',
  'Other Local Business'
];

export default function SignUp() {
  const { signUp, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('Salon / Spa');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!businessName.trim()) {
      setErrorMsg('Please enter your business name.');
      return;
    }
    if (!email.trim() || !password) {
      setErrorMsg('Please enter an email and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await signUp({
        email: email.trim(),
        password,
        businessName: businessName.trim(),
        businessType
      });
      navigate('/');
    } catch (err) {
      console.error('Sign up error:', err);
      setErrorMsg(err.message || 'Failed to sign up. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-brand-logo">📈</span>
          <h1>Create Business Account</h1>
          <p>Get started with GrowthDesk to organize customer follow-ups</p>
        </div>

        {!isConfigured && (
          <div className="alert alert-warning" role="alert">
            ⚠️ Supabase credentials missing. Check <code>.env</code> file.
          </div>
        )}

        {errorMsg && (
          <div className="alert alert-error" role="alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="signup-business-name">Business Name *</label>
            <input
              id="signup-business-name"
              type="text"
              placeholder="e.g. Bella Salon, FitPulse Gym"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="signup-business-type">Business Type</label>
            <select
              id="signup-business-type"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              disabled={loading}
            >
              {BUSINESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="signup-email">Account Email *</label>
            <input
              id="signup-email"
              type="email"
              placeholder="owner@yourbusiness.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="signup-password">Password (min 6 chars) *</label>
            <input
              id="signup-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account? <Link to="/login">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

