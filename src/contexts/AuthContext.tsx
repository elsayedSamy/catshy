import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, UserRole, AuthState } from '@/types';
import { api } from '@/lib/api';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  canAccess: (requiredRoles?: UserRole[]) => boolean;
  isDevMode: boolean;
  workspaceId: string | null;
  switchWorkspace: (workspaceId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const DEV_AUTO_ADMIN = import.meta.env.VITE_DEV_AUTO_ADMIN !== 'false';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, token: null, isAuthenticated: false, isLoading: true,
  });
  const [isDevMode, setIsDevMode] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // On mount: try /auth/me (cookie-based), then dev mode fallback
  useEffect(() => {
    fetchMe();
  }, []);

  const fetchMe = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const user = data.user as User;
        api.setDevMode(false);
        setIsDevMode(false);
        setWorkspaceId(user.workspace_id || null);
        setState({ user, token: 'cookie', isAuthenticated: true, isLoading: false });
        return;
      }
    } catch {}

    // No valid session — try dev mode
    await tryDevMode();
  };

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
      setState(s => ({ ...s, isLoading: false }));
    } else if (DEV_AUTO_ADMIN) {
      const devUser: User = {
        id: 'dev-admin', email: 'admin@catshy.local', name: 'Dev Admin',
        role: 'system_owner', roles: ['system_owner', 'user'],
        created_at: new Date().toISOString(), is_active: true,
      };
      api.setDevMode(true);
      setIsDevMode(true);
      setWorkspaceId('dev-workspace');
      setState({ user: devUser, token: 'dev-token', isAuthenticated: true, isLoading: false });
    } else {
      setState(s => ({ ...s, isLoading: false }));
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, isLoading: true }));

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
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include',  // Accept cookies from server
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: 'Login failed' }));
          throw new Error(err.detail || 'Login failed');
        }
        const data = await res.json();
        const user = data.user as User;
        const wsId = user.workspace_id || null;

        // Store CSRF token for subsequent requests
        if (data.csrf_token) {
          api.setCsrfToken(data.csrf_token);
        }

        api.setDevMode(false);
        setIsDevMode(false);
        setWorkspaceId(wsId);
        setState({ user, token: 'cookie', isAuthenticated: true, isLoading: false });
      } catch (e) {
        setState(s => ({ ...s, isLoading: false }));
        throw e;
      }
    } else {
      // Dev mode fallback
      const devUser: User = {
        id: 'dev-admin', email, name: email.split('@')[0] || 'Dev User',
        role: 'system_owner', roles: ['system_owner', 'user'],
        created_at: new Date().toISOString(), is_active: true,
      };
      api.setDevMode(true);
      setIsDevMode(true);
      setWorkspaceId('dev-workspace');
      setState({ user: devUser, token: 'dev-token', isAuthenticated: true, isLoading: false });
    }
  }, []);

  const logout = useCallback(async () => {
    // Call server to clear cookies
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}

    api.setDevMode(false);
    setWorkspaceId(null);
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
  }, []);

  const switchWorkspace = useCallback(async (newWorkspaceId: string) => {
    if (isDevMode) {
      setWorkspaceId(newWorkspaceId);
      return;
    }
    try {
      const csrf = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf[1]);

      const res = await fetch(`${API_BASE}/auth/switch-workspace`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ workspace_id: newWorkspaceId }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to switch workspace' }));
        throw new Error(err.detail);
      }
      const data = await res.json();
      if (data.csrf_token) api.setCsrfToken(data.csrf_token);
      setWorkspaceId(newWorkspaceId);
      // Re-fetch user to update workspace context
      setState(s => ({ ...s, token: 'cookie' }));
    } catch (e) {
      throw e;
    }
  }, [isDevMode]);

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
    <AuthContext.Provider value={{ ...state, login, logout, hasRole, canAccess, isDevMode, workspaceId, switchWorkspace }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
