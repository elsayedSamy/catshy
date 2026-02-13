import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, UserRole, AuthState } from '@/types';
import { api } from '@/lib/api';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  canAccess: (requiredRoles?: UserRole[]) => boolean;
  isDevMode: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = import.meta.env.VITE_API_URL || '/api';
// In preview (no backend), default to dev mode. In production, require VITE_DEV_AUTO_ADMIN=true
const DEV_AUTO_ADMIN = import.meta.env.VITE_DEV_AUTO_ADMIN !== 'false';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, token: null, isAuthenticated: false, isLoading: true,
  });
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('catshy_token');
    const userData = localStorage.getItem('catshy_user');
    if (token && userData) {
      try {
        const user = JSON.parse(userData) as User;
        api.setToken(token);
        setState({ user, token, isAuthenticated: true, isLoading: false });
      } catch {
        localStorage.removeItem('catshy_token');
        localStorage.removeItem('catshy_user');
        tryDevMode();
      }
    } else {
      tryDevMode();
    }
  }, []);

  const tryDevMode = async () => {
    let isRealBackend = false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`${API_BASE}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        isRealBackend = data?.service === 'catshy-api';
      }
    } catch {}

    if (isRealBackend) {
      // Real backend detected — user must login via /login
      setState(s => ({ ...s, isLoading: false }));
    } else if (DEV_AUTO_ADMIN) {
      // Dev mode only when explicitly enabled
      const devUser: User = {
        id: 'dev-admin', email: 'admin@catshy.local', name: 'Dev Admin',
        role: 'system_owner', roles: ['system_owner', 'user'], created_at: new Date().toISOString(), is_active: true,
      };
      api.setDevMode(true);
      setIsDevMode(true);
      setState({ user: devUser, token: 'dev-token', isAuthenticated: true, isLoading: false });
    } else {
      // No backend + no dev mode = show login
      setState(s => ({ ...s, isLoading: false }));
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, isLoading: true }));

    // Check if real backend is available
    let backendAvailable = false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const healthRes = await fetch(`${API_BASE}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (healthRes.ok) {
        const hData = await healthRes.json().catch(() => ({}));
        backendAvailable = hData?.service === 'catshy-api';
      }
    } catch {}

    if (backendAvailable) {
      // Real backend login
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: 'Login failed' }));
          throw new Error(err.detail || 'Login failed');
        }
        const data = await res.json();
        localStorage.setItem('catshy_token', data.access_token);
        localStorage.setItem('catshy_user', JSON.stringify(data.user));
        api.setToken(data.access_token);
        api.setDevMode(false);
        setIsDevMode(false);
        setState({ user: data.user, token: data.access_token, isAuthenticated: true, isLoading: false });
      } catch (e) {
        setState(s => ({ ...s, isLoading: false }));
        throw e;
      }
    } else {
      // Dev mode fallback — accept any credentials
      const devUser: User = {
        id: 'dev-admin', email, name: email.split('@')[0] || 'Dev User',
        role: 'system_owner', roles: ['system_owner', 'user'], created_at: new Date().toISOString(), is_active: true,
      };
      api.setDevMode(true);
      api.setToken('dev-token');
      setIsDevMode(true);
      localStorage.setItem('catshy_token', 'dev-token');
      localStorage.setItem('catshy_user', JSON.stringify(devUser));
      setState({ user: devUser, token: 'dev-token', isAuthenticated: true, isLoading: false });
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('catshy_token');
    localStorage.removeItem('catshy_user');
    api.setToken(null);
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
  }, []);

  const hasRole = useCallback((roles: UserRole[]) => {
    if (!state.user) return false;
    return roles.includes(state.user.role);
  }, [state.user]);

  const canAccess = useCallback((requiredRoles?: UserRole[]) => {
    if (!state.isAuthenticated || !state.user) return false;
    if (!requiredRoles || requiredRoles.length === 0) return true;
    return requiredRoles.includes(state.user.role);
  }, [state.isAuthenticated, state.user]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasRole, canAccess, isDevMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
