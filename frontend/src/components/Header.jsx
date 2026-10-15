import React from 'react';
import { Moon, Sun, User, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function ParamFoundationLogo({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="param-logo-svg"
      aria-label="Param Foundation Logo"
    >
      <rect width="36" height="36" rx="8" fill="currentColor" fillOpacity="0.08" />
      {/* Param Hexagonal Science Core */}
      <path
        d="M18 6L29 12.35V25.05L18 31.4L7 25.05V12.35L18 6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Central Quantum Node */}
      <circle cx="18" cy="18.7" r="3.5" fill="currentColor" />
      {/* Param Lattice Geometry */}
      <path
        d="M18 6V15.2M18 22.2V31.4M7 12.35L15 16.9M21 20.5L29 25.05M29 12.35L21 16.9M15 20.5L7 25.05"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Header({ health, theme, toggleTheme, onOpenAuth }) {
  const isHealthy = health?.upstream?.status === 'healthy';
  const { user, signOut } = useAuth();

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  return (
    <header className="header-container">
      <div className="header-content">
        <div className="logo-group">
          <div className="logo-icon-box" title="Param Foundation">
            <ParamFoundationLogo size={34} />
          </div>
          <div>
            <div className="logo-title-row">
              <h1 className="logo-title">PARAM FOUNDATION</h1>
              <span className="auth-status-badge">
                <ShieldCheck size={12} />
                <span>Verified</span>
              </span>
            </div>
            <p className="logo-subtitle">Science Experience & Retrieval Intelligence</p>
          </div>
        </div>

        <div className="header-actions">
          {/* Connection Status Indicator */}
          <div className="status-pill" title={health?.upstream?.url ? `Endpoint: ${health.upstream.url}` : 'Checking connectivity...'}>
            <span className={`status-dot ${isHealthy ? 'status-green' : 'status-amber'}`}></span>
            <span className="status-label">
              {isHealthy ? 'Connected' : 'Connecting...'}
            </span>
            {health?.upstream?.latency_ms && (
              <span className="status-latency">{health.upstream.latency_ms}ms</span>
            )}
          </div>

          {/* Theme Switcher */}
          <button 
            type="button"
            className="icon-btn theme-toggle-btn" 
            onClick={toggleTheme} 
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* User Authentication Menu */}
          {user ? (
            <div className="user-profile-menu">
              <div className="user-avatar-badge" title={`Signed in as ${user.email}`}>
                <span className="avatar-circle">{userInitial}</span>
                <span className="user-email-text">{user.email}</span>
              </div>
              <button
                type="button"
                className="icon-btn logout-btn"
                onClick={signOut}
                title="Sign out of your account"
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-auth-trigger"
              onClick={() => onOpenAuth('signin')}
              title="Sign in with verified email"
            >
              <User size={15} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
