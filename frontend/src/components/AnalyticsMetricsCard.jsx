import React from 'react';
import { BarChart3, Database } from 'lucide-react';

export default function AnalyticsMetricsCard({ analytics }) {
  if (!analytics) return null;
  const metrics = analytics.metrics || [];
  const scope = analytics.scope || {};
  const filters = [scope.source, scope.sheet, scope.exhibit,
    scope.date_from && `from ${scope.date_from}`, scope.date_to && `through ${scope.date_to}`].filter(Boolean);
  return (
    <div className="analytics-metrics-card">
      <div className="analytics-header">
        <div className="analytics-title-group">
          <BarChart3 size={20} />
          <h3 className="analytics-title">Calculated from published records</h3>
        </div>
        <span><Database size={14} /> {analytics.records?.toLocaleString()} matching records</span>
      </div>
      <p>{filters.length ? filters.join(' · ') : 'All matching structured records in the active index'}</p>
      <p>{analytics.answer}</p>
      <div className="kpi-grid">
        {metrics.map(item => (
          <div className="kpi-card" key={item.operation}>
            <div className="kpi-label">{item.operation} {item.field}</div>
            <div className="kpi-val">{item.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              <span className="kpi-unit"> {item.unit}</span>
            </div>
            {item.operation === 'average' && <p>Formula: {item.formula}</p>}
            {item.exhibits?.length > 0 && <p>Recorded at: {item.exhibits.join(', ')}</p>}
            {item.evidence?.length > 0 && (
              <ul>{item.evidence.map((row, index) =>
                <li key={index}>{row.source} — {row.locator}{row.exhibit ? ` — ${row.exhibit}` : ''}</li>)}</ul>
            )}
            {item.evidence_truncated && <p>Showing the first 20 matching source locations.</p>}
          </div>
        ))}
      </div>
      {analytics.groups?.length > 0 && (
        <div className="table-responsive">
          <table className="telemetry-data-table">
            <thead><tr><th>Exhibit</th><th>Records</th>
              {metrics.map(item => <th key={item.operation}>{item.operation} ({item.unit})</th>)}</tr></thead>
            <tbody>{analytics.groups.map(group => <tr key={group.exhibit}>
              <td>{group.exhibit}</td><td>{group.records}</td>
              {metrics.map(item => <td key={item.operation}>{group.metrics[item.operation]?.toLocaleString()}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      )}
      <p>Sources: {analytics.sources?.join(', ') || 'No matching sources'}.</p>
      {scope.date_basis && <p>Date filter: {scope.date_basis}.</p>}
      <p>These calculations use complete published structured rows, independently of search result count.</p>
    </div>
  );
}
