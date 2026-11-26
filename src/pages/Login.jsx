import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const { signIn, user, session, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (user && session) {
      navigate(from, { replace: true });
    }
  }, [user, session, from, navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [infoMsg, setInfoMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await signIn({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'Failed to log in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setErrorMsg('Enter your email address above first, then click Forgot password.');
      return;
    }
    if (!supabase) return;
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + import.meta.env.BASE_URL
      });
      if (error) throw error;
      setInfoMsg('Password reset link sent! Check your email inbox.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-brand-logo">📈</span>
          <h1>Welcome to GrowthDesk</h1>
          <p>Sign in to manage your customers and growth campaigns</p>
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

        {infoMsg && (
          <div className="alert alert-success" role="status">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              placeholder="you@yourbusiness.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={loading}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                padding: 0,
                fontSize: 'inherit',
                textDecoration: 'underline'
              }}
            >
              Forgot password?
            </button>
          </p>
          <p style={{ marginTop: 8 }}>
            Don't have an account yet? <Link to="/signup">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

