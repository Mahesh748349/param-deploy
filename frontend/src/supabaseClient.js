import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://tdctsjkcxgnwfeidzach.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkY3RzamtjeGdud2ZlaWR6YWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwOTI0MjYsImV4cCI6MjEwNTY2ODQyNn0.Ua-bSWFL3w_zVxtF8Zqprw_IhsBc1nZxeLfvkvJ_L_M';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
