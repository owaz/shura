export async function clientFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('shura-auth-token');
  const headers = { ...(opts.headers || {}), 'Content-Type': 'application/json' } as any;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(url, { ...opts, headers });

    if (res.status === 401 || res.status === 403) {
      // Clear client auth and redirect to login hub
      localStorage.removeItem('shura-auth-token');
      localStorage.removeItem('shura-current-user');
      localStorage.removeItem('shura-auth');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    return res;
  } catch (err) {
    console.error('clientFetch error', err);
    throw err;
  }
}
