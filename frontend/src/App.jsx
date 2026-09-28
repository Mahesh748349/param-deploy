import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import ResultStats from './components/ResultStats';
import ResultCard from './components/ResultCard';
import SynthesisPanel from './components/SynthesisPanel';
import RawJsonModal from './components/RawJsonModal';
import StatusBanner from './components/StatusBanner';
import AuthModal from './components/AuthModal';
import { useAuth } from './context/AuthContext';
import { checkHealth, retrieveQuery } from './api';
import { Search, Shield, Lock, Sparkles, CheckCircle2, AlertCircle, Info, Database, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import './App.css';

export default function App() {
  const { user, isRecoveryMode } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('param_theme') || 'dark');
  const [query, setQuery] = useState('visitor interactions involving color perception');
  const [topK, setTopK] = useState(5);
  const [scope, setScope] = useState('text');
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isAnalyticalMode, setIsAnalyticalMode] = useState(false);
  const [showRawFiles, setShowRawFiles] = useState(true);

  // Clear stale results on mount
  useEffect(() => {
    setResults([]);
    setMeta(null);
  }, []);
  const [loading, setLoading] = useState(false);
  const [isSpinningUp, setIsSpinningUp] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [health, setHealth] = useState(null);
  const [selectedSource, setSelectedSource] = useState('');
  const [showSynthesis, setShowSynthesis] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  
  // Auth Modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('signin');

  // Automatically trigger reset password modal when user arrives via recovery link
  useEffect(() => {
    if (isRecoveryMode) {
      setAuthModalMode('reset-password');
      setAuthModalOpen(true);
    }
  }, [isRecoveryMode]);

  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('param_history') || '[]');
    } catch {
      return [];
    }
  });

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('param_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Health check
  const refreshHealth = useCallback(async () => {
    try {
      const data = await checkHealth();
      setHealth(data);
    } catch (err) {
      console.warn('Backend health check warning:', err);
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    const interval = setInterval(refreshHealth, 30000);
    return () => clearInterval(interval);
  }, [refreshHealth]);

  // Open Auth helper
  const handleOpenAuth = (mode = 'signin') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  // Search Handler
  const handleSearch = async (searchQuery = query) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    // Check if user is authenticated with Supabase
    if (!user) {
      setAuthModalMode('signin');
      setAuthModalOpen(true);
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);
    setIsSpinningUp(false);

    // Warm-up timeout indicator for Render
    const spinTimer = setTimeout(() => {
      setIsSpinningUp(true);
    }, 3000);

    try {
      const data = await retrieveQuery({
        query: trimmed,
        top_k: topK,
        scope
      });

      clearTimeout(spinTimer);
      setIsSpinningUp(false);

      let combined = [];
      if (Array.isArray(data.text_results)) {
        combined = [...combined, ...data.text_results.map(r => ({ ...r, _kind: 'text' }))];
      }
      if (Array.isArray(data.image_results)) {
        combined = [...combined, ...data.image_results.map(r => ({ ...r, _kind: 'image' }))];
      }
      if (combined.length === 0 && Array.isArray(data.results)) {
        combined = data.results;
      }

      setResults(combined);
      setMeta(data);
      if (data._notice) {
        setNotice(data._notice);
      }

      // Automatically open AI Answer & Data Analysis panel for analytical or question queries
      const isAnalyticalQuery = /^(what|how|which|why|who|when|calculate|find|tell|is|are|min|max|average|avg|highest|lowest|sum|total|median|compare)/i.test(trimmed);
      setIsAnalyticalMode(isAnalyticalQuery);
      // For analytical questions, hide raw file cards by default so the user sees the computed data and table
      setShowRawFiles(!isAnalyticalQuery);
      if (isAnalyticalQuery && combined.length > 0) {
        setShowSynthesis(true);
      }

      // Save to history
      setHistory((prev) => {
        const updated = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, 6);
        localStorage.setItem('param_history', JSON.stringify(updated));
        return updated;
      });

      refreshHealth();
    } catch (err) {
      clearTimeout(spinTimer);
      setIsSpinningUp(false);
      setResults([]); // Explicitly clear any stale or fallback results
      setError(err.message || 'Not retrieved: The request took too long or failed.');
      console.error('Retrieve error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredResults = selectedSource
    ? results.filter((r) => r.source === selectedSource)
    : results;

  const dataRows = (filteredResults || []).map((r, idx) => {
    const attrs = r.attributes || {};
    let duration = null;
    let durationDisplay = null;
    let presses = null;
    let exhibit = attrs.display_name || attrs.exhibit_id || attrs.station || null;

    // 1. Check attribute fields for any duration or dwell metrics
    for (const [key, val] of Object.entries(attrs)) {
      if (/duration|dwell|stay_time|session.*min|time_s/i.test(key)) {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          if (key.includes('_min')) {
            duration = num * 60;
            durationDisplay = `${num} min (${num * 60}s)`;
          } else {
            duration = num;
            durationDisplay = `${num}s`;
          }
          break;
        }
      }
    }

    // 2. Check attribute fields for button presses or interactions
    for (const [key, val] of Object.entries(attrs)) {
      if (/press|interaction|disappearance|count|adjustment|saccade/i.test(key)) {
        const num = parseInt(val, 10);
        if (!isNaN(num)) {
          presses = `${num} ${key.replace(/_/g, ' ')}`;
          break;
        }
      }
    }

    // 3. Fallback regex on text
    if (durationDisplay === null && r.text) {
      const m = r.text.match(/"duration_s"\s*:\s*([\d.]+)/i) ||
                r.text.match(/duration[:\s]+([\d.]+)\s*s?/i) ||
                r.text.match(/([\d.]+)\s*seconds/i);
      if (m && !isNaN(parseFloat(m[1]))) {
        duration = parseFloat(m[1]);
        durationDisplay = `${m[1]}s`;
      }
    }
    if (presses === null && r.text) {
      const m = r.text.match(/"presses"\s*:\s*(\d+)/i) ||
                r.text.match(/presses[:\s]+(\d+)/i) ||
                r.text.match(/(\d+)\s+button\s+presses/i);
      if (m) presses = `${m[1]} presses`;
    }
    if (!exhibit && r.text) {
      const m = r.text.match(/"display_name"\s*:\s*"([^"]+)"/i) ||
                r.text.match(/"exhibit_id"\s*:\s*"([^"]+)"/i) ||
                r.text.match(/exhibit[:\s]+([^;\n.]+)/i);
      if (m) exhibit = m[1].trim();
    }

    return {
      id: r.id || idx,
      exhibit: exhibit || (r.source ? r.source.replace(/\.[^.]+$/, '') : `Record #${idx + 1}`),
      duration: durationDisplay || (duration !== null ? `${duration}s` : '—'),
      presses: presses || '—',
      timestamp: attrs.started_at ? attrs.started_at.replace('T', ' ').slice(0, 19) + ' UTC' : (attrs.recorded_at ? attrs.recorded_at.replace('T', ' ').slice(0, 19) + ' UTC' : '—'),
      source: r.source || 'Dataset'
    };
  });

  return (
    <div className="app-container">
      <Header
        health={health}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenAuth={handleOpenAuth}
      />

      <main className="main-content">
        <StatusBanner
          error={error}
          notice={notice}
          isSpinningUp={isSpinningUp}
          onDismiss={() => {
            setError(null);
            setNotice(null);
          }}
        />

        {/* Authentication Callout Banner when not signed in */}
        {!user && (
          <div className="auth-lock-card">
            <div className="auth-lock-content">
              <div className="auth-lock-icon">
                <Shield size={24} className="text-indigo" />
              </div>
              <div className="auth-lock-text">
                <h3 className="auth-lock-title">Email-Verified Authentication Active</h3>
                <p className="auth-lock-subtitle">
                  To protect retrieval compute and synthesize telemetry insights with Gemini, please sign in or create an account with a real verified email.
                </p>
              </div>
            </div>
            <div className="auth-lock-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleOpenAuth('signup')}
              >
                Create Account (Free)
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleOpenAuth('signin')}
              >
                Sign In
              </button>
            </div>
          </div>
        )}

        {/* Verified User Greeting */}
        {user && (
          <div className="verified-user-banner">
            <div className="verified-user-info">
              <CheckCircle2 size={16} className="text-emerald" />
              <span>Verified Session Active: <strong>{user.email}</strong></span>
            </div>
            <span className="verified-badge">Authenticated</span>
          </div>
        )}

        <SearchBar
          query={query}
          setQuery={setQuery}
          topK={topK}
          setTopK={setTopK}
          scope={scope}
          setScope={setScope}
          onSearch={handleSearch}
          loading={loading}
          history={history}
          onSelectHistory={(item) => {
            setQuery(item);
            handleSearch(item);
          }}
        />

        {/* AI Answer Synthesis Box */}
        {showSynthesis && results.length > 0 && (
          <SynthesisPanel query={query} results={filteredResults} />
        )}

        {/* Results */}
        {results.length > 0 ? (
          <div className="results-section">
            <ResultStats
              results={results}
              meta={meta}
              selectedSource={selectedSource}
              setSelectedSource={setSelectedSource}
              showSynthesis={showSynthesis}
              setShowSynthesis={setShowSynthesis}
              showRawJson={showRawJson}
              setShowRawJson={setShowRawJson}
              totalResultsCount={filteredResults.length}
            />

            {/* Extracted Telemetry Data Table - Shown directly for question and analytical queries */}
            {isAnalyticalMode && dataRows.length > 0 && (
              <div className="telemetry-table-card">
                <div className="telemetry-table-header">
                  <div className="telemetry-table-title-group">
                    <Database size={16} className="text-indigo" />
                    <h3 className="telemetry-table-title">Extracted Telemetry Data Table</h3>
                    <span className="telemetry-count-badge">{dataRows.length} Data Points</span>
                  </div>
                  <span className="telemetry-table-sub">Raw values parsed from dataset records</span>
                </div>

                <div className="table-responsive">
                  <table className="telemetry-data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Exhibit Station</th>
                        <th>Dwell Duration</th>
                        <th>Interactions</th>
                        <th>Timestamp (UTC)</th>
                        <th>Dataset File</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataRows.map((row, idx) => (
                        <tr key={row.id || idx}>
                          <td className="font-mono text-muted">#{idx + 1}</td>
                          <td className="font-semibold text-primary">{row.exhibit}</td>
                          <td className="font-mono highlight-data-val">{row.duration}</td>
                          <td className="font-mono">{row.presses}</td>
                          <td className="font-mono text-muted text-xs">{row.timestamp}</td>
                          <td className="text-xs text-muted font-mono">{row.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* For questions, provide a clean toggle so file cards don't clutter the data */}
            {isAnalyticalMode && (
              <div className="raw-files-toggle-wrapper">
                <button
                  type="button"
                  className="raw-files-toggle-btn"
                  onClick={() => setShowRawFiles(!showRawFiles)}
                >
                  <FileText size={14} />
                  <span>{showRawFiles ? 'Hide Source File Cards' : `View Raw Source File Chunks (${filteredResults.length})`}</span>
                  {showRawFiles ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            )}

            {/* Results File Cards List - only visible if showRawFiles is true */}
            {showRawFiles && (
              <div className="results-list">
                {filteredResults.map((item, index) => (
                  <ResultCard
                    key={item.id || index}
                    result={item}
                    rank={index + 1}
                    searchQuery={query}
                  />
                ))}
              </div>
            )}
          </div>
        ) : !loading && (
          <div className="empty-state">
            {error ? (
              <>
                <div className="empty-icon-box empty-icon-error">
                  <AlertCircle size={28} className="text-rose" />
                </div>
                <h3 className="empty-title text-rose">Not Retrieved</h3>
                <p className="empty-desc">{error}</p>
              </>
            ) : notice ? (
              <>
                <div className="empty-icon-box empty-icon-notice">
                  <Info size={28} className="text-amber" />
                </div>
                <h3 className="empty-title">No Relevant Records Found</h3>
                <p className="empty-desc">{notice}</p>
              </>
            ) : (
              <>
                <div className="empty-icon-box">
                  <Search size={24} className="text-muted" />
                </div>
                <h3 className="empty-title">Search Knowledge Base</h3>
                <p className="empty-desc">
                  Ask a question or search for interactions, dwell times, and exhibit telemetry across the indexed dataset.
                </p>
              </>
            )}
          </div>
        )}
      </main>

      {showRawJson && meta && (
        <RawJsonModal data={meta} onClose={() => setShowRawJson(false)} />
      )}

      {/* Supabase Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />

      <footer className="footer-container">
        <div className="footer-content">
          <span>Param Retrieval System &bull; Supabase Auth &bull; Qdrant &amp; BM25 Vector Index</span>
        </div>
      </footer>
    </div>
  );
}
