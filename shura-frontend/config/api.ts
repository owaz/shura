const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');
const ensureLeadingSlash = (value: string) => value.startsWith('/') ? value : `/${value}`;
export const AUTH_TOKEN_STORAGE_KEY = 'shura-auth0-access-token';
const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5001';

export const API_BASE_URL = trimTrailingSlashes(
  import.meta.env.VITE_API_URL || runtimeOrigin
);

export const WS_BASE_URL = trimTrailingSlashes(
  import.meta.env.VITE_WS_URL || API_BASE_URL
);

export const API_URL = `${API_BASE_URL}/api`;

export const apiUrl = (path: string) => `${API_URL}${ensureLeadingSlash(path)}`;

export const getStoredAccessToken = () => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
};

export const setStoredAccessToken = (token: string | null) => {
  if (typeof window === 'undefined') return;
  if (!token) {
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
};

export const apiFetch = (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  const token = getStoredAccessToken();
  if (token && !headers.has('authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(apiUrl(path), {
    ...init,
    credentials: init.credentials ?? 'omit',
    headers,
  });
};

export const socketUrl = () => WS_BASE_URL;
