const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');
const ensureLeadingSlash = (value: string) => value.startsWith('/') ? value : `/${value}`;
const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const CSRF_STORAGE_KEY = 'shura-csrf-token';
const CSRF_COOKIE_NAME = 'shura_csrf_token';
const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5001';

export const API_BASE_URL = trimTrailingSlashes(
  import.meta.env.VITE_API_URL || runtimeOrigin
);

export const WS_BASE_URL = trimTrailingSlashes(
  import.meta.env.VITE_WS_URL || API_BASE_URL
);

export const API_URL = `${API_BASE_URL}/api`;

export const apiUrl = (path: string) => `${API_URL}${ensureLeadingSlash(path)}`;

const getCookieValue = (name: string) => {
  if (typeof document === 'undefined') return null;

  return document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=') || null;
};

const getCsrfToken = () => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(CSRF_STORAGE_KEY) || getCookieValue(CSRF_COOKIE_NAME);
};

export const apiFetch = (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  const method = (init.method || 'GET').toUpperCase();
  const csrfToken = getCsrfToken();

  if (csrfToken && unsafeMethods.has(method) && !headers.has('x-csrf-token')) {
    headers.set('x-csrf-token', csrfToken);
  }

  return fetch(apiUrl(path), {
    ...init,
    credentials: init.credentials ?? 'include',
    headers,
  });
};

export const socketUrl = () => WS_BASE_URL;
