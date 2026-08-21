const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertEmailConfiguration,
  emailConfigurationErrors,
} = require('../utils/emailConfig');

const valid = {
  NODE_ENV: 'production',
  RESEND_API_KEY: 're_test',
  RESEND_FROM_EMAIL: 'no-reply@notify.example.com',
  RESEND_WEBHOOK_SECRET: 'whsec_test',
  ADMIN_EMAIL: 'admin@example.com',
  EMAIL_OUTBOX_WORKER_ENABLED: 'true',
};

test('accepts complete Resend-only production configuration', () => {
  assert.deepEqual(emailConfigurationErrors(valid), []);
  assert.doesNotThrow(() => assertEmailConfiguration(valid));
});

test('fails production startup when required email configuration is absent', () => {
  const env = { ...valid };
  delete env.RESEND_API_KEY;
  delete env.EMAIL_OUTBOX_WORKER_ENABLED;

  assert.throws(
    () => assertEmailConfiguration(env),
    /RESEND_API_KEY must be configured.*EMAIL_OUTBOX_WORKER_ENABLED must be configured/
  );
});

test('rejects invalid sender and worker values', () => {
  const errors = emailConfigurationErrors({
    ...valid,
    RESEND_FROM_EMAIL: 'invalid',
    EMAIL_OUTBOX_WORKER_ENABLED: 'yes',
  });

  assert.ok(errors.includes('RESEND_FROM_EMAIL must be a valid email address'));
  assert.ok(errors.includes('EMAIL_OUTBOX_WORKER_ENABLED must be true or false'));
});

test('does not make optional local development fail at startup', () => {
  assert.doesNotThrow(() => assertEmailConfiguration({ NODE_ENV: 'development' }));
});
