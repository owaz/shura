-- Compatibility schema for the active Shura backend routes.
-- Safe to run repeatedly against the local development database.

ALTER TABLE admins ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE admins ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS experience_years INTEGER;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS years_experience INTEGER;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS specialization TEXT;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS specialties TEXT;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS session_types TEXT[];
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS rate_60min INTEGER DEFAULT 0;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS availability TEXT;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY['English'];
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS location VARCHAR(255);

CREATE TABLE IF NOT EXISTS intake_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS intake_forms (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marital_status VARCHAR(50),
  has_children VARCHAR(10),
  children_details TEXT,
  living_situation VARCHAR(100),
  religious_practice VARCHAR(100),
  prayer_frequency VARCHAR(100),
  quran_engagement TEXT,
  community_involvement TEXT,
  main_concerns TEXT,
  concern_duration VARCHAR(100),
  concern_severity INTEGER,
  therapy_goals TEXT,
  mood_symptoms JSONB,
  anxiety_symptoms JSONB,
  sleep_issues JSONB,
  appetite_issues JSONB,
  suicidal_thoughts VARCHAR(50),
  suicidal_details TEXT,
  trauma_history JSONB,
  trauma_impact VARCHAR(100),
  relationship_quality VARCHAR(100),
  relationship_difficulties JSONB,
  social_support VARCHAR(100),
  physical_health VARCHAR(50),
  medical_conditions TEXT,
  current_medications TEXT,
  previous_therapy VARCHAR(10),
  previous_therapy_details TEXT,
  medication BOOLEAN DEFAULT false,
  coping_mechanisms JSONB,
  spiritual_connection VARCHAR(100),
  additional_info TEXT,
  submitted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS therapist_clients (
  id SERIAL PRIMARY KEY,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'active',
  assignment_source VARCHAR(50) DEFAULT 'manual',
  notes TEXT,
  UNIQUE(therapist_id, client_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  last_message_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, therapist_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL,
  sender_role VARCHAR(20) DEFAULT 'client',
  content TEXT NOT NULL,
  file_url TEXT,
  file_type VARCHAR(100),
  file_size INTEGER,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time VARCHAR(10) NOT NULL,
  session_type VARCHAR(50) DEFAULT 'video',
  status VARCHAR(50) DEFAULT 'pending',
  payment_status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  status VARCHAR(50) DEFAULT 'pending',
  razorpay_order_id VARCHAR(255),
  razorpay_payment_id VARCHAR(255),
  payment_method VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  refunded_at TIMESTAMP
);

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

CREATE INDEX IF NOT EXISTS idx_intake_tokens_user_id ON intake_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_intake_tokens_token ON intake_tokens(token);
CREATE INDEX IF NOT EXISTS idx_intake_forms_user_id ON intake_forms(user_id);
CREATE INDEX IF NOT EXISTS idx_therapist_clients_therapist ON therapist_clients(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_clients_client ON therapist_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_client ON conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_therapist ON conversations(therapist_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_therapist_id ON bookings(therapist_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_therapist ON therapist_calendar_integrations(therapist_id);
CREATE INDEX IF NOT EXISTS idx_booking_calendar_events_booking ON booking_calendar_events(booking_id);
