import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

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

    // 1. Check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((err) => {
      console.warn('[Auth] Error getting session:', err);
      setLoading(false);
    });

    // 2. Subscribe to auth state changes (login, logout, token refresh, email confirm link click)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Sign up with real email confirmation
  const signUp = async (email, password) => {
    if (!supabase) throw new Error('Supabase client is not configured.');
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo
      }
    });
  };

  // Sign in with email and password
  const signIn = async (email, password) => {
    if (!supabase) throw new Error('Supabase client is not configured.');
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
