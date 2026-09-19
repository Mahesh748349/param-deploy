import React from 'react';
import { AlertCircle, Loader2, Info, X } from 'lucide-react';

export default function StatusBanner({ error, notice, isSpinningUp, onDismiss }) {
  if (!error && !notice && !isSpinningUp) return null;

  const isError = Boolean(error);
  const isNotice = Boolean(!error && notice);

  return (
    <div className={`status-banner ${isError ? 'banner-error' : isNotice ? 'banner-info' : 'banner-warning'}`}>
      <div className="banner-content">
        {isError ? (
          <AlertCircle size={16} className="banner-icon" />
        ) : isNotice ? (
          <Info size={16} className="banner-icon" />
        ) : (
          <Loader2 size={16} className="spinner banner-icon" />
        )}
        <div className="banner-text">
          {error || notice || 'Connecting to hosted retrieval instance (Render free tier instances may take 30-50s to wake up)...'}
        </div>
      </div>
      {onDismiss && (
        <button type="button" className="banner-close-btn" onClick={onDismiss} aria-label="Dismiss">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
