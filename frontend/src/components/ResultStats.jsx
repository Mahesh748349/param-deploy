import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Code,
  FileSpreadsheet,
  FileText,
  Landmark,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Check,
  RotateCcw
} from 'lucide-react';

const DATASET_SHEETS = [
  { id: 'Kinetic Bug', label: 'Kinetic Bug', file: 'Physical Exhibit.xlsx', count: '32 runs' },
  { id: 'Kinetic Flower', label: 'Kinetic Flower', file: 'Physical Exhibit.xlsx', count: '32 runs' }
];

const DATASET_FILES = [
  { id: 'engagement-sessions-2026-09-15.csv', label: 'engagement-sessions-2026-09-15.csv', count: '22,722 sessions' },
  { id: 'Physical Exhibit.xlsx', label: 'Physical Exhibit.xlsx', count: '64 runs (2 sheets)' },
  { id: 'engagement-report-2026-09-15.pdf', label: 'engagement-report-2026-09-15.pdf', count: 'Executive report' }
];

const DATASET_EXHIBITS = [
  'Color-perception-jayanagar',
  'Color-perception',
  'oki-2',
  'Rangolify',
  'LandsatNameJayanagar',
  'TacTile',
  'Circle-Drawing',
  'pace-the-clock-jaynagar',
  'traffic-gallery-sign-game',
  'pace-the-clock',
  'non-euclidean',
  'FrequencyTestKiosk',
  'Yogic-Nature-Discovery',
  'yoga-infinite-scroll',
  'Ayurvedic-plant-explorer',
  'Lilavati-ancient',
  'scale-of-universe',
  'CVRaman',
  'SoundAnalyser',
  'Kinetic Bug',
  'Kinetic Flower'
];

export default function ResultStats({
  meta,
  selectedSheet = '',
  setSelectedSheet,
  selectedFile = '',
  setSelectedFile,
  selectedExhibit = '',
  setSelectedExhibit,
  onResetFilters,
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
  const [openDropdown, setOpenDropdown] = useState(null); // 'sheet' | 'file' | 'exhibit' | 'metric' | 'order' | null
  const containerRef = useRef(null);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpenDropdown(null);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleDropdown = (name) => {
    setOpenDropdown(prev => (prev === name ? null : name));
  };

  const hasActiveFilters = Boolean(selectedSheet || selectedFile || selectedExhibit);

  return (
    <div className="results-header-container" ref={containerRef}>
      {/* Top Meta & Action Bar */}
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

      {/* Dedicated Parameter Dropdown Controls Bar */}
      <div className="parameter-controls-bar">
        {/* 1. Sheets Dropdown */}
        <div className="param-dropdown-container">
          <button
            type="button"
            className={`param-dropdown-btn ${openDropdown === 'sheet' ? 'active' : ''} ${selectedSheet ? 'is-filtered' : ''}`}
            onClick={() => toggleDropdown('sheet')}
            title="Filter by Excel Sheet"
          >
            <FileSpreadsheet size={13} className="param-icon text-emerald" />
            <span className="param-label">
              {selectedSheet ? `Sheet: ${selectedSheet}` : 'All Sheets'}
            </span>
            <ChevronDown size={13} className={`param-chevron ${openDropdown === 'sheet' ? 'open' : ''}`} />
          </button>

          {openDropdown === 'sheet' && (
            <div className="param-floating-menu">
              <div className="param-menu-header">EXCEL DATA SHEETS</div>
              <button
                type="button"
                className={`param-menu-item ${!selectedSheet ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedSheet && setSelectedSheet('');
                  setOpenDropdown(null);
                }}
              >
                <span>All Sheets</span>
                {!selectedSheet && <Check size={14} className="text-emerald" />}
              </button>
              {DATASET_SHEETS.map(sh => (
                <button
                  key={sh.id}
                  type="button"
                  className={`param-menu-item ${selectedSheet === sh.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedSheet && setSelectedSheet(sh.id);
                    setOpenDropdown(null);
                  }}
                >
                  <div className="param-item-stacked">
                    <span className="param-item-title font-semibold">{sh.label}</span>
                    <span className="param-item-sub text-muted font-mono">{sh.file} · {sh.count}</span>
                  </div>
                  {selectedSheet === sh.id && <Check size={14} className="text-emerald" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. Files Dropdown */}
        <div className="param-dropdown-container">
          <button
            type="button"
            className={`param-dropdown-btn ${openDropdown === 'file' ? 'active' : ''} ${selectedFile ? 'is-filtered' : ''}`}
            onClick={() => toggleDropdown('file')}
            title="Filter by Source File"
          >
            <FileText size={13} className="param-icon text-amber" />
            <span className="param-label">
              {selectedFile ? (selectedFile.length > 20 ? `${selectedFile.slice(0, 18)}...` : selectedFile) : 'All Files'}
            </span>
            <ChevronDown size={13} className={`param-chevron ${openDropdown === 'file' ? 'open' : ''}`} />
          </button>

          {openDropdown === 'file' && (
            <div className="param-floating-menu">
              <div className="param-menu-header">DATASET SOURCE FILES</div>
              <button
                type="button"
                className={`param-menu-item ${!selectedFile ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedFile && setSelectedFile('');
                  setOpenDropdown(null);
                }}
              >
                <span>All Files</span>
                {!selectedFile && <Check size={14} className="text-emerald" />}
              </button>
              {DATASET_FILES.map(f => (
                <button
                  key={f.id}
                  type="button"
                  className={`param-menu-item ${selectedFile === f.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedFile && setSelectedFile(f.id);
                    setOpenDropdown(null);
                  }}
                >
                  <div className="param-item-stacked">
                    <span className="param-item-title font-mono text-xs">{f.label}</span>
                    <span className="param-item-sub text-muted">{f.count}</span>
                  </div>
                  {selectedFile === f.id && <Check size={14} className="text-emerald" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Exhibits / Stations Dropdown */}
        <div className="param-dropdown-container">
          <button
            type="button"
            className={`param-dropdown-btn ${openDropdown === 'exhibit' ? 'active' : ''} ${selectedExhibit ? 'is-filtered' : ''}`}
            onClick={() => toggleDropdown('exhibit')}
            title="Filter by Exhibit Station"
          >
            <Landmark size={13} className="param-icon text-indigo" />
            <span className="param-label">
              {selectedExhibit ? `Exhibit: ${selectedExhibit}` : 'All Exhibits'}
            </span>
            <ChevronDown size={13} className={`param-chevron ${openDropdown === 'exhibit' ? 'open' : ''}`} />
          </button>

          {openDropdown === 'exhibit' && (
            <div className="param-floating-menu scrollable-menu">
              <div className="param-menu-header">25 TOUCH EXHIBIT STATIONS</div>
              <button
                type="button"
                className={`param-menu-item ${!selectedExhibit ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedExhibit && setSelectedExhibit('');
                  setOpenDropdown(null);
                }}
              >
                <span>All Exhibits</span>
                {!selectedExhibit && <Check size={14} className="text-emerald" />}
              </button>
              {DATASET_EXHIBITS.map(ex => (
                <button
                  key={ex}
                  type="button"
                  className={`param-menu-item ${selectedExhibit === ex ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedExhibit && setSelectedExhibit(ex);
                    setOpenDropdown(null);
                  }}
                >
                  <span>{ex}</span>
                  {selectedExhibit === ex && <Check size={14} className="text-emerald" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 4. Metric / Parameter Dropdown */}
        {setSortField && (
          <div className="param-dropdown-container">
            <button
              type="button"
              className={`param-dropdown-btn ${openDropdown === 'metric' ? 'active' : ''}`}
              onClick={() => toggleDropdown('metric')}
              title="Select parameter to evaluate"
            >
              <ArrowUpDown size={13} className="param-icon text-purple" />
              <span className="param-label">
                {sortField === 'duration' ? 'Metric: Duration (s)' : (sortField === 'presses' ? 'Metric: Interactions' : 'Metric: Station')}
              </span>
              <ChevronDown size={13} className={`param-chevron ${openDropdown === 'metric' ? 'open' : ''}`} />
            </button>

            {openDropdown === 'metric' && (
              <div className="param-floating-menu">
                <div className="param-menu-header">EVALUATION METRIC</div>
                <button
                  type="button"
                  className={`param-menu-item ${sortField === 'duration' ? 'selected' : ''}`}
                  onClick={() => {
                    setSortField('duration');
                    setOpenDropdown(null);
                  }}
                >
                  <div className="param-item-stacked">
                    <span className="param-item-title font-semibold">Dwell Duration / Seconds</span>
                    <span className="param-item-sub text-muted">Stay time per visitor run</span>
                  </div>
                  {sortField === 'duration' && <Check size={14} className="text-emerald" />}
                </button>
                <button
                  type="button"
                  className={`param-menu-item ${sortField === 'presses' ? 'selected' : ''}`}
                  onClick={() => {
                    setSortField('presses');
                    setOpenDropdown(null);
                  }}
                >
                  <div className="param-item-stacked">
                    <span className="param-item-title font-semibold">Visitor Interactions / Presses</span>
                    <span className="param-item-sub text-muted">Button touches and clicks</span>
                  </div>
                  {sortField === 'presses' && <Check size={14} className="text-emerald" />}
                </button>
                <button
                  type="button"
                  className={`param-menu-item ${sortField === 'exhibit' ? 'selected' : ''}`}
                  onClick={() => {
                    setSortField('exhibit');
                    setOpenDropdown(null);
                  }}
                >
                  <div className="param-item-stacked">
                    <span className="param-item-title font-semibold">Exhibit Station Name</span>
                    <span className="param-item-sub text-muted">Alphabetical order</span>
                  </div>
                  {sortField === 'exhibit' && <Check size={14} className="text-emerald" />}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 5. Order: Ascending / Descending Toggle Button */}
        {setSortOrder && (
          <button
            type="button"
            className={`param-order-toggle-btn ${sortOrder === 'asc' ? 'asc-mode' : 'desc-mode'}`}
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={`Current order: ${sortOrder === 'asc' ? 'Ascending (Minimum at top)' : 'Descending (Maximum at top)'}. Click to switch.`}
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
        )}

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <button
            type="button"
            className="param-reset-btn"
            onClick={onResetFilters}
            title="Clear all active sheet, file, and exhibit filters"
          >
            <RotateCcw size={12} />
            <span>Reset Filters</span>
          </button>
        )}
      </div>
    </div>
  );
}
