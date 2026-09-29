import React, { useState } from 'react';
import { BarChart3, Clock, TrendingDown, TrendingUp, Activity, Zap, Sparkles, Database, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

const EXHIBIT_DATASET_AVERAGES = [
  { name: 'Color-perception-jayanagar', avg: '6m 46s', sec: 406, sessions: 1316, interactions: 199317 },
  { name: 'Color-perception', avg: '6m 47s', sec: 407, sessions: 1208, interactions: 185911 },
  { name: 'Rangolify', avg: '4m 39s', sec: 279, sessions: 1551, interactions: 137837 },
  { name: 'OKI-2', avg: '3m 1s', sec: 181, sessions: 1443, interactions: 145898 },
  { name: 'pace-the-clock-jaynagar', avg: '3m 40s', sec: 220, sessions: 983, interactions: 72512 },
  { name: 'FrequencyTestKiosk', avg: '3m 32s', sec: 212, sessions: 1133, interactions: 30583 },
  { name: 'traffic-gallery-sign-game', avg: '2m 48s', sec: 168, sessions: 1429, interactions: 64251 },
  { name: 'LandsatNameJayanagar', avg: '2m 43s', sec: 163, sessions: 1169, interactions: 92822 },
  { name: 'Circle-Drawing', avg: '2m 41s', sec: 161, sessions: 1278, interactions: 79420 },
  { name: 'TacTile', avg: '2m 6s', sec: 126, sessions: 1274, interactions: 88372 },
  { name: 'pace-the-clock', avg: '2m 20s', sec: 140, sessions: 1023, interactions: 49614 },
  { name: 'non-euclidean', avg: '1m 48s', sec: 108, sessions: 1014, interactions: 37633 },
  { name: 'Lilavati-ancient', avg: '1m 34s', sec: 94, sessions: 481, interactions: 16714 },
  { name: 'Ayurvedic-plant-explorer', avg: '1m 13s', sec: 73, sessions: 1000, interactions: 17224 },
  { name: 'yoga-infinite-scroll', avg: '1m 9s', sec: 69, sessions: 937, interactions: 22445 },
  { name: 'CVRaman', avg: '1m 3s', sec: 63, sessions: 399, interactions: 11739 },
  { name: 'scale-of-universe', avg: '1m 2s', sec: 62, sessions: 918, interactions: 15671 }
];

export default function AnalyticsMetricsCard({ analytics, query, dataRows = [] }) {
  const [showAllExhibits, setShowAllExhibits] = useState(false);

  const whole = analytics?.whole_dataset || {
    total_interactions: 1329443,
    total_sessions: 22722,
    total_engaged_time: '1056h 10m',
    avg_dwell_display: '2m 47s',
    avg_dwell_seconds: 167.3,
    avg_interactions_per_session: 58.5,
    min_dwell_seconds: 0.0,
    max_dwell_seconds: 743.0,
    max_dwell_display: '12m 23s',
    min_interactions: 1,
    max_interactions: 279,
    exhibits_count: 25,
    busiest_exhibit: 'Color-perception-jayanagar'
  };

  const matched = analytics?.matched_exhibit || null;

  return (
    <div className="analytics-metrics-card">
      <div className="analytics-header">
        <div className="analytics-title-group">
          <BarChart3 size={20} className="text-emerald" />
          <h3 className="analytics-title">Dataset Telemetry Analytics</h3>
          <span className="dataset-scope-badge">
            <CheckCircle2 size={13} className="text-emerald" /> 100% Whole Dataset Benchmark
          </span>
          {matched && (
            <span className="exhibit-match-badge font-mono">
              Exhibit Match: {matched.display_name}
            </span>
          )}
        </div>
        <div className="analytics-dataset-meta">
          <Database size={14} className="text-indigo" />
          <span>22,722 Total Sessions · 1,329,443 Interactions · 25 Exhibits</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
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
              <>Calculated across all <strong>{matched.sessions.toLocaleString()} sessions</strong> of {matched.display_name} in the dataset</>
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

        {/* KPI 5: Interaction Extremes */}
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

      {/* Dataset Verification & Mathematical Integrity Bar */}
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

      {/* Expandable Per-Exhibit Dataset Averages */}
      <div className="exhibit-averages-wrapper">
        <button
          type="button"
          className="exhibit-averages-toggle"
          onClick={() => setShowAllExhibits(!showAllExhibits)}
        >
          <span>View Dataset Average Dwell by Exhibit ({EXHIBIT_DATASET_AVERAGES.length} Exhibits)</span>
          {showAllExhibits ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showAllExhibits && (
          <div className="exhibit-averages-grid">
            {EXHIBIT_DATASET_AVERAGES.map((ex) => (
              <div key={ex.name} className="exhibit-avg-pill">
                <span className="exhibit-avg-name">{ex.name}</span>
                <span className="exhibit-avg-stat font-mono text-emerald">{ex.avg} ({ex.sec}s)</span>
                <span className="exhibit-avg-sub font-mono">{ex.sessions.toLocaleString()} sessions</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
