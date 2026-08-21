const REQUIRED_EMAIL_VARIABLES = [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'RESEND_WEBHOOK_SECRET',
  'ADMIN_EMAIL',
  'EMAIL_OUTBOX_WORKER_ENABLED',
];

const emailConfigurationErrors = (env = process.env) => {
  const errors = REQUIRED_EMAIL_VARIABLES
    .filter((key) => !String(env[key] || '').trim())
    .map((key) => `${key} must be configured`);
  if (env.RESEND_FROM_EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.RESEND_FROM_EMAIL)) {
    errors.push('RESEND_FROM_EMAIL must be a valid email address');
  }
  if (env.ADMIN_EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.ADMIN_EMAIL)) {
    errors.push('ADMIN_EMAIL must be a valid email address');
  }
  if (
    env.EMAIL_OUTBOX_WORKER_ENABLED
    && !['true', 'false'].includes(env.EMAIL_OUTBOX_WORKER_ENABLED)
  ) {
    errors.push('EMAIL_OUTBOX_WORKER_ENABLED must be true or false');
  }
  return errors;
};

const assertEmailConfiguration = (env = process.env) => {
  if (env.NODE_ENV !== 'production') return;
  const errors = emailConfigurationErrors(env);
  if (errors.length) throw new Error(`Invalid email configuration: ${errors.join('; ')}`);
};

module.exports = { assertEmailConfiguration, emailConfigurationErrors };
