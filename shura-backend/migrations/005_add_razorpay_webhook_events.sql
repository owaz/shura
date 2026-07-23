CREATE TABLE IF NOT EXISTS razorpay_webhook_events (
  event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(120) NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_razorpay_webhook_events_received_at
  ON razorpay_webhook_events(received_at DESC);
