const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isAllowedOrigin, assertProductionOrigins } = require('../utils/originPolicy');
const { buildConnectionConfig } = require('../db/connectionConfig');
const { deleteClientAccount } = require('../services/clientAccountDeletion');

process.env.AUTH0_DOMAIN ||= 'example.auth0.com';
process.env.AUTH0_AUDIENCE ||= 'https://api.example.test';
process.env.AUTH0_CLAIM_NAMESPACE ||= 'https://shura.com';
const { resolveRoleAndStatus } = require('../middleware/auth');

test('Auth0 access tokens fail closed without required role and status claims', () => {
  assert.throws(() => resolveRoleAndStatus({}), /missing required role or status claim/);
  assert.throws(() => resolveRoleAndStatus({
    'https://shura.com/role': 'owner',
    'https://shura.com/status': 'active',
  }), /unsupported role/);
  assert.throws(() => resolveRoleAndStatus({
    'https://shura.com/role': 'client',
    'https://shura.com/status': 'suspended',
  }), /not active/);
  assert.deepEqual(resolveRoleAndStatus({
    'https://shura.com/role': 'client',
    'https://shura.com/status': 'active',
  }), { role: 'client', status: 'active' });
});

test('production CORS accepts only explicitly configured origins', () => {
  const env = { NODE_ENV: 'production', FRONTEND_URL: 'https://app.example.com' };
  assert.equal(isAllowedOrigin('https://app.example.com/', env), true);
  assert.equal(isAllowedOrigin('https://attacker.azurecontainerapps.io', env), false);
  assert.equal(isAllowedOrigin('http://localhost:3006', env), false);
  assert.doesNotThrow(() => assertProductionOrigins(env));
  assert.throws(() => assertProductionOrigins({ NODE_ENV: 'production' }), /requires FRONTEND_URL/);
});

test('development CORS permits only the known local portal origins', () => {
  assert.equal(isAllowedOrigin('http://localhost:3006', { NODE_ENV: 'development' }), true);
  assert.equal(isAllowedOrigin('http://localhost:9999', { NODE_ENV: 'development' }), false);
});

test('production database TLS verifies certificates and cannot be disabled', () => {
  const config = buildConnectionConfig({
    NODE_ENV: 'production', DATABASE_URL: 'postgresql://example.invalid/shura', DB_SSL: 'true',
  });
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.throws(() => buildConnectionConfig({
    NODE_ENV: 'production', DATABASE_URL: 'postgresql://example.invalid/shura',
    DB_SSL: 'true', DB_SSL_REJECT_UNAUTHORIZED: 'false',
  }), /not permitted in production/);
  assert.throws(() => buildConnectionConfig({
    NODE_ENV: 'production', DATABASE_URL: 'postgresql://example.invalid/shura',
    DB_SSL: 'false',
  }), /DB_SSL=false is not permitted in production/);
});

test('therapist intake reads require an active assignment in SQL', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'therapist-intake.js'), 'utf8');
  const activeAssignmentPredicates = source.match(/therapist_id = \$[12] AND status = 'active'/g) || [];
  assert.equal(activeAssignmentPredicates.length, 2);
});

test('account deletion retains the marked local row until Auth0 deletion succeeds', async () => {
  const calls = [];
  const database = {
    query: async (sql) => {
      calls.push(sql);
      if (/UPDATE users/.test(sql)) return { rows: [{ profile_picture_blob_name: null, profile_picture_storage_provider: null }] };
      if (/DELETE FROM users/.test(sql)) return { rows: [] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  await assert.rejects(
    deleteClientAccount(
      { clientId: 4, auth0Sub: 'auth0|client' },
      {
        pool: database,
        setBlocked: async () => calls.push('blocked'),
        deleteAuth0User: async () => { calls.push('auth0-delete'); throw new Error('provider unavailable'); },
        deleteImage: async () => {},
      }
    ),
    /provider unavailable/
  );
  assert.equal(calls.some((value) => /DELETE FROM users/.test(value)), false);
  assert.equal(calls[1], 'blocked');
});

test('account deletion removes the local row only after Auth0 is removed', async () => {
  const calls = [];
  const database = {
    query: async (sql) => {
      calls.push(/UPDATE users/.test(sql) ? 'mark' : 'local-delete');
      return /UPDATE users/.test(sql)
        ? { rows: [{ profile_picture_blob_name: 'client/a.jpg', profile_picture_storage_provider: 'azure_blob' }] }
        : { rows: [] };
    },
  };
  await deleteClientAccount(
    { clientId: 4, auth0Sub: 'auth0|client' },
    {
      pool: database,
      setBlocked: async () => calls.push('blocked'),
      deleteAuth0User: async () => calls.push('auth0-delete'),
      deleteImage: async () => calls.push('image-delete'),
    }
  );
  assert.deepEqual(calls, ['mark', 'blocked', 'auth0-delete', 'local-delete', 'image-delete']);
});
