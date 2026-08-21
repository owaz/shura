ALTER TABLE email_outbox
  DROP CONSTRAINT IF EXISTS email_outbox_status_check;

ALTER TABLE email_outbox
  ADD CONSTRAINT email_outbox_status_check
  CHECK (status IN (
    'pending',
    'processing',
    'sent',
    'accepted',
    'delivered',
    'failed',
    'dead',
    'bounced',
    'complained'
  ));

ALTER TABLE email_outbox
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS complained_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_event_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payload_purged_at TIMESTAMPTZ;

ALTER TABLE email_outbox
  ALTER COLUMN recipient DROP NOT NULL,
  ALTER COLUMN subject DROP NOT NULL,
  ALTER COLUMN html_body DROP NOT NULL;

ALTER TABLE email_webhook_events
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_event_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_outbox_provider_message_id
  ON email_outbox(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_outbox_terminal_retention
  ON email_outbox(updated_at, id)
  WHERE status IN ('sent', 'delivered', 'dead', 'bounced', 'complained')
    AND payload_purged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_webhook_events_provider_message
  ON email_webhook_events(provider_message_id, provider_event_at, received_at)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_webhook_events_retention
  ON email_webhook_events(received_at, event_id);
