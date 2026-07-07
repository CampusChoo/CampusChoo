// ─── API helper ──────────────────────────────────────────────────────────────
// Reads access token from localStorage, attaches it to every request,
// and tries one refresh-then-retry on a 401.

const ACCESS_KEY = 'cc_accessToken';
const REFRESH_KEY = 'cc_refreshToken';

// API calls go through the Supabase Edge Function named `api`.
// Set VITE_API_URL to https://<project>.supabase.co/functions/v1/api, or let it
// derive that URL from VITE_SUPABASE_URL.
const env = (import.meta as unknown as {
  env?: { VITE_API_URL?: string; VITE_SUPABASE_URL?: string };
}).env;
const rawApiBase = env?.VITE_API_URL?.trim();
const rawSupabaseUrl = env?.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
const API_BASE = (
  rawApiBase ||
  (rawSupabaseUrl ? `${rawSupabaseUrl}/functions/v1/api` : '')
).replace(/\/+$/, '').replace(/\/api$/, '');

function fullUrl(path: string): string {
  if (!API_BASE) return path;
  return path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/${path}`;
}

// Exported so direct fetch() calls outside this file (e.g. for public/no-auth
// endpoints) can prepend the prod backend URL too. In dev, returns the path
// unchanged so Vite's proxy still works.
export function apiUrl(path: string): string {
  return fullUrl(path);
}

export function getAccessToken(): string | null {
  return typeof window === 'undefined' ? null : localStorage.getItem(ACCESS_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem('cc_user');
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  try {
    const res = await fetch(fullUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      // Refresh failed — tokens are dead. Clear them so the user can log in fresh
      // instead of seeing "Access token expired" on every page load forever.
      clearTokens();
      return false;
    }
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function api(path: string, init: RequestInit = {}, withAuth = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (withAuth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  // FormData sets its own multipart/form-data boundary; only default JSON for other bodies.
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res = await fetch(fullUrl(path), { ...init, headers });

  if (res.status === 401 && withAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(fullUrl(path), { ...init, headers });
    }
  }

  return res;
}
