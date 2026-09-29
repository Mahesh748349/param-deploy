import React from 'react';
import { Sparkles, Code, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export default function ResultStats({
  results,
  meta,
  selectedSource,
  setSelectedSource,
  sortField = 'duration',
  setSortField,
  sortOrder = 'asc',
  setSortOrder,
  showSynthesis,
  setShowSynthesis,
  showRawJson,
  setShowRawJson,
  totalResultsCount
}) {
  // Extract sheets and file sources
  const sheets = [...new Set((results || []).map((r) => {
    if (r.locator) {
      const m = r.locator.match(/sheet:([^|]+)/i);
      if (m) return m[1].trim();
    }
    return r.attributes?.sheet || null;
  }).filter(Boolean))];

  const fileSources = [...new Set((results || []).map((r) => r.source).filter(Boolean))];
  const hasMultipleFilters = sheets.length > 0 || fileSources.length > 1;

  const toggleSortOrder = () => {
    if (setSortOrder) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    }
  };

  return (
    <div className="results-header-bar">
      <div className="results-meta-left">
        <span className="results-count">
          <strong>{totalResultsCount}</strong> {totalResultsCount === 1 ? 'result' : 'results'}
        </span>
        {meta?.image_results?.length > 0 && (
          <span className="image-count-pill">{meta.image_results.length} images</span>
        )}
        {meta?._cutoff_applied && (
          <span className="cutoff-pill" title="Low-relevance items filtered out (rerank cutoff >= 0.0)">Cutoff Applied</span>
        )}
        {meta?._latency_ms && (
          <span className="results-latency">({meta._latency_ms}ms)</span>
        )}
        {meta?.dataset && (
          <span className="dataset-label">in <code>{meta.dataset}</code></span>
        )}
      </div>

      <div className="results-actions-right">
        {/* Filter by Sheet or Source File */}
        {hasMultipleFilters && (
          <div className="filter-wrapper" title="Filter by Sheet or Source File">
            <Filter size={13} className="text-muted" />
            <select
              value={selectedSource || ''}
              onChange={(e) => setSelectedSource && setSelectedSource(e.target.value)}
              className="filter-select font-mono"
            >
              <option value="">All Sheets & Sources</option>
              {sheets.length > 0 && (
                <optgroup label="Excel Sheets">
                  {sheets.map((sh) => (
                    <option key={`sheet:${sh}`} value={`sheet:${sh}`}>
                      Sheet: {sh}
                    </option>
                  ))}
                </optgroup>
              )}
              {fileSources.length > 0 && (
                <optgroup label="Source Files">
                  {fileSources.map((src) => (
                    <option key={`file:${src}`} value={`file:${src}`}>
                      File: {src}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        )}

        {/* Sorting Controls */}
        {setSortField && (
          <div className="sort-controls-wrapper">
            <div className="sort-select-wrapper" title="Select field to sort by">
              <ArrowUpDown size={13} className="text-muted" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                className="filter-select sort-field-select"
              >
                <option value="duration">Sort: Duration (s)</option>
                <option value="presses">Sort: Interactions / Presses</option>
                <option value="exhibit">Sort: Exhibit / Station</option>
              </select>
            </div>

            <button
              type="button"
              className={`sort-order-btn ${sortOrder === 'asc' ? 'asc-active' : 'desc-active'}`}
              onClick={toggleSortOrder}
              title={`Switch to ${sortOrder === 'asc' ? 'Descending (Highest first)' : 'Ascending (Lowest first)'}`}
            >
              {sortOrder === 'asc' ? (
                <>
                  <ArrowUp size={13} className="text-emerald" />
                  <span>Ascending (Min at top)</span>
                </>
              ) : (
                <>
                  <ArrowDown size={13} className="text-indigo" />
                  <span>Descending (Max at top)</span>
                </>
              )}
            </button>
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
