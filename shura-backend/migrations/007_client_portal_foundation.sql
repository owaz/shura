-- Client portal foundation. This migration is intentionally additive so it can
-- be applied to an existing Shura installation without replacing legacy tables.

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS about_me VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Keep existing Auth0 clients out of onboarding; identities created after this
-- migration remain incomplete until the client completes the portal flow.
UPDATE users
SET onboarding_completed_at = NOW()
WHERE onboarding_completed_at IS NULL AND auth0_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS client_preferences (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  therapist_gender_preference VARCHAR(30) NOT NULL DEFAULT 'no_preference'
    CHECK (therapist_gender_preference IN ('female_only', 'male_only', 'no_preference')),
  languages TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  islamic_approach VARCHAR(30) NOT NULL DEFAULT 'no_preference'
    CHECK (islamic_approach IN ('faith_integrated', 'faith_aware', 'no_preference')),
  specialisation_interests TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  session_type_preference VARCHAR(30) NOT NULL DEFAULT 'no_preference'
    CHECK (session_type_preference IN ('video', 'audio', 'text', 'no_preference')),
  session_duration_preference VARCHAR(30) NOT NULL DEFAULT 'no_preference'
    CHECK (session_duration_preference IN ('30', '50', '80', 'no_preference')),
  preferred_days TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  preferred_time_of_day VARCHAR(30) NOT NULL DEFAULT 'no_preference'
    CHECK (preferred_time_of_day IN ('morning', 'afternoon', 'evening', 'night', 'no_preference')),
  notification_email_reminder_24h BOOLEAN NOT NULL DEFAULT TRUE,
  notification_email_reminder_1h BOOLEAN NOT NULL DEFAULT TRUE,
  notification_sms_reminder_1h BOOLEAN NOT NULL DEFAULT FALSE,
  notification_booking_confirmation BOOLEAN NOT NULL DEFAULT TRUE,
  notification_cancellation BOOLEAN NOT NULL DEFAULT TRUE,
  notification_platform_updates BOOLEAN NOT NULL DEFAULT TRUE,
  privacy_share_about_me BOOLEAN NOT NULL DEFAULT TRUE,
  privacy_allow_anonymised_data BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_preferences_client_id ON client_preferences(client_id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 50;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(20);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS video_room_id VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_duration_minutes_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_duration_minutes_check
  CHECK (duration_minutes IN (30, 50, 80));

-- Existing installations store date and time separately. The original timezone
-- was not retained, so legacy values are conservatively treated as UTC.
UPDATE bookings
SET scheduled_at = (date::timestamp + time::time) AT TIME ZONE 'UTC'
WHERE scheduled_at IS NULL AND date IS NOT NULL AND time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_client_scheduled_at ON bookings(user_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_therapist_scheduled_at ON bookings(therapist_id, scheduled_at);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_client_created ON notifications(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_client_unread ON notifications(client_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS islamic_quotes (
  id SERIAL PRIMARY KEY,
  arabic_text TEXT NOT NULL,
  english_translation TEXT NOT NULL,
  source VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_session_reviews (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_session_reviews_therapist ON client_session_reviews(therapist_id);

CREATE TABLE IF NOT EXISTS platform_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (setting_key, setting_value)
VALUES
  ('client_portal_features', '{"billingEnabled":true,"messagingEnabled":true,"videoProvider":"unconfigured"}'::JSONB),
  ('session_policies', '{"joinWindowMinutes":10,"rescheduleCutoffHours":24,"cancellationCutoffHours":24}'::JSONB)
ON CONFLICT (setting_key) DO NOTHING;
