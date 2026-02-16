/**
 * api.ts — API Client for AI Agora
 * ==================================
 */

// @ts-expect-error Vite injects import.meta.env at build time
const API_URL: string | undefined = import.meta.env?.VITE_API_URL;
const BASE = API_URL ? `${API_URL}/api` : '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('agora_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
};

// ─── Auth helpers ───

export function getToken(): string | null {
  return localStorage.getItem('agora_token');
}

export function setToken(token: string): void {
  localStorage.setItem('agora_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('agora_token');
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
