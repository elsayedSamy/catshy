const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  private token: string | null = null;
  private devMode = false;

  setToken(t: string | null) { this.token = t; }
  setDevMode(d: boolean) { this.devMode = d; }
  getDevMode() { return this.devMode; }

  private async request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    if (this.devMode) throw new Error('DEV_MODE');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token && this.token !== 'dev-token') headers['Authorization'] = `Bearer ${this.token}`;
    Object.assign(headers, opts.headers || {});
    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
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
