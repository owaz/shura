const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');
const ensureLeadingSlash = (value: string) => value.startsWith('/') ? value : `/${value}`;

export const API_BASE_URL = trimTrailingSlashes(
  import.meta.env.VITE_API_URL || 'http://localhost:5001'
);

export const WS_BASE_URL = trimTrailingSlashes(
  import.meta.env.VITE_WS_URL || API_BASE_URL
);

export const API_URL = `${API_BASE_URL}/api`;

export const apiUrl = (path: string) => `${API_URL}${ensureLeadingSlash(path)}`;

export const apiFetch = (path: string, init?: RequestInit) => fetch(apiUrl(path), init);

export const socketUrl = () => WS_BASE_URL;
