-- Milestone 7: client billing history and receipt query indexes.

CREATE INDEX IF NOT EXISTS idx_payments_client_created_id
  ON payments(client_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_payment_booking_intents_client_updated_id
  ON payment_booking_intents(client_id, updated_at DESC, id DESC);
