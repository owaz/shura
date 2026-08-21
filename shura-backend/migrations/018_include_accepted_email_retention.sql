CREATE INDEX IF NOT EXISTS idx_email_outbox_payload_retention
  ON email_outbox(updated_at, id)
  WHERE status IN ('sent', 'accepted', 'delivered', 'dead', 'bounced', 'complained')
    AND payload_purged_at IS NULL;
