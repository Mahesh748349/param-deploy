import React from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';

export default function StatusBanner({ error, isSpinningUp, onDismiss }) {
  if (!error && !isSpinningUp) return null;

  return (
    <div className={`status-banner ${error ? 'banner-error' : 'banner-warning'}`}>
      <div className="banner-content">
        {error ? (
          <AlertCircle size={16} className="banner-icon" />
        ) : (
          <Loader2 size={16} className="spinner banner-icon" />
        )}
        <div className="banner-text">
          {error
            ? error
            : 'Connecting to hosted retrieval instance (Render free tier instances may take 30-50s to wake up)...'}
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
