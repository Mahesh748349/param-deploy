import React, { useState } from 'react';
import { FileText, Copy, Check, ChevronDown, ChevronUp, Sparkles, Database, Eye } from 'lucide-react';
import { generateSingleRecordNarrative, extractRecordData } from '../utils/narrativeEngine';

export default function ResultCard({ result, rank, searchQuery }) {
  const [copied, setCopied] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Generate plain English explanation using the Narrative Engine
  const narrative = generateSingleRecordNarrative(result);
  const data = extractRecordData(result);

  // Format locator nicely: "row:9558|char:0" -> "Row 9558"
  const formatLocator = (locator) => {
    if (!locator) return '';
    return locator
      .replace(/row:(\d+)/i, 'Row $1')
      .replace(/char:\d+/i, '')
      .replace(/\|/g, ' ')
      .replace(/sheet:([^|]+)/i, 'Sheet $1')
      .trim();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article className="result-card">
      <div className="card-top">
        <div className="card-source-info">
          <span className="rank-tag">#{rank}</span>
          <FileText size={15} className="text-secondary" />
          <span className="source-name">{result.source || 'Dataset Source'}</span>
          {result.locator && (
            <span className="source-locator">{formatLocator(result.locator)}</span>
          )}
        </div>

        <button
          type="button"
          className="copy-btn"
          onClick={handleCopy}
          title="Copy plain English summary"
        >
          {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Human-Readable Natural Language Narrative */}
      <div className="narrative-box">
        <div className="narrative-badge">
          <Sparkles size={13} className="text-indigo" />
          <span>Plain English Summary</span>
        </div>
        <p className="narrative-text">
          {narrative}
        </p>
      </div>

      {/* Structured Telemetry Pills */}
      {data && Object.keys(data).length > 0 && (
        <div className="card-tags">
          {data.exhibit_id && (
            <span className="meta-tag">
              <span className="meta-key">Exhibit:</span> {data.display_name || data.exhibit_id}
            </span>
          )}
          {data.duration_s && (
            <span className="meta-tag">
              <span className="meta-key">Dwell Time:</span> {data.duration_s}s
            </span>
          )}
          {data.presses !== undefined && (
            <span className="meta-tag">
              <span className="meta-key">Presses:</span> {data.presses}
            </span>
          )}
          {data.started_at && (
            <span className="meta-tag">
              <span className="meta-key">Date:</span> {data.started_at.slice(0, 10)}
            </span>
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="card-footer">
        <div className="card-footer-buttons">
          {/* Toggle raw JSON/CSV data */}
          <button
            type="button"
            className="details-toggle"
            onClick={() => setShowRawData(!showRawData)}
          >
            <Database size={12} />
            <span>{showRawData ? 'Hide raw data' : 'View raw record'}</span>
            {showRawData ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Toggle technical RRF score & ranks */}
          <button
            type="button"
            className="details-toggle"
            onClick={() => setShowDetails(!showDetails)}
          >
            <span>Retrieval score & details</span>
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Raw Record Drawer */}
        {showRawData && (
          <div className="raw-record-drawer">
            <pre><code>{result.text}</code></pre>
          </div>
        )}

        {/* Technical Score Drawer */}
        {showDetails && (
          <div className="details-drawer">
            <div className="detail-item">
              <span className="detail-label">RRF Score:</span>
              <span className="detail-val">{typeof result.score === 'number' ? result.score.toFixed(5) : result.score}</span>
            </div>
            {result.ranks?.dense !== undefined && (
              <div className="detail-item">
                <span className="detail-label">Dense Rank:</span>
                <span className="detail-val">#{result.ranks.dense}</span>
              </div>
            )}
            {result.ranks?.lexical !== undefined && (
              <div className="detail-item">
                <span className="detail-label">BM25 Rank:</span>
                <span className="detail-val">#{result.ranks.lexical}</span>
              </div>
            )}
            <div className="detail-item">
              <span className="detail-label">Chunk ID:</span>
              <span className="detail-val font-mono">{result.id?.slice(0, 18)}...</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
