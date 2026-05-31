import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, setTokens, clearTokens } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'BUYER' | 'VENDOR' | 'ADMIN';
  level?: string | null;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  register: (data: RegisterData) => Promise<{ ok: boolean; message?: string }>;
  loginWithGoogle: (idToken: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone: string;
  role?: 'BUYER' | 'VENDOR';
  level?: string;
  storeName?: string;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('cc_user');
    if (raw) {
      try { setUser(JSON.parse(raw)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  function persist(u: User, accessToken: string, refreshToken: string) {
    setTokens(accessToken, refreshToken);
    localStorage.setItem('cc_user', JSON.stringify(u));
    setUser(u);
  }

  async function login(email: string, password: string) {
    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }, false);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, message: body.message ?? 'Sign in failed.' };
      persist(body.user, body.accessToken, body.refreshToken);
      return { ok: true };
    } catch {
      return { ok: false, message: 'Network error. Is the server running?' };
    }
  }

  async function register(data: RegisterData) {
    try {
      const res = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...data, role: data.role ?? 'BUYER' }),
      }, false);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, message: body.message ?? 'Registration failed.' };
      persist(body.user, body.accessToken, body.refreshToken);
      return { ok: true };
    } catch {
      return { ok: false, message: 'Network error. Is the server running?' };
    }
  }

  async function loginWithGoogle(idToken: string) {
    try {
      const res = await api('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      }, false);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, message: body.message ?? 'Google sign-in failed.' };
      persist(body.user, body.accessToken, body.refreshToken);
      return { ok: true };
    } catch {
      return { ok: false, message: 'Network error. Is the server running?' };
    }
  }

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    clearTokens();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
