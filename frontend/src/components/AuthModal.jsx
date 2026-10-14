import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Send, ArrowLeft, ShieldCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isEmailAllowed } from '../config/allowedUsers';

export default function AuthModal({ isOpen, onClose, initialMode = 'signin' }) {
  const { signIn, signUp, resendConfirmation, resetPassword, updatePassword, isRecoveryMode, setIsRecoveryMode } = useAuth();
  
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup' | 'forgot' | 'verify-sent' | 'reset-password'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [resentStatus, setResentStatus] = useState(false);

  // Sync mode with prop or password recovery state when opened
  useEffect(() => {
    if (isOpen) {
      if (isRecoveryMode) {
        setMode('reset-password');
      } else {
        setMode(initialMode);
      }
      setError(null);
      setSuccessMsg(null);
      setResentStatus(false);
    }
  }, [isOpen, initialMode, isRecoveryMode]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();

    // 1. Password Reset Completion Flow (when user clicked email link)
    if (mode === 'reset-password') {
      if (!password || password.length < 6) {
        setError('New password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      setLoading(true);
      try {
        await updatePassword(password);
        setSuccessMsg('🎉 Password updated successfully! You are now logged in.');
        setTimeout(() => {
          onClose();
        }, 1500);
      } catch (err) {
        setError(err.message || 'Failed to update password. The reset link may have expired.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    // 2. Strict Whitelist Check for Unauthorized Emails
    if (!isEmailAllowed(cleanEmail)) {
      setError("⛔ Unauthorized: You do not have permission to access or create an account with this email. Only designated team members are authorized.");
      return;
    }

    // 3. Forgot password request flow
    if (mode === 'forgot') {
      setLoading(true);
      try {
        const { error: resetErr } = await resetPassword(cleanEmail);
        if (resetErr) {
          if (resetErr.message?.toLowerCase().includes('rate limit')) {
            setError('⚠️ Email rate limit exceeded by Supabase. Please wait a few minutes before requesting another reset email.');
          } else {
            throw resetErr;
          }
        } else {
          setSuccessMsg(`Password reset email sent to ${cleanEmail}. Please check your inbox and click the reset link.`);
        }
      } catch (err) {
        setError(err.message || 'Failed to send reset email.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Password validation for signin and signup
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    // 4. Sign up flow
    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      setLoading(true);
      try {
        const { data, error: signUpErr } = await signUp(cleanEmail, password);
        if (signUpErr) {
          if (signUpErr.message?.toLowerCase().includes('rate limit')) {
            setError('⚠️ Email rate limit reached by Supabase. Please wait a few minutes before trying to sign up again.');
          } else {
            throw signUpErr;
          }
        } else if (data.user && !data.session) {
          // Email confirmation is required
          setMode('verify-sent');
        } else {
          // Direct login
          onClose();
        }
      } catch (err) {
        setError(err.message || 'Sign up failed.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 5. Sign in flow
    if (mode === 'signin') {
      setLoading(true);
      try {
        const { data, error: signInErr } = await signIn(cleanEmail, password);
        if (signInErr) {
          if (signInErr.message?.toLowerCase().includes('email not confirmed')) {
            setError('Your email is not verified yet. Please click the link in your inbox, or resend the verification email below.');
          } else {
            throw signInErr;
          }
        } else if (data.session) {
          onClose();
        }
      } catch (err) {
        setError(err.message || 'Invalid email or password.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResend = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { error: resendErr } = await resendConfirmation(email.trim());
      if (resendErr) {
        if (resendErr.message?.toLowerCase().includes('rate limit')) {
          setError('⚠️ Email rate limit reached. Please wait a few minutes before resending.');
        } else {
          throw resendErr;
        }
      } else {
        setResentStatus(true);
        setTimeout(() => setResentStatus(false), 8000);
      }
    } catch (err) {
      setError(err.message || 'Failed to resend confirmation email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop auth-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        {/* State 1: Verification Email Sent Confirmation Screen */}
        {mode === 'verify-sent' ? (
          <div className="verify-sent-view">
            <div className="verify-icon-wrapper">
              <Mail className="text-indigo" size={36} />
            </div>
            <h3 className="auth-title">Verify Your Email</h3>
            <p className="verify-subtitle">
              We have sent an activation link to:
            </p>
            <div className="verify-email-badge">
              <strong>{email}</strong>
            </div>
            <p className="verify-instructions">
              Please open your email inbox (and check your spam folder) and click the link to confirm your account. Once verified, you can sign in to unlock search and AI synthesis.
            </p>

            {resentStatus && (
              <div className="auth-alert alert-success">
                <CheckCircle2 size={16} />
                <span>Verification email resent successfully!</span>
              </div>
            )}

            {error && (
              <div className="auth-alert alert-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="verify-actions">
              <button
                type="button"
                className="btn-secondary verify-resend-btn"
                onClick={handleResend}
                disabled={loading}
              >
                {loading ? <Loader2 size={14} className="spinner" /> : <Send size={14} />}
                <span>Resend Verification Email</span>
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={() => { setMode('signin'); setError(null); }}
              >
                Go to Sign In
              </button>
            </div>
          </div>
        ) : (
          /* State 2: Sign In / Sign Up / Forgot Password / Reset Password Forms */
          <>
            <div className="auth-header">
              <div className="auth-icon-badge">
                {mode === 'reset-password' ? (
                  <KeyRound size={24} className="text-indigo" />
                ) : (
                  <ShieldCheck size={24} className="text-indigo" />
                )}
              </div>
              <h3 className="auth-title">
                {mode === 'signin' && 'Welcome Back'}
                {mode === 'signup' && 'Create Your Account'}
                {mode === 'forgot' && 'Reset Password'}
                {mode === 'reset-password' && 'Set New Password'}
              </h3>
              <p className="auth-subtitle">
                {mode === 'signin' && 'Sign in to access real-time telemetry search & Gemini synthesis.'}
                {mode === 'signup' && 'Authorized team registration. Verification link will be sent to your inbox.'}
                {mode === 'forgot' && 'Enter your authorized email to receive a secure password reset link.'}
                {mode === 'reset-password' && 'Enter your new password below to reset your credentials.'}
              </p>
            </div>

            {/* Tab switchers (only visible for signin and signup) */}
            {(mode === 'signin' || mode === 'signup') && (
              <div className="auth-tabs">
                <button
                  type="button"
                  className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
                  onClick={() => { setMode('signin'); setError(null); setSuccessMsg(null); }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
                  onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }}
                >
                  Sign Up
                </button>
              </div>
            )}

            {/* Error / Success Notifications */}
            {error && (
              <div className="auth-alert alert-error">
                <AlertCircle size={16} className="flex-shrink-0" />
                <div className="alert-content">
                  <span>{error}</span>
                  {error.includes('not verified') && (
                    <button
                      type="button"
                      className="inline-resend-btn"
                      onClick={handleResend}
                      disabled={loading}
                    >
                      Resend Link
                    </button>
                  )}
                </div>
              </div>
            )}

            {successMsg && (
              <div className="auth-alert alert-success">
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              {/* Email field (not needed in reset-password mode) */}
              {mode !== 'reset-password' && (
                <div className="auth-field">
                  <label htmlFor="auth-email">Email Address</label>
                  <div className="input-icon-wrapper">
                    <Mail size={16} className="field-icon" />
                    <input
                      id="auth-email"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>
              )}

              {/* Password field */}
              {mode !== 'forgot' && (
                <div className="auth-field">
                  <div className="field-label-row">
                    <label htmlFor="auth-password">
                      {mode === 'reset-password' ? 'New Password' : 'Password'}
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        className="forgot-link"
                        onClick={() => { setMode('forgot'); setError(null); setSuccessMsg(null); }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="input-icon-wrapper">
                    <Lock size={16} className="field-icon" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm password field (signup or reset-password) */}
              {(mode === 'signup' || mode === 'reset-password') && (
                <div className="auth-field">
                  <label htmlFor="auth-confirm-password">Confirm Password</label>
                  <div className="input-icon-wrapper">
                    <Lock size={16} className="field-icon" />
                    <input
                      id="auth-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary auth-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={16} className="spinner" />
                ) : (
                  <span>
                    {mode === 'signin' && 'Sign In'}
                    {mode === 'signup' && 'Create Account'}
                    {mode === 'forgot' && 'Send Reset Link'}
                    {mode === 'reset-password' && 'Set New Password'}
                  </span>
                )}
              </button>

              {(mode === 'forgot' || mode === 'reset-password') && (
                <button
                  type="button"
                  className="btn-back-link"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setSuccessMsg(null);
                    if (setIsRecoveryMode) setIsRecoveryMode(false);
                  }}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Sign In</span>
                </button>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
