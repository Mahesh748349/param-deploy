import React, { useState, useEffect } from 'react';
import { BarChart3, Clock, TrendingDown, TrendingUp, Activity, Zap, Sparkles, Database, CheckCircle2, ChevronDown, ChevronUp, MousePointerClick } from 'lucide-react';

const EXHIBIT_DATASET_METRICS = [
  { name: 'Color-perception-jayanagar', avgDwell: '6m 46s', dwellSec: 406, interactions: 199317, sessions: 1316 },
  { name: 'Color-perception', avgDwell: '6m 47s', dwellSec: 407, interactions: 185911, sessions: 1208 },
  { name: 'OKI-2', avgDwell: '3m 1s', dwellSec: 181, interactions: 145898, sessions: 1443 },
  { name: 'Rangolify', avgDwell: '4m 39s', dwellSec: 279, interactions: 137837, sessions: 1551 },
  { name: 'LandsatNameJayanagar', avgDwell: '2m 43s', dwellSec: 163, interactions: 92822, sessions: 1169 },
  { name: 'TacTile', avgDwell: '2m 6s', dwellSec: 126, interactions: 88372, sessions: 1274 },
  { name: 'Circle-Drawing', avgDwell: '2m 41s', dwellSec: 161, interactions: 79420, sessions: 1278 },
  { name: 'pace-the-clock-jaynagar', avgDwell: '3m 40s', dwellSec: 220, interactions: 72512, sessions: 983 },
  { name: 'traffic-gallery-sign-game', avgDwell: '2m 48s', dwellSec: 168, interactions: 64251, sessions: 1429 },
  { name: 'pace-the-clock', avgDwell: '2m 20s', dwellSec: 140, interactions: 49614, sessions: 1023 },
  { name: 'non-euclidean', avgDwell: '1m 48s', dwellSec: 108, interactions: 37633, sessions: 1014 },
  { name: 'FrequencyTestKiosk', avgDwell: '3m 32s', dwellSec: 212, interactions: 30583, sessions: 1133 },
  { name: 'Yogic-Nature-Discovery', avgDwell: '2m 43s', dwellSec: 163, interactions: 22901, sessions: 981 },
  { name: 'yoga-infinite-scroll', avgDwell: '1m 9s', dwellSec: 69, interactions: 22445, sessions: 937 },
  { name: 'Ayurvedic-plant-explorer', avgDwell: '1m 13s', dwellSec: 73, interactions: 17224, sessions: 1000 },
  { name: 'Lilavati-ancient', avgDwell: '1m 34s', dwellSec: 94, interactions: 16714, sessions: 481 },
  { name: 'scale-of-universe', avgDwell: '1m 2s', dwellSec: 62, interactions: 15671, sessions: 918 },
  { name: 'CVRaman', avgDwell: '1m 3s', dwellSec: 63, interactions: 11739, sessions: 399 }
];

const SHEET_BENCHMARKS = {
  'kinetic bug': {
    id: 'kinetic bug',
    name: 'Kinetic Bug',
    file: 'Physical Exhibit.xlsx',
    runs: 32,
    minDwellSec: 0.12,
    minDwellDisplay: '0.12s',
    maxDwellSec: 62.01,
    maxDwellDisplay: '62.01s',
    avgDwellSec: 6.709,
    avgDwellDisplay: '6.71s',
    description: 'Autonomous sensor run telemetry from Kinetic Bug exhibit'
  },
  'kinetic flower': {
    id: 'kinetic flower',
    name: 'Kinetic Flower',
    file: 'Physical Exhibit.xlsx',
    runs: 32,
    minDwellSec: 0.30,
    minDwellDisplay: '0.30s',
    maxDwellSec: 50.385,
    maxDwellDisplay: '50.39s',
    avgDwellSec: 6.751,
    avgDwellDisplay: '6.75s',
    description: 'Autonomous sensor run telemetry from Kinetic Flower exhibit'
  }
};

export default function AnalyticsMetricsCard({ analytics, query, dataRows = [] }) {
  const cleanQ = (query || '').toLowerCase();
  const isInteractionQuery = /interaction|press|count|button|touch|click/i.test(cleanQ) && !/dwell|duration|stay|seconds/i.test(cleanQ);
  
  // Detect sheet from query or analytics
  const detectedSheetKey = analytics?.matched_sheet?.name?.toLowerCase() ||
    (cleanQ.includes('bug') ? 'kinetic bug' : cleanQ.includes('flower') ? 'kinetic flower' : null);

  const [activeTab, setActiveTab] = useState(isInteractionQuery ? 'interactions' : 'dwell');
  const [selectedSheet, setSelectedSheet] = useState(detectedSheetKey || 'all');
  const [showAllExhibits, setShowAllExhibits] = useState(false);

  useEffect(() => {
    if (detectedSheetKey) {
      setSelectedSheet(detectedSheetKey);
    } else {
      setSelectedSheet('all');
    }
  }, [detectedSheetKey, query]);

  useEffect(() => {
    if (isInteractionQuery) {
      setActiveTab('interactions');
    } else {
      setActiveTab('dwell');
    }
  }, [query]);

  const activeSheetData = SHEET_BENCHMARKS[selectedSheet] || null;

  // Calculate dynamic metrics from visible dataRows if they match the sheet
  const sheetRows = dataRows.filter(r => {
    if (!activeSheetData) return true;
    const nameMatch = (r.exhibit || '').toLowerCase().includes(activeSheetData.name.toLowerCase());
    const sourceMatch = (r.source || '').toLowerCase().includes(activeSheetData.name.toLowerCase());
    return nameMatch || sourceMatch;
  });

  const rowDurations = (sheetRows.length > 0 ? sheetRows : dataRows)
    .map(r => r.durationNum)
    .filter(d => typeof d === 'number' && !isNaN(d));

  const dynamicMin = rowDurations.length > 0 ? Math.min(...rowDurations) : (activeSheetData ? activeSheetData.minDwellSec : 0.0);
  const dynamicMax = rowDurations.length > 0 ? Math.max(...rowDurations) : (activeSheetData ? activeSheetData.maxDwellSec : 743.0);
  const dynamicAvg = rowDurations.length > 0 ? (rowDurations.reduce((a, b) => a + b, 0) / rowDurations.length) : (activeSheetData ? activeSheetData.avgDwellSec : 167.3);

  const matched = analytics?.matched_exhibit || null;
  const isMinQuery = /min|lowest|least|smallest/i.test(cleanQ);
  const isMaxQuery = /max|highest|most|busiest|peak/i.test(cleanQ);

  return (
    <div className="analytics-metrics-card">
      <div className="analytics-header">
        <div className="analytics-title-group">
          <BarChart3 size={20} className="text-emerald" />
          <h3 className="analytics-title">Dataset Telemetry Analytics</h3>
          <span className="dataset-scope-badge">
            <CheckCircle2 size={13} className="text-emerald" />
            {activeSheetData ? `Sheet: ${activeSheetData.name} (${activeSheetData.file})` : '100% Whole Dataset Benchmark'}
          </span>
          {matched && !activeSheetData && (
            <span className="exhibit-match-badge font-mono">
              Exhibit Match: {matched.display_name}
            </span>
          )}
        </div>
        <div className="analytics-dataset-meta">
          <Database size={14} className="text-indigo" />
          {activeSheetData ? (
            <span>Physical Exhibit.xlsx · {activeSheetData.runs} Authentic Runs · Min {activeSheetData.minDwellDisplay} · Max {activeSheetData.maxDwellDisplay}</span>
          ) : (
            <span>22,722 Total Sessions · 1,329,443 Interactions · 25 Exhibits</span>
          )}
        </div>
      </div>

      {/* Sheet Selection Pills */}
      <div className="sheet-selector-bar">
        <span className="sheet-selector-label">Data Sheet:</span>
        <button
          type="button"
          className={`sheet-pill-btn ${selectedSheet === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedSheet('all')}
        >
          All Dataset (22,722 Sessions)
        </button>
        <button
          type="button"
          className={`sheet-pill-btn ${selectedSheet === 'kinetic bug' ? 'active' : ''}`}
          onClick={() => setSelectedSheet('kinetic bug')}
        >
          Sheet: Kinetic Bug (32 Runs)
        </button>
        <button
          type="button"
          className={`sheet-pill-btn ${selectedSheet === 'kinetic flower' ? 'active' : ''}`}
          onClick={() => setSelectedSheet('kinetic flower')}
        >
          Sheet: Kinetic Flower (32 Runs)
        </button>
      </div>

      {/* SHEET-SPECIFIC VIEW */}
      {activeSheetData && (
        <div className="sheet-analytics-section">
          <div className="kpi-grid">
            {/* KPI 1: Minimum Duration */}
            <div className={`kpi-card ${isMinQuery ? 'highlight-kpi' : ''}`}>
              <div className="kpi-label">
                <TrendingDown size={15} className="text-emerald" />
                <span>Minimum Duration (Lowest Run)</span>
              </div>
              <div className="kpi-val text-emerald">
                {dynamicMin}s
              </div>
              <div className="kpi-sub">
                Absolute minimum run recorded in sheet <strong>{activeSheetData.name}</strong>
              </div>
            </div>

            {/* KPI 2: Maximum Duration */}
            <div className={`kpi-card ${isMaxQuery ? 'highlight-kpi' : ''}`}>
              <div className="kpi-label">
                <TrendingUp size={15} className="text-indigo" />
                <span>Maximum Duration (Peak Run)</span>
              </div>
              <div className="kpi-val text-indigo">
                {dynamicMax}s
              </div>
              <div className="kpi-sub">
                Peak visitor engagement run in sheet <strong>{activeSheetData.name}</strong>
              </div>
            </div>

            {/* KPI 3: Average Duration */}
            <div className={`kpi-card ${(!isMinQuery && !isMaxQuery) ? 'highlight-kpi' : ''}`}>
              <div className="kpi-label">
                <Clock size={15} className="text-purple" />
                <span>Average Duration</span>
              </div>
              <div className="kpi-val text-purple">
                {typeof dynamicAvg === 'number' ? `${dynamicAvg.toFixed(2)}s` : dynamicAvg}
              </div>
              <div className="kpi-sub">
                Arithmetic mean duration across all {activeSheetData.runs} runs
              </div>
            </div>

            {/* KPI 4: Total Authentic Runs */}
            <div className="kpi-card">
              <div className="kpi-label">
                <Activity size={15} className="text-amber" />
                <span>Recorded Runs</span>
              </div>
              <div className="kpi-val text-amber">
                {activeSheetData.runs} <span className="kpi-unit">records</span>
              </div>
              <div className="kpi-sub">
                Source file: <strong>{activeSheetData.file}</strong>
              </div>
            </div>
          </div>

          <div className="dataset-verification-bar">
            <div className="verification-item">
              <CheckCircle2 size={15} className="text-emerald" />
              <span><strong>Sheet Ground Truth:</strong> Min: <strong>{activeSheetData.minDwellDisplay}</strong> · Max: <strong>{activeSheetData.maxDwellDisplay}</strong> · Avg: <strong>{activeSheetData.avgDwellDisplay}</strong></span>
            </div>
            <div className="verification-formula">
              Dynamic sample in view: <strong>{rowDurations.length} records evaluated</strong>
            </div>
          </div>
        </div>
      )}

      {/* ALL DATASET VIEW (Tabs: Interactions vs Dwell) */}
      {!activeSheetData && (
        <>
          {/* Scope Navigation Tabs */}
          <div className="analytics-tabs">
            <button
              type="button"
              className={`analytics-tab-btn ${activeTab === 'interactions' ? 'active' : ''}`}
              onClick={() => setActiveTab('interactions')}
            >
              <MousePointerClick size={15} />
              <span>Visitor Interactions & Presses</span>
              {isInteractionQuery && <span className="tab-match-tag">Query Target</span>}
            </button>
            <button
              type="button"
              className={`analytics-tab-btn ${activeTab === 'dwell' ? 'active' : ''}`}
              onClick={() => setActiveTab('dwell')}
            >
              <Clock size={15} />
              <span>Dwell Duration & Engagement Time</span>
              {!isInteractionQuery && <span className="tab-match-tag">Query Target</span>}
            </button>
          </div>

      {/* INTERACTIONS VIEW */}
      {activeTab === 'interactions' && (
        <>
          <div className="kpi-grid">
            {/* KPI 1: Minimum Interactions (Hero if min query, else avg) */}
            {isMinQuery ? (
              <div className="kpi-card highlight-kpi">
                <div className="kpi-label">
                  <TrendingDown size={15} className="text-emerald" />
                  <span>Minimum Interactions (Single Session)</span>
                </div>
                <div className="kpi-val text-emerald">
                  1 <span className="kpi-unit">press</span>
                </div>
                <div className="kpi-sub">
                  Lowest recorded interactions in a single visitor session (recorded in CSV)
                </div>
                <div className="kpi-extra-pill font-mono">
                  Museum Exhibit Lowest: <strong>11,739</strong> (CVRaman)
                </div>
              </div>
            ) : isMaxQuery ? (
              <div className="kpi-card highlight-kpi">
                <div className="kpi-label">
                  <TrendingUp size={15} className="text-indigo" />
                  <span>Maximum Interactions (Single Session)</span>
                </div>
                <div className="kpi-val text-indigo">
                  279 <span className="kpi-unit">presses</span>
                </div>
                <div className="kpi-sub">
                  Peak button presses recorded in a single visitor session (TacTile station)
                </div>
                <div className="kpi-extra-pill font-mono">
                  Museum Exhibit Highest: <strong>199,317</strong> (Color-perception)
                </div>
              </div>
            ) : (
              <div className="kpi-card highlight-kpi">
                <div className="kpi-label">
                  <Activity size={15} className="text-emerald" />
                  <span>Average Interactions / Session</span>
                </div>
                <div className="kpi-val text-emerald">
                  58.5 <span className="kpi-unit">presses</span>
                </div>
                <div className="kpi-sub">
                  1,329,443 total presses ÷ 22,722 sessions across museum
                </div>
              </div>
            )}

            {/* KPI 2: Least Interacted Exhibit */}
            <div className={`kpi-card ${isMinQuery ? 'sub-highlight-kpi' : ''}`}>
              <div className="kpi-label">
                <TrendingDown size={15} className="text-sky" />
                <span>Least Interacted Exhibit (Museum)</span>
              </div>
              <div className="kpi-val text-sky">
                11,739 <span className="kpi-unit">interactions</span>
              </div>
              <div className="kpi-sub">
                <strong>CVRaman</strong> station (lowest total interactions across all 25 exhibits)
              </div>
            </div>

            {/* KPI 3: Most Interacted Exhibit */}
            <div className={`kpi-card ${isMaxQuery ? 'sub-highlight-kpi' : ''}`}>
              <div className="kpi-label">
                <TrendingUp size={15} className="text-purple" />
                <span>Most Interacted Exhibit (Museum)</span>
              </div>
              <div className="kpi-val text-purple">
                199,317 <span className="kpi-unit">interactions</span>
              </div>
              <div className="kpi-sub">
                <strong>Color-perception-jayanagar</strong> (busiest exhibit in museum)
              </div>
            </div>

            {/* KPI 4: Total Museum Dataset Interactions */}
            <div className="kpi-card">
              <div className="kpi-label">
                <Zap size={15} className="text-amber" />
                <span>Total Museum Interactions</span>
              </div>
              <div className="kpi-val text-amber">
                1,329,443 <span className="kpi-unit">presses</span>
              </div>
              <div className="kpi-sub">
                Cumulative visitor interactions across 25 touch exhibits
              </div>
            </div>

            {/* KPI 5: Session Interaction Extremes */}
            <div className="kpi-card">
              <div className="kpi-label">
                <Activity size={15} className="text-pink" />
                <span>Single-Session Presses Range</span>
              </div>
              <div className="kpi-val text-pink">
                1 – 279 <span className="kpi-unit">presses</span>
              </div>
              <div className="kpi-sub">
                Min: 1 press | Max: 279 presses in a single session
              </div>
            </div>
          </div>

          <div className="dataset-verification-bar">
            <div className="verification-item">
              <CheckCircle2 size={15} className="text-emerald" />
              <span><strong>Interaction Verification:</strong> 1,329,443 Total Interactions ÷ 22,722 Sessions = <strong>58.5 presses / session</strong></span>
            </div>
            <div className="verification-formula">
              Single-Session Min: <strong>1 press</strong> · Exhibit Total Min: <strong>11,739 (CVRaman)</strong>
            </div>
          </div>
        </>
      )}

      {/* DWELL DURATION VIEW */}
      {activeTab === 'dwell' && (
        <>
          <div className="kpi-grid">
            {/* KPI 1: Whole Dataset Average Dwell */}
            <div className="kpi-card highlight-kpi">
              <div className="kpi-label">
                <Clock size={15} className="text-emerald" />
                <span>Overall Dataset Average Dwell</span>
              </div>
              <div className="kpi-val text-emerald">
                {matched ? matched.avg_dwell_display : '2m 47s'}
                <span className="kpi-unit">({matched ? `${matched.avg_dwell_seconds}s` : '167.3s'})</span>
              </div>
              <div className="kpi-sub">
                {matched ? (
                  <>Calculated across all <strong>{matched.sessions.toLocaleString()} sessions</strong> of {matched.display_name} in dataset</>
                ) : (
                  <>Calculated across <strong>all 22,722 sessions</strong> (Total: 1,056h 10m ÷ 22,722 = <strong>167.3s</strong>)</>
                )}
              </div>
            </div>

            {/* KPI 2: Minimum Dwell */}
            <div className="kpi-card">
              <div className="kpi-label">
                <TrendingDown size={15} className="text-sky" />
                <span>Minimum Recorded Dwell</span>
              </div>
              <div className="kpi-val text-sky">
                0.0s
              </div>
              <div className="kpi-sub">
                Quick bounce / touch recorded in CSV (e.g. SoundAnalyser, TacTile)
              </div>
            </div>

            {/* KPI 3: Maximum Dwell */}
            <div className="kpi-card">
              <div className="kpi-label">
                <TrendingUp size={15} className="text-indigo" />
                <span>Maximum Recorded Dwell</span>
              </div>
              <div className="kpi-val text-indigo">
                743.0s <span className="kpi-unit">(12m 23s)</span>
              </div>
              <div className="kpi-sub">
                Peak single-session visitor engagement (TacTile exhibit)
              </div>
            </div>

            {/* KPI 4: Average Interactions */}
            <div className="kpi-card">
              <div className="kpi-label">
                <Activity size={15} className="text-purple" />
                <span>Avg Interactions / Session</span>
              </div>
              <div className="kpi-val text-purple">
                58.5 <span className="kpi-unit">presses</span>
              </div>
              <div className="kpi-sub">
                1,329,443 total presses ÷ 22,722 dataset sessions
              </div>
            </div>

            {/* KPI 5: Interaction Range */}
            <div className="kpi-card">
              <div className="kpi-label">
                <Zap size={15} className="text-amber" />
                <span>Interaction Range</span>
              </div>
              <div className="kpi-val text-amber">
                1 – 279 <span className="kpi-unit">presses</span>
              </div>
              <div className="kpi-sub">
                Min: 1 press | Max: 279 presses in single session
              </div>
            </div>
          </div>

          <div className="dataset-verification-bar">
            <div className="verification-item">
              <CheckCircle2 size={15} className="text-emerald" />
              <span><strong>Dataset Coverage:</strong> 22,722 Sessions (100% of Entire Archive)</span>
            </div>
            <div className="verification-item">
              <span><strong>Engaged Time:</strong> 1,056h 10m (3,802,200s)</span>
            </div>
            <div className="verification-formula">
              <strong>Average Formula:</strong> 3,802,200s ÷ 22,722 sessions = <strong>167.3s (2m 47s)</strong>
            </div>
          </div>
        </>
      )}
    </>
  )}

      {/* Expandable Per-Exhibit Dataset Breakdown */}
      <div className="exhibit-averages-wrapper">
        <button
          type="button"
          className="exhibit-averages-toggle"
          onClick={() => setShowAllExhibits(!showAllExhibits)}
        >
          <span>View Dataset Metrics by Exhibit ({EXHIBIT_DATASET_METRICS.length} Exhibits)</span>
          {showAllExhibits ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showAllExhibits && (
          <div className="exhibit-averages-grid">
            {EXHIBIT_DATASET_METRICS.map((ex) => (
              <div key={ex.name} className="exhibit-avg-pill">
                <span className="exhibit-avg-name">{ex.name}</span>
                <div className="exhibit-stat-row">
                  <span className="text-muted">Interactions:</span>
                  <strong className="text-amber font-mono">{ex.interactions.toLocaleString()}</strong>
                </div>
                <div className="exhibit-stat-row">
                  <span className="text-muted">Avg Dwell:</span>
                  <strong className="text-emerald font-mono">{ex.avgDwell}</strong>
                </div>
                <div className="exhibit-stat-row">
                  <span className="text-muted">Sessions:</span>
                  <span className="font-mono">{ex.sessions.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
