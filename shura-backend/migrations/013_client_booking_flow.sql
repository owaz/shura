-- Milestone 5: portal-native booking, duration-aware payment intents, covered
-- sessions, and database enforcement of non-overlapping active bookings.

ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_covered BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_kind VARCHAR(20) NOT NULL DEFAULT 'paid';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'INR';
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_kind_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_kind_check
  CHECK (payment_kind IN ('paid', 'free', 'covered'));

ALTER TABLE payment_booking_intents ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE payment_booking_intents ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 50;
ALTER TABLE payment_booking_intents ADD COLUMN IF NOT EXISTS client_timezone VARCHAR(80);
ALTER TABLE payment_booking_intents ADD COLUMN IF NOT EXISTS therapist_timezone VARCHAR(80);
ALTER TABLE payment_booking_intents ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'INR';
ALTER TABLE payment_booking_intents ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(255);
ALTER TABLE payment_booking_intents ADD COLUMN IF NOT EXISTS intent_source VARCHAR(30) NOT NULL DEFAULT 'legacy';
ALTER TABLE payment_booking_intents ADD COLUMN IF NOT EXISTS failure_code VARCHAR(80);
ALTER TABLE payment_booking_intents ADD COLUMN IF NOT EXISTS requires_refund BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE payment_booking_intents ADD COLUMN IF NOT EXISTS refund_status VARCHAR(30);
ALTER TABLE payment_booking_intents ADD COLUMN IF NOT EXISTS conflicted_at TIMESTAMPTZ;
ALTER TABLE payment_booking_intents ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

ALTER TABLE payment_booking_intents DROP CONSTRAINT IF EXISTS payment_booking_intents_source_check;
ALTER TABLE payment_booking_intents ADD CONSTRAINT payment_booking_intents_source_check
  CHECK (intent_source IN ('legacy', 'client_portal'));

ALTER TABLE payment_booking_intents DROP CONSTRAINT IF EXISTS payment_booking_intents_duration_check;
ALTER TABLE payment_booking_intents ADD CONSTRAINT payment_booking_intents_duration_check
  CHECK (duration_minutes IN (30, 50, 80));

UPDATE payment_booking_intents
SET scheduled_at = (booking_date::timestamp + booking_time::time) AT TIME ZONE 'Asia/Kolkata',
    client_timezone = COALESCE(client_timezone, 'Asia/Kolkata'),
    therapist_timezone = COALESCE(therapist_timezone, 'Asia/Kolkata')
WHERE scheduled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payment_booking_intents_client_updated
  ON payment_booking_intents(client_id, updated_at DESC);

-- Preserve historical rows without rewriting appointment state. The trigger
-- below serializes and validates every future insert or relevant update, so an
-- overlapping legacy row cannot be rescheduled or otherwise rewritten until
-- its conflict is resolved.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_active_time_overlap;

CREATE OR REPLACE FUNCTION prevent_active_booking_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.scheduled_at IS NULL OR LOWER(COALESCE(NEW.status, '')) = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- This namespace is also used by booking/rescheduling transactions. Taking
  -- it in the trigger protects writes from legacy or future code paths too.
  PERFORM pg_advisory_xact_lock(92005, NEW.therapist_id);

  IF EXISTS (
    SELECT 1
    FROM bookings existing
    WHERE existing.therapist_id = NEW.therapist_id
      AND existing.id <> COALESCE(NEW.id, 0)
      AND existing.scheduled_at IS NOT NULL
      AND LOWER(COALESCE(existing.status, '')) <> 'cancelled'
      AND tstzrange(
            existing.scheduled_at,
            existing.scheduled_at + make_interval(mins => existing.duration_minutes),
            '[)'
          ) && tstzrange(
            NEW.scheduled_at,
            NEW.scheduled_at + make_interval(mins => NEW.duration_minutes),
            '[)'
          )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'active booking overlaps an existing therapist booking';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_prevent_active_time_overlap ON bookings;
CREATE TRIGGER bookings_prevent_active_time_overlap
BEFORE INSERT OR UPDATE OF therapist_id, scheduled_at, duration_minutes, status
ON bookings
FOR EACH ROW EXECUTE FUNCTION prevent_active_booking_overlap();

INSERT INTO platform_settings (setting_key, setting_value)
VALUES ('client_portal_features', '{"billingEnabled":true,"paymentEnabled":true,"messagingEnabled":true,"videoProvider":"unconfigured"}'::JSONB)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = CASE
      WHEN platform_settings.setting_value ? 'paymentEnabled' THEN platform_settings.setting_value
      ELSE platform_settings.setting_value || '{"paymentEnabled":true}'::JSONB
    END,
    updated_at = NOW();
