import React, { useState } from 'react';
import { FileText, Copy, Check, ChevronDown, ChevronUp, Clock, Touchpad, Calendar, Eye } from 'lucide-react';

export default function ResultCard({ result, rank, searchQuery }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showRawRow, setShowRawRow] = useState(false);

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

  // Strip only the leading "Source: filename; row:..." prefix line
  const cleanSnippetText = (text) => {
    if (!text) return '';
    return text.replace(/^Source:\s*[^;]+;\s*(?:row|sheet):[^\n\r]+(?:\r?\n)?/i, '').trim();
  };

  const bodyText = cleanSnippetText(result.text);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Check if this is a structured telemetry log
  const attrs = result.attributes || {};
  const hasTelemetry = attrs.exhibit_id || attrs.duration_s || attrs.presses;

  // Format duration nicely
  const formatDuration = (secStr) => {
    const sec = parseFloat(secStr);
    if (isNaN(sec)) return secStr;
    if (sec < 60) return `${sec.toFixed(1)} seconds`;
    const mins = (sec / 60).toFixed(1);
    return `${sec.toFixed(1)}s (~${mins} mins)`;
  };

  // Highlight matching query terms
  const renderHighlighted = (text, query) => {
    if (!query || !text) return text;
    const words = query
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (words.length === 0) return text;
    const regex = new RegExp(`(${words.join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="highlight-mark">{part}</mark>
      ) : (
        part
      )
    );
  };

  const isLong = bodyText.length > 280;
  const displayText = isLong && !expanded ? `${bodyText.slice(0, 280)}...` : bodyText;

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
          title="Copy raw record"
        >
          {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Structured Telemetry Card View */}
      {hasTelemetry ? (
        <div className="telemetry-card">
          <div className="telemetry-grid">
            {attrs.exhibit_id && (
              <div className="telemetry-item">
                <span className="telemetry-label">Exhibit / Station</span>
                <span className="telemetry-value highlight-text">
                  {attrs.display_name || attrs.exhibit_id}
                </span>
              </div>
            )}

            {attrs.duration_s && (
              <div className="telemetry-item">
                <span className="telemetry-label">
                  <Clock size={12} className="inline-icon" /> Visitor Dwell Time
                </span>
                <span className="telemetry-value">
                  {formatDuration(attrs.duration_s)}
                </span>
              </div>
            )}

            {attrs.presses !== undefined && (
              <div className="telemetry-item">
                <span className="telemetry-label">
                  <Touchpad size={12} className="inline-icon" /> Button / Touch Presses
                </span>
                <span className="telemetry-value">
                  {attrs.presses} interactions
                </span>
              </div>
            )}

            {attrs.started_at && (
              <div className="telemetry-item">
                <span className="telemetry-label">
                  <Calendar size={12} className="inline-icon" /> Session Timestamp
                </span>
                <span className="telemetry-value font-mono">
                  {attrs.started_at.replace('T', ' ').slice(0, 19)} UTC
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="view-raw-btn"
            onClick={() => setShowRawRow(!showRawRow)}
          >
            <Eye size={12} />
            <span>{showRawRow ? 'Hide raw row' : 'View raw CSV row text'}</span>
          </button>

          {showRawRow && (
            <div className="raw-row-box">
              <code>{renderHighlighted(bodyText, searchQuery)}</code>
            </div>
          )}
        </div>
      ) : (
        /* Standard Clean Text View */
        <div className="card-body">
          <p className="card-snippet">
            {renderHighlighted(displayText, searchQuery)}
          </p>

          {isLong && (
            <button
              type="button"
              className="expand-btn"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <><span>Show less</span><ChevronUp size={13} /></>
              ) : (
                <><span>Show more</span><ChevronDown size={13} /></>
              )}
            </button>
          )}
        </div>
      )}

      {/* Technical details toggle */}
      <div className="card-footer">
        <button
          type="button"
          className="details-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          <span>Retrieval Score & Ranks</span>
          {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

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
