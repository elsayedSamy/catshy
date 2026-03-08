const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  private devMode = false;
  private csrfToken: string | null = null;

  setDevMode(d: boolean) { this.devMode = d; }
  getDevMode() { return this.devMode; }

  /** Kept for backwards compat — no-op in cookie mode */
  setToken(_t: string | null) {}

  /** Read CSRF token from cookie or cached value */
  private getCsrfToken(): string | null {
    if (this.csrfToken) return this.csrfToken;
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  setCsrfToken(token: string) {
    this.csrfToken = token;
  }

  private async request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    if (this.devMode) throw new Error('DEV_MODE');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Add CSRF token for state-changing methods
    const method = (opts.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = this.getCsrfToken();
      if (csrf) headers['X-CSRF-Token'] = csrf;
    }

    Object.assign(headers, opts.headers || {});
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers,
      credentials: 'include',  // Send cookies
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  get = <T>(path: string) => this.request<T>(path);
  post = <T>(path: string, body?: unknown) => this.request<T>(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined });
  put = <T>(path: string, body?: unknown) => this.request<T>(path, { method: 'PUT', body: body != null ? JSON.stringify(body) : undefined });
  del = <T>(path: string) => this.request<T>(path, { method: 'DELETE' });

  async checkHealth(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`${API_BASE}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      return res.ok;
    } catch { return false; }
  }
}

export const api = new ApiClient();
