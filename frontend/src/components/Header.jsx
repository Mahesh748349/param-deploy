import React from 'react';
import { Search, Moon, Sun } from 'lucide-react';

export default function Header({ health, theme, toggleTheme }) {
  const isHealthy = health?.upstream?.status === 'healthy';

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
        </div>
      </div>
    </header>
  );
}
