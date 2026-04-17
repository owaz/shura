export async function adminFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('adminToken');
  const headers = { ...(opts.headers || {}), 'Content-Type': 'application/json' } as any;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(url, { ...opts, headers });

    if (res.status === 401 || res.status === 403) {
      // Clear admin auth and redirect to admin login
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      // If we're on an admin page, navigate to /admin/login
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/admin/login';
      }
      throw new Error('Unauthorized');
    }

    return res;
  } catch (err) {
    // Network or CORS errors bubble up here
    console.error('adminFetch error', err);
    throw err;
  }
}
