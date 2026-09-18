import type { AuthTokens } from './types';

const ACCESS_KEY = 'wigo.accessToken';
const REFRESH_KEY = 'wigo.refreshToken';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: { accessToken: string; refreshToken: string }): void {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const BASE = '/api';

async function raw<T>(path: string, init: RequestInit, retryOnAuth = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const access = tokenStore.access;
  if (access) headers.set('Authorization', `Bearer ${access}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  // Transparently refresh once on a 401, then replay the original request.
  if (res.status === 401 && retryOnAuth && tokenStore.refresh) {
    const refreshed = await tryRefresh();
    if (refreshed) return raw<T>(path, init, false);
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = body?.error ?? { code: 'error', message: res.statusText };
    throw new ApiError(res.status, err.code ?? 'error', err.message ?? 'Request failed');
  }
  return body as T;
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      tokenStore.clear();
      return false;
    }
    const tokens = (await res.json()) as AuthTokens;
    tokenStore.set(tokens);
    return true;
  } catch {
    tokenStore.clear();
    return false;
  }
}

export const api = {
  get: <T>(path: string) => raw<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    raw<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    raw<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
};

// Auth calls don't attach a bearer and must not trigger the refresh loop.
export async function authPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = parsed?.error ?? { code: 'error', message: res.statusText };
    throw new ApiError(res.status, err.code ?? 'error', err.message ?? 'Request failed');
  }
  return parsed as T;
}
