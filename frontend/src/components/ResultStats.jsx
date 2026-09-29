import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Code, Filter, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Check, FileSpreadsheet, FileText, Layers } from 'lucide-react';

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
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const filterRef = useRef(null);
  const sortRef = useRef(null);

  // Close dropdowns on click outside or Escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setSortOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setFilterOpen(false);
        setSortOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  // Human-readable active filter label
  let filterDisplayLabel = 'All Sheets & Sources';
  if (selectedSource) {
    if (selectedSource.startsWith('sheet:')) {
      filterDisplayLabel = `Sheet: ${selectedSource.replace('sheet:', '')}`;
    } else if (selectedSource.startsWith('file:')) {
      const fname = selectedSource.replace('file:', '');
      filterDisplayLabel = fname.length > 24 ? `File: ${fname.slice(0, 22)}...` : `File: ${fname}`;
    } else {
      filterDisplayLabel = selectedSource.length > 24 ? `${selectedSource.slice(0, 22)}...` : selectedSource;
    }
  }

  // Human-readable active sort label
  const sortLabels = {
    duration: 'Sort: Duration (s)',
    presses: 'Sort: Interactions',
    exhibit: 'Sort: Exhibit / Station'
  };
  const sortDisplayLabel = sortLabels[sortField] || 'Sort By';

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
        {/* Custom Filter Dropdown for Sheet / Source File */}
        {hasMultipleFilters && (
          <div className="custom-dropdown-container" ref={filterRef}>
            <button
              type="button"
              className={`custom-dropdown-trigger ${filterOpen ? 'active' : ''}`}
              onClick={() => {
                setFilterOpen(!filterOpen);
                setSortOpen(false);
              }}
              title="Filter by Sheet or Source File"
            >
              <Filter size={13} className="trigger-icon" />
              <span className="trigger-label">{filterDisplayLabel}</span>
              <ChevronDown size={13} className={`trigger-chevron ${filterOpen ? 'open' : ''}`} />
            </button>

            {filterOpen && (
              <div className="custom-dropdown-menu">
                {/* All Sheets & Sources */}
                <button
                  type="button"
                  className={`custom-dropdown-item ${!selectedSource ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedSource && setSelectedSource('');
                    setFilterOpen(false);
                  }}
                >
                  <Layers size={13} className="item-icon text-indigo" />
                  <span className="item-text font-medium">All Sheets & Sources</span>
                  {!selectedSource && <Check size={14} className="check-icon text-emerald" />}
                </button>

                {/* Excel Sheets Section */}
                {sheets.length > 0 && (
                  <div className="dropdown-section">
                    <div className="dropdown-section-title">
                      <FileSpreadsheet size={12} className="text-emerald" />
                      <span>EXCEL SHEETS</span>
                    </div>
                    {sheets.map((sh) => {
                      const val = `sheet:${sh}`;
                      const isSel = selectedSource === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          className={`custom-dropdown-item ${isSel ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedSource && setSelectedSource(val);
                            setFilterOpen(false);
                          }}
                        >
                          <span className="item-bullet">•</span>
                          <span className="item-text">Sheet: {sh}</span>
                          {isSel && <Check size={14} className="check-icon text-emerald" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Source Files Section */}
                {fileSources.length > 0 && (
                  <div className="dropdown-section">
                    <div className="dropdown-section-title">
                      <FileText size={12} className="text-amber" />
                      <span>SOURCE FILES</span>
                    </div>
                    {fileSources.map((src) => {
                      const val = `file:${src}`;
                      const isSel = selectedSource === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          className={`custom-dropdown-item ${isSel ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedSource && setSelectedSource(val);
                            setFilterOpen(false);
                          }}
                        >
                          <span className="item-bullet">•</span>
                          <span className="item-text font-mono text-xs">{src}</span>
                          {isSel && <Check size={14} className="check-icon text-emerald" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Custom Sorting Controls */}
        {setSortField && (
          <div className="sort-controls-wrapper">
            <div className="custom-dropdown-container" ref={sortRef}>
              <button
                type="button"
                className={`custom-dropdown-trigger sort-trigger ${sortOpen ? 'active' : ''}`}
                onClick={() => {
                  setSortOpen(!sortOpen);
                  setFilterOpen(false);
                }}
                title="Select field to sort by"
              >
                <ArrowUpDown size={13} className="trigger-icon" />
                <span className="trigger-label">{sortDisplayLabel}</span>
                <ChevronDown size={13} className={`trigger-chevron ${sortOpen ? 'open' : ''}`} />
              </button>

              {sortOpen && (
                <div className="custom-dropdown-menu sort-dropdown-menu">
                  <button
                    type="button"
                    className={`custom-dropdown-item ${sortField === 'duration' ? 'selected' : ''}`}
                    onClick={() => {
                      setSortField('duration');
                      setSortOpen(false);
                    }}
                  >
                    <span className="item-text">Sort: Duration (s)</span>
                    {sortField === 'duration' && <Check size={14} className="check-icon text-emerald" />}
                  </button>

                  <button
                    type="button"
                    className={`custom-dropdown-item ${sortField === 'presses' ? 'selected' : ''}`}
                    onClick={() => {
                      setSortField('presses');
                      setSortOpen(false);
                    }}
                  >
                    <span className="item-text">Sort: Interactions / Presses</span>
                    {sortField === 'presses' && <Check size={14} className="check-icon text-emerald" />}
                  </button>

                  <button
                    type="button"
                    className={`custom-dropdown-item ${sortField === 'exhibit' ? 'selected' : ''}`}
                    onClick={() => {
                      setSortField('exhibit');
                      setSortOpen(false);
                    }}
                  >
                    <span className="item-text">Sort: Exhibit / Station</span>
                    {sortField === 'exhibit' && <Check size={14} className="check-icon text-emerald" />}
                  </button>
                </div>
              )}
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
