import React, { useState } from 'react';
import { Sparkles, Copy, Check } from 'lucide-react';
import { generateExecutiveSummary } from '../utils/narrativeEngine';

export default function SynthesisPanel({ query, results }) {
  const [copied, setCopied] = useState(false);

  // Generate instant natural-language executive summary across all records
  const synthesis = generateExecutiveSummary(query, results);

  const handleCopy = () => {
    navigator.clipboard.writeText(synthesis);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="synthesis-card">
      <div className="synthesis-header">
        <div className="synthesis-title-group">
          <Sparkles size={16} className="text-indigo" />
          <h3 className="synthesis-title">Executive Summary & Analysis</h3>
        </div>

        <button
          type="button"
          className="copy-btn"
          onClick={handleCopy}
          title="Copy executive summary"
        >
          {copied ? <Check size={13} className="text-emerald" /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy Summary'}</span>
        </button>
      </div>

      <div className="synthesis-body">
        <div className="synthesis-text">
          {synthesis.split('\n\n').map((paragraph, idx) => (
            <p key={idx}>
              {paragraph.split('**').map((chunk, cIdx) =>
                cIdx % 2 === 1 ? <strong key={cIdx}>{chunk}</strong> : chunk
              )}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
