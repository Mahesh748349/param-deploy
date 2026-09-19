import React, { useRef, useEffect } from 'react';
import { Search, X, ArrowRight, Loader2, Clock } from 'lucide-react';

const SUGGESTIONS = [
  "visitor interactions involving color perception",
  "chromatic contrast puzzle latency and feedback",
  "optical illusion station peripheral color fading",
  "retinal adaptation threshold under low-lumen conditions",
  "trichromatic synthesis RGB slider matching speed"
];

export default function SearchBar({
  query,
  setQuery,
  topK,
  setTopK,
  scope,
  setScope,
  onSearch,
  loading,
  history,
  onSelectHistory
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === '/' &&
        document.activeElement !== inputRef.current &&
        !['input', 'textarea'].includes(document.activeElement.tagName.toLowerCase())
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!loading && query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <div className="search-section">
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-bar-wrapper">
          <Search className="search-icon" size={20} />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Ask a question or search indexed data..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />

          {query && (
            <button
              type="button"
              className="clear-input-btn"
              onClick={() => setQuery('')}
              title="Clear query"
            >
              <X size={16} />
            </button>
          )}

          <div className="search-shortcut" title="Press '/' to search">
            <kbd>/</kbd>
          </div>

          <button
            type="submit"
            className="search-submit-btn"
            disabled={loading || !query.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="spinner" size={16} />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <span>Search</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        {/* Options Row */}
        <div className="search-options-row">
          <div className="option-item">
            <label htmlFor="top-k-select" className="option-label">Results count:</label>
            <select
              id="top-k-select"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value, 10))}
              className="option-select"
            >
              <option value="3">Top 3</option>
              <option value="5">Top 5 (Recommended)</option>
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
            </select>
          </div>

          <div className="option-item">
            <label htmlFor="scope-select" className="option-label">Scope:</label>
            <select
              id="scope-select"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="option-select"
            >
              <option value="text">Text Data</option>
              <option value="all">All Modalities</option>
            </select>
          </div>
        </div>
      </form>

      {/* Suggested Queries */}
      <div className="suggestions-container">
        <span className="suggestions-label">Suggestions:</span>
        <div className="suggestions-list">
          {SUGGESTIONS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              className="suggestion-chip"
              onClick={() => {
                setQuery(item);
                onSearch(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Queries */}
      {history && history.length > 0 && (
        <div className="history-container">
          <Clock size={13} className="text-muted" />
          <div className="history-list">
            {history.slice(0, 4).map((item, idx) => (
              <button
                key={idx}
                type="button"
                className="history-chip"
                onClick={() => onSelectHistory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
