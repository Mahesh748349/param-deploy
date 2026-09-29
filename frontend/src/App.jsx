import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import ResultStats from './components/ResultStats';
import ResultCard from './components/ResultCard';
import SynthesisPanel from './components/SynthesisPanel';
import RawJsonModal from './components/RawJsonModal';
import StatusBanner from './components/StatusBanner';
import AuthModal from './components/AuthModal';
import AnalyticsMetricsCard from './components/AnalyticsMetricsCard';
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
  const [selectedSheet, setSelectedSheet] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [selectedExhibit, setSelectedExhibit] = useState('');
  const [sortField, setSortField] = useState('duration');
  const [sortOrder, setSortOrder] = useState('asc');
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
      // For analytical questions, hide raw files and show dedicated analytics card rather than AI analysis dump
      setShowRawFiles(!isAnalyticalQuery);
      setShowSynthesis(!isAnalyticalQuery && combined.length > 0);

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

  const handleSheetChange = (sheet) => {
    setSelectedSheet(sheet);
    if (sheet) {
      const hasRows = (results || []).some(r => {
        const loc = (r.locator || '').toLowerCase();
        const attr = (r.attributes?.sheet || '').toLowerCase();
        return loc.includes(sheet.toLowerCase()) || attr === sheet.toLowerCase();
      });
      if (!hasRows) {
        setQuery(sheet);
        handleSearch(sheet);
      }
    }
  };

  const handleExhibitChange = (exhibit) => {
    setSelectedExhibit(exhibit);
    if (exhibit) {
      const hasRows = (results || []).some(r => {
        const name = (r.attributes?.display_name || r.attributes?.exhibit_id || '').toLowerCase();
        return name.includes(exhibit.toLowerCase());
      });
      if (!hasRows) {
        setQuery(exhibit);
        handleSearch(exhibit);
      }
    }
  };

  const handleResetFilters = () => {
    setSelectedSheet('');
    setSelectedFile('');
    setSelectedExhibit('');
    setSortField('duration');
    setSortOrder('asc');
  };

  const filteredResults = (results || []).filter((r) => {
    const attrs = r.attributes || {};

    // 1. Sheet Filter
    if (selectedSheet) {
      const target = selectedSheet.toLowerCase();
      const loc = (r.locator || '').toLowerCase();
      const attrSheet = (attrs.sheet || '').toLowerCase();
      const text = (r.text || '').toLowerCase();
      const isMatch = loc.includes(`sheet:${target}`) || loc.includes(target) || attrSheet === target || text.includes(target);
      if (!isMatch) return false;
    }

    // 2. File Filter
    if (selectedFile) {
      if (r.source !== selectedFile) return false;
    }

    // 3. Exhibit Filter
    if (selectedExhibit) {
      const target = selectedExhibit.toLowerCase();
      const exName = (attrs.display_name || attrs.exhibit_id || attrs.station || '').toLowerCase();
      const loc = (r.locator || '').toLowerCase();
      const text = (r.text || '').toLowerCase();
      if (!exName.includes(target) && !loc.includes(target) && !text.includes(target)) {
        return false;
      }
    }

    return true;
  });

  const dataRows = (filteredResults || []).map((r, idx) => {
    const attrs = r.attributes || {};
    let duration = null;
    let durationDisplay = null;
    let presses = null;
    let exhibit = attrs.display_name || attrs.exhibit_id || attrs.station || null;

    // Detect sheet name from locator or attributes
    let sheetName = null;
    if (r.locator) {
      const sm = r.locator.match(/sheet:([^|]+)/i);
      if (sm) sheetName = sm[1].trim();
    }
    if (!sheetName && attrs.sheet) sheetName = attrs.sheet;

    if (!exhibit && sheetName) {
      exhibit = sheetName;
    }

    // 1. Check attribute fields for any duration, dwell, or total seconds metrics
    for (const [key, val] of Object.entries(attrs)) {
      if (/duration|dwell|stay_time|session.*min|time_s|total\s*seconds|seconds/i.test(key)) {
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

    // 3. Fallback regex on text (including Total Seconds in Physical Exhibit.xlsx)
    if (durationDisplay === null && r.text) {
      const m = r.text.match(/"Total Seconds"\s*:\s*([\d.]+)/i) ||
                r.text.match(/Total\s*Seconds[:\s]+([\d.]+)/i) ||
                r.text.match(/"duration_s"\s*:\s*([\d.]+)/i) ||
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

    const pressesNum = presses ? parseInt(presses, 10) : null;

    return {
      id: r.id || idx,
      exhibit: exhibit || (r.source ? r.source.replace(/\.[^.]+$/, '') : `Record #${idx + 1}`),
      sheet: sheetName || null,
      duration: durationDisplay || (duration !== null ? `${duration}s` : '—'),
      durationNum: duration,
      presses: presses || '—',
      pressesNum: !isNaN(pressesNum) ? pressesNum : null,
      timestamp: attrs.Date ? `${attrs.Date} ${attrs['Start Time'] || ''}`.trim() : (attrs.started_at ? attrs.started_at.replace('T', ' ').slice(0, 19) + ' UTC' : (attrs.recorded_at ? attrs.recorded_at.replace('T', ' ').slice(0, 19) + ' UTC' : '—')),
      source: sheetName ? `${sheetName} (${r.source || 'Dataset'})` : (r.source || 'Dataset')
    };
  });

  // Sort rows based on sortField and sortOrder (Ascending = Min at top, Descending = Max at top)
  const sortedDataRows = [...dataRows].sort((a, b) => {
    if (sortField === 'duration') {
      const valA = a.durationNum !== null && !isNaN(a.durationNum) ? a.durationNum : (sortOrder === 'asc' ? Infinity : -Infinity);
      const valB = b.durationNum !== null && !isNaN(b.durationNum) ? b.durationNum : (sortOrder === 'asc' ? Infinity : -Infinity);
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    }
    if (sortField === 'presses') {
      const valA = a.pressesNum !== null && !isNaN(a.pressesNum) ? a.pressesNum : (sortOrder === 'asc' ? Infinity : -Infinity);
      const valB = b.pressesNum !== null && !isNaN(b.pressesNum) ? b.pressesNum : (sortOrder === 'asc' ? Infinity : -Infinity);
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    }
    if (sortField === 'exhibit') {
      const valA = (a.exhibit || '').toLowerCase();
      const valB = (b.exhibit || '').toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    }
    return 0;
  });

  const handleHeaderSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

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
              meta={meta}
              selectedSheet={selectedSheet}
              setSelectedSheet={handleSheetChange}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              selectedExhibit={selectedExhibit}
              setSelectedExhibit={handleExhibitChange}
              onResetFilters={handleResetFilters}
              sortField={sortField}
              setSortField={setSortField}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              showSynthesis={showSynthesis}
              setShowSynthesis={setShowSynthesis}
              showRawJson={showRawJson}
              setShowRawJson={setShowRawJson}
              totalResultsCount={filteredResults.length}
            />

            {/* Dedicated Telemetry Analytics & Whole Dataset Metrics Card */}
            {isAnalyticalMode && (
              <AnalyticsMetricsCard
                analytics={meta?._dataset_analytics}
                query={query}
                dataRows={sortedDataRows}
              />
            )}

            {/* Extracted Telemetry Data Table - Shown directly for question and analytical queries */}
            {isAnalyticalMode && sortedDataRows.length > 0 && (
              <div className="telemetry-table-card">
                <div className="telemetry-table-header">
                  <div className="telemetry-table-title-group">
                    <Database size={16} className="text-indigo" />
                    <h3 className="telemetry-table-title">Exhibit Telemetry Session Records</h3>
                    <span className="telemetry-count-badge">
                      Sorted: {sortOrder === 'asc' ? '↑ Ascending (Min at top)' : '↓ Descending (Max at top)'} ({sortedDataRows.length} Rows)
                    </span>
                  </div>
                  <span className="telemetry-table-sub">Click column headers or use controls above to sort</span>
                </div>

                <div className="table-responsive">
                  <table className="telemetry-data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th onClick={() => handleHeaderSort('exhibit')} className="sortable-th" title="Click to sort by Exhibit/Station">
                          Exhibit / Sheet Station {sortField === 'exhibit' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleHeaderSort('duration')} className="sortable-th" title="Click to sort by Duration">
                          Dwell Duration / Seconds {sortField === 'duration' && (sortOrder === 'asc' ? '↑ (Min)' : '↓ (Max)')}
                        </th>
                        <th onClick={() => handleHeaderSort('presses')} className="sortable-th" title="Click to sort by Interactions">
                          Interactions / Presses {sortField === 'presses' && (sortOrder === 'asc' ? '↑ (Min)' : '↓ (Max)')}
                        </th>
                        <th>Timestamp</th>
                        <th>Dataset File / Sheet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedDataRows.map((row, idx) => (
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
