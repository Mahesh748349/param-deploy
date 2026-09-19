import React from 'react';
import { Sparkles, Code, Filter } from 'lucide-react';

export default function ResultStats({
  results,
  meta,
  selectedSource,
  setSelectedSource,
  showSynthesis,
  setShowSynthesis,
  showRawJson,
  setShowRawJson,
  totalResultsCount
}) {
  const sources = [...new Set((results || []).map((r) => r.source).filter(Boolean))];

  return (
    <div className="results-header-bar">
      <div className="results-meta-left">
        <span className="results-count">
          <strong>{totalResultsCount}</strong> {totalResultsCount === 1 ? 'result' : 'results'}
        </span>
        {meta?._latency_ms && (
          <span className="results-latency">({meta._latency_ms}ms)</span>
        )}
        {meta?.dataset && (
          <span className="dataset-label">in <code>{meta.dataset}</code></span>
        )}
      </div>

      <div className="results-actions-right">
        {/* Filter by file source if multiple */}
        {sources.length > 1 && (
          <div className="filter-wrapper">
            <Filter size={13} className="text-muted" />
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="filter-select"
            >
              <option value="">All Files ({sources.length})</option>
              {sources.map((src) => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
          </div>
        )}

        {/* AI Answer Synthesis */}
        <button
          type="button"
          className={`action-btn ${showSynthesis ? 'active' : ''}`}
          onClick={() => setShowSynthesis(!showSynthesis)}
        >
          <Sparkles size={14} />
          <span>{showSynthesis ? 'Hide Summary' : 'AI Summary'}</span>
        </button>

        {/* Raw JSON */}
        <button
          type="button"
          className={`action-btn ${showRawJson ? 'active' : ''}`}
          onClick={() => setShowRawJson(!showRawJson)}
          title="Inspect API response JSON"
        >
          <Code size={14} />
          <span>JSON</span>
        </button>
      </div>
    </div>
  );
}
