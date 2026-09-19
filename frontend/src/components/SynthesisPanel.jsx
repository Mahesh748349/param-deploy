import React, { useState, useEffect } from 'react';
import { Sparkles, Copy, Check, Loader2 } from 'lucide-react';
import { synthesizeEvidence } from '../api';

export default function SynthesisPanel({ query, results }) {
  const [loading, setLoading] = useState(false);
  const [synthesis, setSynthesis] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!query || !results || results.length === 0) return;

    let isMounted = true;
    setLoading(true);

    synthesizeEvidence({ query, text_results: results })
      .then((data) => {
        if (isMounted) {
          setSynthesis(data.summary || 'Summary unavailable.');
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          // Fallback simple synthesis if synthesis endpoint fails
          const sources = [...new Set(results.map((r) => r.source).filter(Boolean))];
          const topQuotes = results.slice(0, 3).map((r) => {
            const clean = r.text.replace(/^Source:.*?;\s*/i, '').trim();
            return `• ${clean.split(/(?<=[.!?])\s+/)[0] || clean.slice(0, 150)}`;
          });
          setSynthesis(`Relevant evidence retrieved from ${sources.join(', ')}:\n\n${topQuotes.join('\n\n')}`);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [query, results]);

  const handleCopy = () => {
    if (!synthesis) return;
    navigator.clipboard.writeText(synthesis);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="synthesis-card">
      <div className="synthesis-header">
        <div className="synthesis-title-group">
          <Sparkles size={16} className="text-indigo" />
          <h3 className="synthesis-title">Synthesized Overview</h3>
        </div>

        <button
          type="button"
          className="copy-btn"
          onClick={handleCopy}
          disabled={!synthesis || loading}
          title="Copy summary"
        >
          {copied ? <Check size={13} className="text-emerald" /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className="synthesis-body">
        {loading ? (
          <div className="synthesis-loading">
            <Loader2 className="spinner" size={18} />
            <span>Analyzing retrieved records...</span>
          </div>
        ) : (
          <div className="synthesis-text">
            {synthesis && synthesis.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
