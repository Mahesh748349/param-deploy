import React from 'react';
import { Search, Moon, Sun, User, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Header({ health, theme, toggleTheme, onOpenAuth }) {
  const isHealthy = health?.upstream?.status === 'healthy';
  const { user, signOut } = useAuth();

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  return (
    <header className="header-container">
      <div className="header-content">
        <div className="logo-group">
          <div className="logo-icon-box">
            <Search className="logo-icon" size={20} />
          </div>
          <div>
            <div className="logo-title-row">
              <h1 className="logo-title">Param Retrieval</h1>
              <span className="auth-status-badge">
                <ShieldCheck size={12} className="text-indigo" />
                <span>Supabase Auth</span>
              </span>
            </div>
            <p className="logo-subtitle">Semantic search & knowledge retrieval over indexed dataset</p>
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
