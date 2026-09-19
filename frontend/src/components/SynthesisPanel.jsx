import React, { useState, useEffect } from 'react';
import { Sparkles, Copy, Check, Loader2, Bot, AlertCircle, RefreshCw } from 'lucide-react';
import { synthesizeEvidence } from '../api';

export default function SynthesisPanel({ query, results }) {
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [modelName, setModelName] = useState('Gemini 3.6 Flash');
  const [isConfigured, setIsConfigured] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadSynthesis = () => {
    if (!query || !results || results.length === 0) return;
    setLoading(true);
    setError(null);

    synthesizeEvidence({ query, text_results: results })
      .then((data) => {
        setAnswer(data.summary || 'No answer generated.');
        if (data.model) {
          setModelName(data.model.replace(/^models\//, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
        }
        setIsConfigured(data.is_configured !== false);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to generate answer.');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadSynthesis();
  }, [query, results]);

  const handleCopy = () => {
    if (!answer) return;
    navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const renderInline = (str) => {
    return str.split('**').map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  };

  const renderFormattedAnswer = (text) => {
    if (!text) return null;
    const blocks = text.split(/\n\n+/);

    return blocks.map((block, bIdx) => {
      const lines = block.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      const isList = lines.length > 0 && lines.every((l) => /^[*•-]\s+/.test(l) || /^\d+\.\s+/.test(l));

      if (isList) {
        return (
          <ul key={bIdx} className="synthesis-list">
            {lines.map((line, lIdx) => {
              const cleanLine = line.replace(/^[*•-]\s+/, '').replace(/^\d+\.\s+/, '');
              return <li key={lIdx}>{renderInline(cleanLine)}</li>;
            })}
          </ul>
        );
      }

      return <p key={bIdx}>{renderInline(block)}</p>;
    });
  };

  return (
    <div className="synthesis-card">
      <div className="synthesis-header">
        <div className="synthesis-title-group">
          <Sparkles size={16} className="text-indigo" />
          <h3 className="synthesis-title">AI Answer & Analysis</h3>
          <span className="gemini-badge">{modelName}</span>
        </div>

        <button
          type="button"
          className="copy-btn"
          onClick={handleCopy}
          disabled={!answer || loading}
          title="Copy answer"
        >
          {copied ? <Check size={13} className="text-emerald" /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className="synthesis-body">
        {loading ? (
          <div className="synthesis-loading">
            <Loader2 className="spinner text-indigo" size={18} />
            <span>Gemini is analyzing the {results.length} retrieved records and formulating a direct answer...</span>
          </div>
        ) : error ? (
          <div className="synthesis-error">
            <div className="synthesis-error-msg">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
            <button
              type="button"
              className="synthesis-retry-btn"
              onClick={loadSynthesis}
              title="Retry synthesis"
            >
              <RefreshCw size={12} />
              <span>Retry</span>
            </button>
          </div>
        ) : (
          <div className="synthesis-text">
            {renderFormattedAnswer(answer)}
          </div>
        )}
      </div>

      <div className="synthesis-footer">
        <Bot size={13} className="text-muted" />
        <span>Grounded strictly on the {results.length} relevant rows retrieved from your Qdrant index.</span>
      </div>
    </div>
  );
}

