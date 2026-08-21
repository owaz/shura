const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
  path.join(__dirname, '..', 'migrations', '017_email_delivery_hardening.sql'),
  'utf8'
);

test('email hardening migration preserves rolling compatibility', () => {
  for (const status of [
    'pending',
    'processing',
    'sent',
    'accepted',
    'delivered',
    'failed',
    'dead',
    'bounced',
    'complained',
  ]) {
    assert.match(migration, new RegExp(`'${status}'`));
  }

  assert.doesNotMatch(migration, /\bDROP\s+COLUMN\b/i);
  assert.doesNotMatch(migration, /\bRENAME\s+(?:COLUMN|TO)\b/i);
});

test('email hardening migration makes terminal payloads purgeable', () => {
  assert.match(migration, /ALTER COLUMN recipient DROP NOT NULL/i);
  assert.match(migration, /ALTER COLUMN subject DROP NOT NULL/i);
  assert.match(migration, /ALTER COLUMN html_body DROP NOT NULL/i);
  assert.match(migration, /payload_purged_at TIMESTAMPTZ/i);
  assert.match(migration, /idx_email_outbox_terminal_retention/i);
});

test('email hardening migration supports early webhook reconciliation', () => {
  assert.match(migration, /ALTER TABLE email_webhook_events[\s\S]*provider_message_id TEXT/i);
  assert.match(migration, /provider_event_at TIMESTAMPTZ/i);
  assert.match(migration, /idx_email_webhook_events_provider_message/i);
});
