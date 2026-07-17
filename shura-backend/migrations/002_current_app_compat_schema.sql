-- Align the production database with the routes currently used by the app.
-- This migration is intentionally additive/compatibility-focused so it can be
-- applied after the original production_schema.sql or after 001_create_bookings_payments.sql.

-- ==================== USERS PROFILE FIELDS ====================
ALTER TABLE users ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS spiritual_integration INTEGER DEFAULT 7;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(50) DEFAULT 'English';
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata';
ALTER TABLE users ADD COLUMN IF NOT EXISTS focus_areas TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT false;

-- ==================== THERAPIST APPLICATION FIELDS ====================
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS experience_years INTEGER;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS session_types TEXT[];
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS rate_60min INTEGER;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS availability TEXT[];
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS languages TEXT[];
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'therapists' AND column_name = 'years_experience'
  ) THEN
    EXECUTE 'UPDATE therapists SET experience_years = COALESCE(experience_years, years_experience) WHERE experience_years IS NULL';
  END IF;
END $$;

-- ==================== SESSIONS / PASSWORD RESET ====================
CREATE TABLE IF NOT EXISTS auth_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INTEGER NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('client', 'therapist')),
  refresh_token_hash TEXT NOT NULL,
  csrf_token TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_role ON auth_sessions(user_id, role);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_valid ON auth_sessions(id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS password_resets (
  email VARCHAR(255) PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);

-- ==================== INTAKE TOKENS / FORMS ====================
ALTER TABLE intake_tokens ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_tokens_user_unique ON intake_tokens(user_id);

-- Existing production_schema.sql used booleans/defaults for these fields, but the active
-- intake UI submits descriptive strings such as "Yes, currently".
ALTER TABLE intake_forms ALTER COLUMN suicidal_thoughts DROP DEFAULT;
ALTER TABLE intake_forms ALTER COLUMN previous_therapy DROP DEFAULT;
ALTER TABLE intake_forms ALTER COLUMN suicidal_thoughts TYPE TEXT USING suicidal_thoughts::text;
ALTER TABLE intake_forms ALTER COLUMN previous_therapy TYPE TEXT USING previous_therapy::text;

ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS has_children TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS children_details TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS living_situation TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS religious_practice TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS prayer_frequency TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS quran_engagement TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS community_involvement TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS concern_duration TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS therapy_goals TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS mood_symptoms TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS anxiety_symptoms TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS sleep_issues TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS appetite_issues TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS suicidal_details TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS trauma_history TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS trauma_impact TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS relationship_quality TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS relationship_difficulties TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS social_support TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS physical_health TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS current_medications TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS coping_mechanisms TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS spiritual_connection TEXT;
ALTER TABLE intake_forms ADD COLUMN IF NOT EXISTS additional_info TEXT;

-- ==================== CLIENT ASSIGNMENTS / CHAT ====================
ALTER TABLE therapist_clients ADD COLUMN IF NOT EXISTS assignment_source VARCHAR(50) DEFAULT 'manual';
ALTER TABLE therapist_clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, therapist_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_client ON conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_therapist ON conversations(therapist_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL,
  sender_role VARCHAR(20) NOT NULL DEFAULT 'client' CHECK (sender_role IN ('client', 'therapist')),
  content TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT,
  file_size INTEGER,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = false;

-- ==================== BOOKINGS / PAYMENTS COMPATIBILITY ====================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS time VARCHAR(10);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount_cents INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount_paise INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'client_id'
  ) THEN
    EXECUTE 'UPDATE bookings SET user_id = COALESCE(user_id, client_id) WHERE user_id IS NULL';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'booking_date'
  ) THEN
    EXECUTE 'UPDATE bookings SET date = COALESCE(date, booking_date::date) WHERE date IS NULL';
    EXECUTE 'UPDATE bookings SET time = COALESCE(time, TO_CHAR(booking_date, ''HH24:MI'')) WHERE time IS NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_therapist_date_time ON bookings(therapist_id, date, time);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_no_double_booking ON bookings(therapist_id, date, time) WHERE status != 'cancelled';

ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_cents INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'amount_inr'
  ) THEN
    EXECUTE 'UPDATE payments SET amount_cents = COALESCE(amount_cents, (amount_inr * 100)::integer) WHERE amount_cents IS NULL';
  END IF;
END $$;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'initiated', 'success', 'completed', 'failed', 'refunded'));

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_therapist_id ON payments(therapist_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments(razorpay_order_id);

CREATE TABLE IF NOT EXISTS payment_booking_intents (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(255) UNIQUE NOT NULL,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  booking_time VARCHAR(10) NOT NULL,
  session_type VARCHAR(50) NOT NULL DEFAULT 'video',
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'initiated',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_booking_intents_client ON payment_booking_intents(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_booking_intents_status ON payment_booking_intents(status);

-- ==================== THERAPIST AVAILABILITY / CALENDAR SYNC ====================
CREATE TABLE IF NOT EXISTS therapist_availability_rules (
  id SERIAL PRIMARY KEY,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_minutes INTEGER NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 15 AND 240),
  timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Kolkata',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(therapist_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS therapist_blocked_times (
  id SERIAL PRIMARY KEY,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_therapist_blocked_times_range ON therapist_blocked_times(therapist_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS therapist_calendar_integrations (
  id SERIAL PRIMARY KEY,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL,
  provider_account_id TEXT,
  provider_account_email TEXT,
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  scopes TEXT,
  expires_at TIMESTAMP,
  status VARCHAR(30) DEFAULT 'connected',
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(therapist_id, provider)
);

CREATE TABLE IF NOT EXISTS booking_calendar_events (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  integration_id INTEGER NOT NULL REFERENCES therapist_calendar_integrations(id) ON DELETE CASCADE,
  provider VARCHAR(30) NOT NULL,
  provider_event_id TEXT,
  provider_event_url TEXT,
  sync_status VARCHAR(30) DEFAULT 'pending',
  last_error TEXT,
  synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(booking_id, integration_id)
);
