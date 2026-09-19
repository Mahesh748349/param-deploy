import React, { useState, useEffect } from 'react';
import { Sparkles, Copy, Check, Loader2, Bot, AlertCircle } from 'lucide-react';
import { synthesizeEvidence } from '../api';

export default function SynthesisPanel({ query, results }) {
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [isConfigured, setIsConfigured] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!query || !results || results.length === 0) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    synthesizeEvidence({ query, text_results: results })
      .then((data) => {
        if (!isMounted) return;
        setAnswer(data.summary || 'No answer generated.');
        setIsConfigured(data.is_configured !== false);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to generate answer.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [query, results]);

  const handleCopy = () => {
    if (!answer) return;
    navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="synthesis-card">
      <div className="synthesis-header">
        <div className="synthesis-title-group">
          <Sparkles size={16} className="text-indigo" />
          <h3 className="synthesis-title">AI Answer & Analysis</h3>
          <span className="gemini-badge">Gemini 1.5 Flash</span>
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
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : (
          <div className="synthesis-text">
            {answer && answer.split('\n\n').map((paragraph, idx) => (
              <p key={idx}>
                {paragraph.split('**').map((chunk, cIdx) =>
                  cIdx % 2 === 1 ? <strong key={cIdx}>{chunk}</strong> : chunk
                )}
              </p>
            ))}
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
