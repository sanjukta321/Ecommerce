/**
 * Base HTTP client for all Frappe API calls.
 *
 * - URL comes from VITE_API_BASE_URL in .env (never hardcoded)
 * - Always sends cookies (session-based auth)
 * - Always sends X-Frappe-CSRF-Token: fetch (required by Frappe)
 * - Throws a typed ApiError on non-2xx responses
 */

// In dev: reads from .env (VITE_API_BASE_URL=http://localhost:8100)
// In prod (served through Frappe): .env.production sets it to '' so API calls are relative (same host)
export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8100';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Core fetch wrapper. All service methods go through here.
 *
 * Usage:
 *   const data = await api<{ data: Item[] }>('/api/resource/Item?limit=10');
 *   const result = await api('/api/method/login', { method: 'POST', body: JSON.stringify({ usr, pwd }) });
 */
export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': 'fetch',
      ...options.headers,
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      data._error_message ||
      data.exception?.split('\n').pop()?.trim() ||
      data.message ||
      `HTTP ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

/** Convenience: POST with a JSON body */
export function post<T = unknown>(path: string, body: unknown, options: RequestInit = {}): Promise<T> {
  return api<T>(path, { method: 'POST', body: JSON.stringify(body), ...options });
}

/** Convenience: PUT with a JSON body */
export function put<T = unknown>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

/** Convenience: DELETE */
export function del<T = unknown>(path: string): Promise<T> {
  return api<T>(path, { method: 'DELETE' });
}
