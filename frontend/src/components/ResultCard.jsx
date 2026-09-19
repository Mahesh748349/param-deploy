import React, { useState } from 'react';
import { FileText, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

export default function ResultCard({ result, rank, searchQuery }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

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

  // Strip redundant "Source: filename; row:..." prefix from the text body if present
  const cleanSnippetText = (text) => {
    if (!text) return '';
    return text.replace(/^Source:\s*[^;]+;\s*(?:row|sheet):[^.]+\.\s*/i, '').trim();
  };

  const bodyText = cleanSnippetText(result.text);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
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
          <span className="source-name">{result.source || 'Document Source'}</span>
          {result.locator && (
            <span className="source-locator">{formatLocator(result.locator)}</span>
          )}
        </div>

        <button
          type="button"
          className="copy-btn"
          onClick={handleCopy}
          title="Copy text snippet"
        >
          {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

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

      {/* Relevant metadata tags */}
      {result.attributes && Object.keys(result.attributes).length > 0 && (
        <div className="card-tags">
          {Object.entries(result.attributes).slice(0, 4).map(([key, value]) => (
            <span key={key} className="meta-tag">
              <span className="meta-key">{key}:</span> {String(value)}
            </span>
          ))}
        </div>
      )}

      {/* Technical details toggle */}
      <div className="card-footer">
        <button
          type="button"
          className="details-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          <span>Score & retrieval details</span>
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
