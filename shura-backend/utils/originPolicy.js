const LOCAL_DEVELOPMENT_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3003',
  'http://localhost:3005',
  'http://localhost:3006',
]);

const normalizeOrigin = (origin) => String(origin || '').trim().replace(/\/+$/, '');

const configuredOrigins = (env = process.env) => [
  env.FRONTEND_URLS,
  env.FRONTEND_URL,
  env.ALLOWED_ORIGINS,
]
  .filter(Boolean)
  .flatMap((value) => String(value).split(','))
  .map(normalizeOrigin)
  .filter((origin) => /^https?:\/\/[^/]+$/i.test(origin));

const isAllowedOrigin = (origin, env = process.env) => {
  // Non-browser clients and same-origin browser requests may omit Origin.
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (configuredOrigins(env).includes(normalized)) return true;
  return env.NODE_ENV !== 'production' && LOCAL_DEVELOPMENT_ORIGINS.has(normalized);
};

const assertProductionOrigins = (env = process.env) => {
  if (env.NODE_ENV !== 'production') return;
  if (!configuredOrigins(env).length) {
    throw new Error('Production requires FRONTEND_URL, FRONTEND_URLS, or ALLOWED_ORIGINS');
  }
};

module.exports = { assertProductionOrigins, configuredOrigins, isAllowedOrigin, normalizeOrigin };
