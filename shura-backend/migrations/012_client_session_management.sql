-- Milestone 4: client session management, audit history, and refund state.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rescheduled_from TIMESTAMPTZ;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_amount_cents INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_status VARCHAR(30);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_refund_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_failure_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS client_session_events (
  id BIGSERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  actor VARCHAR(20) NOT NULL DEFAULT 'client',
  previous_scheduled_at TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_session_events_booking
  ON client_session_events(booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_session_events_client
  ON client_session_events(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_active_schedule
  ON bookings(therapist_id, scheduled_at)
  WHERE status NOT IN ('cancelled');

INSERT INTO platform_settings (setting_key, setting_value)
VALUES (
  'session_policies',
  '{"joinWindowMinutes":10,"rescheduleCutoffHours":24,"cancellationCutoffHours":24,"cancellationPolicyText":"Cancellations within 24 hours of the session are non-refundable."}'::JSONB
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value || platform_settings.setting_value;

