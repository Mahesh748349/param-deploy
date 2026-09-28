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
      if (session?.user?.email) {
        headers['X-User-Email'] = session.user.email.toLowerCase().trim();
      }
    }
  } catch (err) {
    console.warn('[API] Auth header resolution warning:', err);
  }
  return headers;
}

async function parseJsonResponse(res, defaultErrorMsg = 'Request failed') {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // text was not valid JSON
  }

  if (!res.ok) {
    const errorMsg = data?.message || data?.error || (text && text.length < 200 && !text.includes('<!DOCTYPE') ? text : `${defaultErrorMsg} (HTTP ${res.status})`);
    throw new Error(errorMsg);
  }

  if (!data) {
    throw new Error(`Empty response from backend server (HTTP ${res.status})`);
  }
  return data;
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  return parseJsonResponse(res, 'Health check failed');
}

export async function retrieveQuery({ query, top_k = 5, scope = 'text' }) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/retrieve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, top_k, scope })
  });

  return parseJsonResponse(res, 'Search retrieval request failed');
}

export async function synthesizeEvidence({ query, text_results }) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/synthesize`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, text_results })
  });

  return parseJsonResponse(res, 'AI synthesis request failed');
}
