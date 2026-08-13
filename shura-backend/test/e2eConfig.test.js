const test = require('node:test');
const assert = require('node:assert/strict');
const { databaseConfig, validateConfiguration } = require('../scripts/e2eConfig');

function validConfiguration() {
  return {
    backend: {
      PORT: '5001',
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://development-database',
      AUTH0_DOMAIN: 'shura-development.eu.auth0.com',
      AUTH0_AUDIENCE: 'https://api.shura.local',
      AUTH0_CLAIM_NAMESPACE: 'https://shura.com',
      FRONTEND_URL: 'http://localhost:3006',
      FRONTEND_URLS: 'http://localhost:3006',
      BACKEND_URL: 'http://localhost:5001',
      JWT_SECRET: 'a-development-secret-that-is-long-enough',
      E2E_DATABASE_SAFE_TO_MUTATE: 'true',
      E2E_CLIENT_AUTH0_SUB: 'auth0|client',
      E2E_CLIENT_EMAIL: 'client-e2e@example.test',
      E2E_THERAPIST_AUTH0_SUB: 'auth0|therapist',
      E2E_THERAPIST_EMAIL: 'therapist-e2e@example.test',
      E2E_ADMIN_AUTH0_SUB: 'auth0|admin',
      E2E_ADMIN_EMAIL: 'admin-e2e@example.test',
    },
    frontend: {
      VITE_API_URL: 'http://localhost:5001',
      VITE_WS_URL: 'http://localhost:5001',
      VITE_AUTH0_DOMAIN: 'shura-development.eu.auth0.com',
      VITE_AUTH0_CLIENT_ID: 'public-spa-client-id',
      VITE_AUTH0_AUDIENCE: 'https://api.shura.local',
    },
  };
}

test('accepts aligned development-only E2E configuration', () => {
  const config = validConfiguration();
  assert.deepEqual(validateConfiguration(config.backend, config.frontend).errors, []);
});

test('rejects secret-like or unknown frontend variables', () => {
  const config = validConfiguration();
  config.frontend.RAZORPAY_KEY_SECRET = 'must-not-be-here';
  assert.ok(validateConfiguration(config.backend, config.frontend).errors.some((error) =>
    error.includes('RAZORPAY_KEY_SECRET')
  ));
});

test('rejects mismatched Auth0 tenant and audience values', () => {
  const config = validConfiguration();
  config.frontend.VITE_AUTH0_DOMAIN = 'different.eu.auth0.com';
  config.frontend.VITE_AUTH0_AUDIENCE = 'https://different-api';
  const { errors } = validateConfiguration(config.backend, config.frontend);
  assert.ok(errors.some((error) => error.includes('same Auth0 tenant')));
  assert.ok(errors.some((error) => error.includes('must match exactly')));
});

test('requires explicit mutation safety and refuses production', () => {
  const config = validConfiguration();
  config.backend.NODE_ENV = 'production';
  config.backend.E2E_DATABASE_SAFE_TO_MUTATE = 'false';
  const { errors } = validateConfiguration(config.backend, config.frontend);
  assert.ok(errors.some((error) => error.includes('must not be production')));
  assert.ok(errors.some((error) => error.includes('explicitly set to true')));
});

test('rejects the .env.example JWT_SECRET placeholder and short secrets', () => {
  const config = validConfiguration();
  config.backend.JWT_SECRET = 'generate-a-unique-random-secret-at-least-32-characters';
  assert.ok(validateConfiguration(config.backend, config.frontend).errors.some((error) =>
    error.includes('placeholder')
  ));

  config.backend.JWT_SECRET = 'too-short';
  assert.ok(validateConfiguration(config.backend, config.frontend).errors.some((error) =>
    error.includes('at least 32 characters')
  ));
});

test('uses SSL when DB_SSL is enabled for Azure PostgreSQL', () => {
  const config = databaseConfig({
    DB_USER: 'shuraadmin',
    DB_HOST: 'shura-pg-dev.postgres.database.azure.com',
    DB_NAME: 'shura_production',
    DB_PASSWORD: 'super-secret',
    DB_PORT: '5432',
    DB_SSL: 'true',
  });

  assert.deepEqual(config.ssl, { rejectUnauthorized: false });
});
