import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';

export default function Layout() {
  const { user, business, signOut } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Failed to log out:', err);
    }
  };

  const navItems = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/customers', label: 'Customers', icon: '👥' },
    { to: '/follow-ups', label: 'Follow-ups', icon: '⏰' },
    { to: '/messages', label: 'WhatsApp', icon: '💬' },
    { to: '/campaigns', label: 'Campaigns', icon: '📢' },
    { to: '/settings', label: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className="app-shell">
      {/* Top Header */}
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-logo">📈</span>
          <span className="brand-name">GrowthDesk</span>
          {business?.name && (
            <span className="business-badge" title="Active business">
              {business.name}
            </span>
          )}
        </div>
        <div className="header-actions">
          {/* Minimalist Monkeytype Theme Selector */}
          <div className="theme-selector-pill" title="Switch Theme">
            <span className="theme-pill-icon">🎨</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              aria-label="Select theme"
              className="theme-select-input"
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.name}
                </option>
              ))}
            </select>
          </div>

          <span className="user-email" title={user?.email}>{user?.email}</span>
          <button onClick={handleLogout} className="btn btn-outline btn-sm" aria-label="Log out">
            Log out
          </button>
        </div>
      </header>

      <div className="app-body">
        {/* Desktop Sidebar */}
        <aside className="app-sidebar" aria-label="Main Navigation">
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="app-content">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
