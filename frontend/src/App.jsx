import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import ResultStats from './components/ResultStats';
import ResultCard from './components/ResultCard';
import SynthesisPanel from './components/SynthesisPanel';
import RawJsonModal from './components/RawJsonModal';
import StatusBanner from './components/StatusBanner';
import { checkHealth, retrieveQuery } from './api';
import { Search } from 'lucide-react';
import './App.css';

export default function App() {
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

  // Search Handler
  const handleSearch = async (searchQuery = query) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setNotice(null);
    setIsSpinningUp(false);

    // Warm-up timeout indicator for Render
    const spinTimer = setTimeout(() => {
      setIsSpinningUp(true);
    }, 4500);

    try {
      const data = await retrieveQuery({
        query: trimmed,
        top_k: topK,
        scope
      });

      clearTimeout(spinTimer);
      setIsSpinningUp(false);

      setResults(data.text_results || []);
      setMeta(data);
      if (data._notice) {
        setNotice(data._notice);
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
      setError(err.message || 'Retrieval request failed.');
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
      <Header health={health} theme={theme} toggleTheme={toggleTheme} />

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
            <div className="empty-icon-box">
              <Search size={24} className="text-muted" />
            </div>
            <h3 className="empty-title">Search Knowledge Base</h3>
            <p className="empty-desc">
              Ask a question or search for interactions, dwell times, and exhibit telemetry across the indexed dataset.
            </p>
          </div>
        )}
      </main>

      {showRawJson && meta && (
        <RawJsonModal data={meta} onClose={() => setShowRawJson(false)} />
      )}

      <footer className="footer-container">
        <div className="footer-content">
          <span>Param Retrieval System &bull; Live Qdrant &amp; BM25 Vector Index</span>
        </div>
      </footer>
    </div>
  );
}
