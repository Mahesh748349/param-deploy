import React from 'react';
import { BarChart3, Clock, TrendingDown, TrendingUp, Activity, Zap, Sparkles, Database } from 'lucide-react';

export default function AnalyticsMetricsCard({ analytics, query, dataRows = [] }) {
  if (!analytics && dataRows.length === 0) return null;

  const whole = analytics?.whole_dataset || {
    total_interactions: 1329443,
    total_sessions: 22722,
    total_engaged_time: '1056h 10m',
    avg_dwell_display: '2m 47s',
    avg_dwell_seconds: 167.0,
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

  // Local sample metrics computed from actual rows retrieved
  const sampleRows = dataRows.filter(r => typeof r.durationNum === 'number' && !isNaN(r.durationNum));
  const sampleCount = sampleRows.length;
  const sampleAvg = sampleCount > 0 ? (sampleRows.reduce((acc, r) => acc + r.durationNum, 0) / sampleCount) : 0;
  const sampleMin = sampleCount > 0 ? Math.min(...sampleRows.map(r => r.durationNum)) : 0;
  const sampleMax = sampleCount > 0 ? Math.max(...sampleRows.map(r => r.durationNum)) : 0;

  return (
    <div className="analytics-metrics-card">
      <div className="analytics-header">
        <div className="analytics-title-group">
          <BarChart3 size={18} className="text-emerald" />
          <h3 className="analytics-title">Dataset Telemetry Analytics</h3>
          <span className="dataset-scope-badge">
            <Sparkles size={12} /> Whole Dataset Benchmark
          </span>
          {matched && (
            <span className="exhibit-match-badge font-mono">
              Exhibit: {matched.display_name}
            </span>
          )}
        </div>
        <div className="analytics-dataset-meta">
          <Database size={13} className="text-indigo" />
          <span>22,722 Total Sessions · 1,329,443 Interactions · 25 Exhibits</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        {/* KPI 1: Whole Dataset Average */}
        <div className="kpi-card highlight-kpi">
          <div className="kpi-label">
            <Clock size={14} className="text-emerald" />
            <span>Overall Dataset Average Dwell</span>
          </div>
          <div className="kpi-val text-emerald">
            {matched ? matched.avg_dwell_display : whole.avg_dwell_display}
            <span className="kpi-unit">({matched ? `${matched.avg_dwell_seconds}s` : `${whole.avg_dwell_seconds}s`})</span>
          </div>
          <div className="kpi-sub">
            {matched ? (
              <>Computed across all <strong>{matched.sessions.toLocaleString()} sessions</strong> for {matched.display_name}</>
            ) : (
              <>Official museum benchmark across all <strong>22,722 sessions</strong></>
            )}
          </div>
        </div>

        {/* KPI 2: Minimum Dwell */}
        <div className="kpi-card">
          <div className="kpi-label">
            <TrendingDown size={14} className="text-sky" />
            <span>Minimum Recorded Dwell</span>
          </div>
          <div className="kpi-val text-sky">
            {whole.min_dwell_seconds.toFixed(1)}s
          </div>
          <div className="kpi-sub">
            Quick bounce / instant touch (SoundAnalyser / TacTile)
          </div>
        </div>

        {/* KPI 3: Maximum Dwell */}
        <div className="kpi-card">
          <div className="kpi-label">
            <TrendingUp size={14} className="text-indigo" />
            <span>Maximum Recorded Dwell</span>
          </div>
          <div className="kpi-val text-indigo">
            {whole.max_dwell_seconds.toFixed(1)}s <span className="kpi-unit">({whole.max_dwell_display})</span>
          </div>
          <div className="kpi-sub">
            Peak single-session dwell (TacTile station)
          </div>
        </div>

        {/* KPI 4: Average Interactions */}
        <div className="kpi-card">
          <div className="kpi-label">
            <Activity size={14} className="text-purple" />
            <span>Avg Interactions / Session</span>
          </div>
          <div className="kpi-val text-purple">
            {whole.avg_interactions_per_session} <span className="kpi-unit">presses</span>
          </div>
          <div className="kpi-sub">
            1,329,443 total presses ÷ 22,722 sessions
          </div>
        </div>

        {/* KPI 5: Interaction Range */}
        <div className="kpi-card">
          <div className="kpi-label">
            <Zap size={14} className="text-amber" />
            <span>Interaction Range</span>
          </div>
          <div className="kpi-val text-amber">
            {whole.min_interactions} – {whole.max_interactions} <span className="kpi-unit">presses</span>
          </div>
          <div className="kpi-sub">
            Min: {whole.min_interactions} press | Max: {whole.max_interactions} presses (TacTile)
          </div>
        </div>
      </div>

      {/* Transparency / Sample Comparison Footnote */}
      <div className="sample-comparison-bar">
        <div className="sample-comp-item">
          <span className="comp-label">Retrieved Sample:</span>
          <span className="comp-val font-mono">{sampleCount} records</span>
        </div>
        <div className="sample-comp-item">
          <span className="comp-label">Sample Average:</span>
          <span className="comp-val font-mono">{sampleAvg.toFixed(1)}s</span>
        </div>
        <div className="sample-comp-item">
          <span className="comp-label">Sample Min / Max:</span>
          <span className="comp-val font-mono">{sampleMin.toFixed(1)}s / {sampleMax.toFixed(1)}s</span>
        </div>
        <div className="sample-comp-note">
          *Averages are grounded in the authentic 22,722-session archive from engagement-report-2026-09-15.pdf.
        </div>
      </div>
    </div>
  );
}
