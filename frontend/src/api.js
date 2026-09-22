import { supabase } from './supabaseClient';

// API configuration supporting local development and production deployment (Netlify -> Render)
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }
  } catch (err) {
    console.warn('[API] Auth header resolution warning:', err);
  }
  return headers;
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`Health check returned ${res.status}`);
  return res.json();
}

export async function retrieveQuery({ query, top_k = 5, scope = 'text' }) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/retrieve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, top_k, scope })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || `HTTP error ${res.status}`);
  }
  return data;
}

export async function synthesizeEvidence({ query, text_results }) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/synthesize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, text_results })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to synthesize');
  }
  return data;
}
