const { getAuth0Config } = require('../config/auth0');

let cachedToken = null;
let cachedTokenExpiry = 0;

const requiredEnv = ['AUTH0_M2M_CLIENT_ID', 'AUTH0_M2M_CLIENT_SECRET'];

const assertManagementConfig = () => {
  const missing = requiredEnv.filter((key) => !(process.env[key] || '').trim());
  if (missing.length) {
    throw new Error(`Missing required Auth0 management env vars: ${missing.join(', ')}`);
  }
};

const getManagementToken = async () => {
  assertManagementConfig();
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry - 30_000) return cachedToken;

  const config = getAuth0Config();
  const response = await fetch(`${config.issuerBaseUrl}oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.AUTH0_M2M_CLIENT_ID,
      client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
      audience: `${config.issuerBaseUrl}api/v2/`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Auth0 token request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  cachedTokenExpiry = now + Number(data.expires_in || 3600) * 1000;
  return cachedToken;
};

const managementRequest = async (path, init = {}) => {
  const config = getAuth0Config();
  const token = await getManagementToken();
  const response = await fetch(`${config.issuerBaseUrl}api/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Auth0 Management API ${path} failed (${response.status}): ${bodyText}`);
  }

  if (response.status === 204) return null;
  return response.json();
};

const updateAppMetadata = async (auth0UserId, appMetadata) =>
  managementRequest(`/users/${encodeURIComponent(auth0UserId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ app_metadata: appMetadata }),
  });

const setBlocked = async (auth0UserId, blocked) =>
  managementRequest(`/users/${encodeURIComponent(auth0UserId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ blocked: Boolean(blocked) }),
  });

const assignRoles = async (auth0UserId, roleIds = []) => {
  const uniqueRoleIds = [...new Set(roleIds.filter(Boolean))];
  if (!uniqueRoleIds.length) return null;
  return managementRequest(`/users/${encodeURIComponent(auth0UserId)}/roles`, {
    method: 'POST',
    body: JSON.stringify({ roles: uniqueRoleIds }),
  });
};

const searchUsers = async (query = '', page = 0, perPage = 50) => {
  const q = query ? `&q=${encodeURIComponent(query)}` : '';
  return managementRequest(`/users?search_engine=v3${q}&page=${page}&per_page=${perPage}`);
};

module.exports = {
  assignRoles,
  searchUsers,
  setBlocked,
  updateAppMetadata,
};
