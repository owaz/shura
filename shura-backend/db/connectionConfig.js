const trueValues = new Set(['true', '1', 'yes']);
const falseValues = new Set(['false', '0', 'no']);

const parseBoolean = (value, fallback) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (trueValues.has(normalized)) return true;
  if (falseValues.has(normalized)) return false;
  throw new Error(`Invalid boolean configuration value: ${normalized}`);
};

const buildSslConfig = (env = process.env) => {
  const enabled = parseBoolean(env.DB_SSL, env.NODE_ENV === 'production');
  if (!enabled) return false;
  const rejectUnauthorized = parseBoolean(env.DB_SSL_REJECT_UNAUTHORIZED, true);
  if (env.NODE_ENV === 'production' && !rejectUnauthorized) {
    throw new Error('DB_SSL_REJECT_UNAUTHORIZED=false is not permitted in production');
  }
  return {
    rejectUnauthorized,
    ...(env.DB_SSL_CA_CERT ? { ca: String(env.DB_SSL_CA_CERT).replace(/\\n/g, '\n') } : {}),
  };
};

const buildConnectionConfig = (env = process.env) => {
  const ssl = buildSslConfig(env);
  if (env.DATABASE_URL) return { connectionString: env.DATABASE_URL, ssl };
  return {
    user: env.DB_USER || 'postgres',
    host: env.DB_HOST || 'localhost',
    database: env.DB_NAME || 'shura',
    password: env.DB_PASSWORD || '',
    port: Number.parseInt(env.DB_PORT || '5432', 10),
    ssl,
  };
};

module.exports = { buildConnectionConfig, buildSslConfig, parseBoolean };
