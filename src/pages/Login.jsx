import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';

function formatAuthError(message) {
  if (!message) return 'Authentication failed. Please try again.';
  const lower = message.toLowerCase();
  if (lower.includes('rate limit')) {
    return 'Email rate limit exceeded (Supabase free tier allows 2 auth emails/hour). Wait a bit, or turn off "Confirm email" in Supabase Dashboard → Authentication → Providers → Email.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'Invalid email or password. Double-check your password (use the eye icon) or reset it with "Forgot password?".';
  }
  return message;
}

export default function Login() {
  const { signIn, updatePassword, passwordRecovery, user, session, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (user && session && !passwordRecovery) {
      navigate(from, { replace: true });
    }
  }, [user, session, passwordRecovery, from, navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetCooldown, setResetCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [infoMsg, setInfoMsg] = useState(null);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const t = setTimeout(() => setResetCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resetCooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
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
      setErrorMsg(formatAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (resetCooldown > 0) return;
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
        redirectTo: window.location.origin + import.meta.env.BASE_URL + 'login'
      });
      if (error) throw error;
      setResetCooldown(60);
      setInfoMsg('Password reset link sent! Check your email inbox.');
    } catch (err) {
      setErrorMsg(formatAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await updatePassword(newPassword);
      navigate('/', { replace: true });
    } catch (err) {
      setErrorMsg(formatAuthError(err.message));
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

        {passwordRecovery ? (
          <form onSubmit={handleUpdatePassword} className="auth-form" noValidate>
            <div className="form-group">
              <label htmlFor="new-password">New Password (min 6 chars)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Updating...' : 'Set New Password'}
            </button>
          </form>
        ) : (
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
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        )}

        <div className="auth-footer">
          {!passwordRecovery && (
            <p>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={loading || resetCooldown > 0}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  cursor: resetCooldown > 0 ? 'not-allowed' : 'pointer',
                  padding: 0,
                  fontSize: 'inherit',
                  textDecoration: 'underline'
                }}
              >
                {resetCooldown > 0 ? `Forgot password? (${resetCooldown}s)` : 'Forgot password?'}
              </button>
            </p>
          )}
          <p style={{ marginTop: 8 }}>
            Don't have an account yet? <Link to="/signup">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

