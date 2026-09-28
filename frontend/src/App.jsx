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
import { Search, Shield, Lock, Sparkles, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import './App.css';

export default function App() {
  const { user, isRecoveryMode } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('param_theme') || 'dark');
  const [query, setQuery] = useState('visitor interactions involving color perception');
  const [topK, setTopK] = useState(5);
  const [scope, setScope] = useState('text');
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);

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
