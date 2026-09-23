import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { isEmailAllowed } from '../config/allowedUsers';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    // Helper to validate and clean up unauthorized sessions
    const handleSession = (currentSession) => {
      const email = currentSession?.user?.email;
      if (email && !isEmailAllowed(email)) {
        console.warn('[Auth] Unauthorized email detected, logging out:', email);
        supabase.auth.signOut();
        setSession(null);
        setUser(null);
        return;
      }
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
    };

    // 1. Check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
      setLoading(false);
    }).catch((err) => {
      console.warn('[Auth] Error getting session:', err);
      setLoading(false);
    });

    // 2. Subscribe to auth state changes (login, logout, token refresh, email confirm link click)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Sign up with real email confirmation and whitelist guard
  const signUp = async (email, password) => {
    if (!supabase) throw new Error('Supabase client is not configured.');
    if (!isEmailAllowed(email)) {
      throw new Error('Access restricted. Registration is limited to authorized team members only.');
    }
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo
      }
    });
  };

  // Sign in with email, password, and whitelist guard
  const signIn = async (email, password) => {
    if (!supabase) throw new Error('Supabase client is not configured.');
    if (!isEmailAllowed(email)) {
      throw new Error('Access restricted. This email is not authorized for Param Retrieval Studio.');
    }
    return await supabase.auth.signInWithPassword({
      email,
      password
    });
  };

  // Sign out
  const signOut = async () => {
    if (!supabase) return;
    return await supabase.auth.signOut();
  };

  // Resend verification email
  const resendConfirmation = async (email) => {
    if (!supabase) throw new Error('Supabase client is not configured.');
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    return await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: redirectTo
      }
    });
  };

  // Reset password email
  const resetPassword = async (email) => {
    if (!supabase) throw new Error('Supabase client is not configured.');
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });
  };

  const value = {
    user,
    session,
    loading,
    isConfigured: isSupabaseConfigured,
    signUp,
    signIn,
    signOut,
    resendConfirmation,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
