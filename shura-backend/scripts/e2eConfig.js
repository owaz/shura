const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(backendRoot, '..');
const backendEnvPath = path.join(backendRoot, '.env');
const frontendEnvPath = path.join(repositoryRoot, 'shura-frontend', '.env.local');

const frontendAllowedKeys = new Set([
  'VITE_API_URL',
  'VITE_WS_URL',
  'VITE_AUTH0_DOMAIN',
  'VITE_AUTH0_CLIENT_ID',
  'VITE_AUTH0_AUDIENCE',
]);

const requiredBackendKeys = [
  'PORT',
  'NODE_ENV',
  'AUTH0_DOMAIN',
  'AUTH0_AUDIENCE',
  'AUTH0_CLAIM_NAMESPACE',
  'FRONTEND_URL',
  'FRONTEND_URLS',
  'BACKEND_URL',
  'JWT_SECRET',
  'E2E_DATABASE_SAFE_TO_MUTATE',
  'E2E_CLIENT_AUTH0_SUB',
  'E2E_CLIENT_EMAIL',
  'E2E_THERAPIST_AUTH0_SUB',
  'E2E_THERAPIST_EMAIL',
  'E2E_ADMIN_AUTH0_SUB',
  'E2E_ADMIN_EMAIL',
];

const requiredFrontendKeys = [...frontendAllowedKeys];

const PLACEHOLDER_JWT_SECRET = 'generate-a-unique-random-secret-at-least-32-characters';

const isConfigured = (value) => typeof value === 'string' && value.trim().length > 0;
const normalizeDomain = (value = '') => value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return dotenv.parse(fs.readFileSync(filePath));
}

function parseUrl(value, key, errors) {
  try {
    return new URL(value);
  } catch {
    errors.push(`${key} must be a valid absolute URL.`);
    return null;
  }
}

function validateConfiguration(backend, frontend) {
  const errors = [];
  const warnings = [];

  if (!backend) errors.push('shura-backend/.env does not exist.');
  if (!frontend) errors.push('shura-frontend/.env.local does not exist.');
  if (!backend || !frontend) return { errors, warnings };

  for (const key of requiredBackendKeys) {
    if (!isConfigured(backend[key])) errors.push(`Backend variable ${key} is required.`);
  }
  for (const key of requiredFrontendKeys) {
    if (!isConfigured(frontend[key])) errors.push(`Frontend variable ${key} is required.`);
  }

  const usesDatabaseUrl = isConfigured(backend.DATABASE_URL);
  if (!usesDatabaseUrl) {
    for (const key of ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASSWORD', 'DB_PORT']) {
      if (!isConfigured(backend[key])) errors.push(`Backend variable ${key} is required when DATABASE_URL is empty.`);
    }
  }

  if ((backend.NODE_ENV || '').trim().toLowerCase() === 'production') {
    errors.push('NODE_ENV must not be production for local E2E tooling.');
  }
  if ((backend.E2E_DATABASE_SAFE_TO_MUTATE || '').trim().toLowerCase() !== 'true') {
    errors.push('E2E_DATABASE_SAFE_TO_MUTATE must be explicitly set to true.');
  }
  if (backend.AUTH0_CLAIM_NAMESPACE !== 'https://shura.com') {
    errors.push('AUTH0_CLAIM_NAMESPACE must match the deployed Auth0 Action namespace https://shura.com.');
  }

  for (const key of ['E2E_CLIENT_EMAIL', 'E2E_THERAPIST_EMAIL', 'E2E_ADMIN_EMAIL']) {
    if (isConfigured(backend[key]) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(backend[key])) {
      errors.push(`${key} must be a valid synthetic test-user email address.`);
    }
  }

  for (const key of Object.keys(frontend)) {
    if (!frontendAllowedKeys.has(key)) {
      errors.push(`Frontend variable ${key} is not allowlisted; keep secrets and provider configuration in the backend.`);
    }
  }

  if (normalizeDomain(backend.AUTH0_DOMAIN) !== normalizeDomain(frontend.VITE_AUTH0_DOMAIN)) {
    errors.push('AUTH0_DOMAIN and VITE_AUTH0_DOMAIN must refer to the same Auth0 tenant.');
  }
  if ((backend.AUTH0_AUDIENCE || '').trim() !== (frontend.VITE_AUTH0_AUDIENCE || '').trim()) {
    errors.push('AUTH0_AUDIENCE and VITE_AUTH0_AUDIENCE must match exactly.');
  }

  const apiUrl = isConfigured(frontend.VITE_API_URL)
    ? parseUrl(frontend.VITE_API_URL, 'VITE_API_URL', errors)
    : null;
  const wsUrl = isConfigured(frontend.VITE_WS_URL)
    ? parseUrl(frontend.VITE_WS_URL, 'VITE_WS_URL', errors)
    : null;
  const frontendUrl = isConfigured(backend.FRONTEND_URL)
    ? parseUrl(backend.FRONTEND_URL, 'FRONTEND_URL', errors)
    : null;
  const backendUrl = isConfigured(backend.BACKEND_URL)
    ? parseUrl(backend.BACKEND_URL, 'BACKEND_URL', errors)
    : null;

  if (apiUrl && apiUrl.port !== String(backend.PORT || '')) {
    errors.push('VITE_API_URL port must match backend PORT.');
  }
  if (wsUrl && apiUrl && wsUrl.origin !== apiUrl.origin) {
    errors.push('VITE_WS_URL and VITE_API_URL must use the same local origin.');
  }
  if (backendUrl && apiUrl && backendUrl.origin !== apiUrl.origin) {
    errors.push('BACKEND_URL and VITE_API_URL must use the same local origin.');
  }
  if (frontendUrl && frontendUrl.origin !== 'http://localhost:3006') {
    errors.push('FRONTEND_URL must be http://localhost:3006 for the documented Auth0 local callbacks.');
  }
  const allowedFrontendOrigins = (backend.FRONTEND_URLS || '').split(',').map((value) => value.trim());
  if (!allowedFrontendOrigins.includes('http://localhost:3006')) {
    errors.push('FRONTEND_URLS must include http://localhost:3006.');
  }

  if (isConfigured(backend.JWT_SECRET)) {
    const jwtSecret = backend.JWT_SECRET.trim();
    if (jwtSecret === PLACEHOLDER_JWT_SECRET) {
      errors.push('JWT_SECRET must not remain the .env.example placeholder value.');
    } else if (jwtSecret.length < 32) {
      errors.push('JWT_SECRET must contain at least 32 characters.');
    }
  }

  const phaseTwoGroups = [
    ['Auth0 M2M', ['AUTH0_M2M_CLIENT_ID', 'AUTH0_M2M_CLIENT_SECRET']],
    ['Razorpay test mode', ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']],
    ['Azure Storage', ['AZURE_STORAGE_ACCOUNT_NAME', 'AZURE_STORAGE_CONNECTION_STRING']],
    ['Email', [
      'RESEND_API_KEY',
      'RESEND_FROM_EMAIL',
      'RESEND_WEBHOOK_SECRET',
      'ADMIN_EMAIL',
      'EMAIL_OUTBOX_WORKER_ENABLED',
    ]],
  ];
  for (const [label, keys] of phaseTwoGroups) {
    if (keys.some((key) => !isConfigured(backend[key]))) {
      warnings.push(`${label} is not fully configured; its Phase 2 checks will remain unavailable.`);
    }
  }

  return { errors, warnings };
}

function mutationSafetyErrors(backend) {
  const errors = [];
  if (!backend) return ['shura-backend/.env does not exist.'];
  if ((backend.NODE_ENV || '').trim().toLowerCase() === 'production') {
    errors.push('NODE_ENV must not be production.');
  }
  if ((backend.E2E_DATABASE_SAFE_TO_MUTATE || '').trim().toLowerCase() !== 'true') {
    errors.push('E2E_DATABASE_SAFE_TO_MUTATE must be explicitly set to true.');
  }
  return errors;
}

function databaseConfig(env) {
  const sslEnabled = (env.DB_SSL || '').trim().toLowerCase() === 'true';

  if (isConfigured(env.DATABASE_URL)) {
    return {
      connectionString: env.DATABASE_URL,
      ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    };
  }
  return {
    user: env.DB_USER,
    host: env.DB_HOST,
    database: env.DB_NAME,
    password: env.DB_PASSWORD,
    port: Number(env.DB_PORT || 5432),
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  };
}

module.exports = {
  backendEnvPath,
  backendRoot,
  databaseConfig,
  frontendEnvPath,
  frontendAllowedKeys,
  isConfigured,
  loadEnvFile,
  mutationSafetyErrors,
  normalizeDomain,
  repositoryRoot,
  validateConfiguration,
};
