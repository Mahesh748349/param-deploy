import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { isEmailAllowed } from '../config/allowedUsers';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    // Check if user arrived via recovery link
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setIsRecoveryMode(true);
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

    // 2. Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      }
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
      throw new Error("⛔ Unauthorized: You do not have permission to access or create an account with this email. Only designated team members are authorized.");
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
      throw new Error("⛔ Unauthorized: This email is not authorized for Param Retrieval Studio.");
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
    if (!isEmailAllowed(email)) {
      throw new Error("⛔ Unauthorized: This email is not recognized as an authorized team member.");
    }
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });
  };

  // Update password (used after clicking password reset recovery link)
  const updatePassword = async (newPassword) => {
    if (!supabase) throw new Error('Supabase client is not configured.');
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
    setIsRecoveryMode(false);
    return data;
  };

  const value = {
    user,
    session,
    loading,
    isRecoveryMode,
    setIsRecoveryMode,
    isConfigured: isSupabaseConfigured,
    signUp,
    signIn,
    signOut,
    resendConfirmation,
    resetPassword,
    updatePassword
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
