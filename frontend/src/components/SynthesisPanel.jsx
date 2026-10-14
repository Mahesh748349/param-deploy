import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Copy, Check, Loader2, Bot, AlertCircle, RefreshCw } from 'lucide-react';
import { synthesizeEvidence } from '../api';

export default function SynthesisPanel({ query, results, filters }) {
  const request = useRef(null);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [modelName, setModelName] = useState('Optional AI summary');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadSynthesis = useCallback(() => {
    if (!query || !results || results.length === 0) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;

    synthesizeEvidence({ query, filters, signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setAnswer(data.summary || 'No answer generated.');
        if (data.model) {
          setModelName(data.model.replace(/^models\//, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
        }
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err.message || 'Failed to generate answer.');
        setLoading(false);
      });
  }, [query, results, filters]);

  useEffect(() => {
    loadSynthesis();
    return () => request.current?.abort();
  }, [loadSynthesis]);

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
            <span>Preparing a summary from retrieved evidence...</span>
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
        <span>Summaries use retrieved evidence. Dataset calculations are handled separately.</span>
      </div>
    </div>
  );
}

