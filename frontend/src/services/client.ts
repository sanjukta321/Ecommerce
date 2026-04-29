/**
 * Base HTTP client for all Frappe API calls.
 *
 * CSRF token strategy (in priority order):
 *  1. window.frappe.csrf_token — injected by Frappe via <!-- csrf_token --> in www/index.html
 *     This is always present when the app is served through Frappe.
 *  2. API fallback — GET /api/method/store_customizations.api.get_csrf_token
 *     Used in local dev when the app runs on a separate Vite port (no Frappe template).
 */

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ── CSRF token ─────────────────────────────────────────────────────────────

let _cachedToken: string | null = null;
let _tokenFetch: Promise<string> | null = null;

function getInjectedToken(): string | null {
  // Frappe replaces <!-- csrf_token --> with <script>frappe.csrf_token = "...";</script>
  const token = (window as unknown as { frappe?: { csrf_token?: string } }).frappe?.csrf_token;
  if (token && token !== 'None') return token;
  // Legacy: meta tag fallback
  const content = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (content && content !== 'None') return content;
  return null;
}

function resolveToken(): Promise<string> {
  // Fast path: Frappe injects the token via script tag on every page load
  const injected = getInjectedToken();
  if (injected) return Promise.resolve(injected);

  // Cached value from a previous API fetch
  if (_cachedToken !== null) return Promise.resolve(_cachedToken);

  // Fetch from the API (only runs in dev without the Frappe template)
  if (!_tokenFetch) {
    _tokenFetch = fetch(`${BASE_URL}/api/method/store_customizations.api.get_csrf_token`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then((d: { message?: string }) => {
        _cachedToken = d.message ?? '';
        _tokenFetch = null;
        return _cachedToken;
      })
      .catch(() => {
        _tokenFetch = null;
        _cachedToken = '';
        return '';
      });
  }
  return _tokenFetch;
}

/** Pre-warm the token at app start (optional — api() fetches it lazily anyway). */
export function initCsrfToken(): void {
  resolveToken();
}

/** Clear the cached token (called automatically on CSRFTokenError). */
export function clearCsrfToken(): void {
  _cachedToken = null;
  _tokenFetch = null;
}

// ── Core fetch wrapper ─────────────────────────────────────────────────────

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await resolveToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-CSRF-Token': token,
      ...options.headers,
    },
    ...options,
  });

  const data = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok) {
    if (data?.exc_type === 'CSRFTokenError') {
      clearCsrfToken();
    }
    const message =
      (data._error_message as string) ||
      (data.exception as string)?.split('\n').pop()?.trim() ||
      (data.message as string) ||
      `HTTP ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

export function post<T = unknown>(path: string, body: unknown, options: RequestInit = {}): Promise<T> {
  return api<T>(path, { method: 'POST', body: JSON.stringify(body), ...options });
}

export function put<T = unknown>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

export function del<T = unknown>(path: string): Promise<T> {
  return api<T>(path, { method: 'DELETE' });
}
