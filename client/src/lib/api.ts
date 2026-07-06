// ─── API helper ──────────────────────────────────────────────────────────────
// Reads access token from localStorage, attaches it to every request,
// and tries one refresh-then-retry on a 401.

const ACCESS_KEY = 'cc_accessToken';
const REFRESH_KEY = 'cc_refreshToken';

// In dev, Vite proxies /api → localhost:4000 so leaving this empty makes
// fetch('/api/...') just work. In prod the frontend (Vercel) and backend
// (Render) live on different origins, so we prepend the full backend URL.
// Set VITE_API_URL in client/.env (and in Vercel project env vars) to e.g.
// "https://api.campuschoo.com" — no trailing slash.
const rawApiBase = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? '';
const API_BASE = rawApiBase.replace(/\/+$/, '').replace(/\/api$/, '');

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

// Where Socket.io should connect to. Empty string → use same origin (works in
// dev because Vite proxies /socket.io to the backend). In prod set
// VITE_SOCKET_URL=https://api.campuschoo.com (or fall back to VITE_API_URL).
export const SOCKET_URL = (() => {
  const env = (import.meta as unknown as { env?: { VITE_SOCKET_URL?: string } }).env;
  const explicit = env?.VITE_SOCKET_URL;
  if (explicit) return explicit;
  if (API_BASE) return API_BASE;
  return '/';
})();

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
