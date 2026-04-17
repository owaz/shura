-- Shura Database Schema for Production
-- PostgreSQL Database Schema
-- Run this file in your production PostgreSQL database

-- ======================
-- USERS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ======================
-- THERAPISTS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS therapists (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  license_number VARCHAR(100),
  specialization TEXT,
  specialties TEXT[],
  bio TEXT,
  years_experience INTEGER,
  education TEXT,
  certifications TEXT,
  languages TEXT[],
  approach TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  profile_image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_therapists_email ON therapists(email);
CREATE INDEX IF NOT EXISTS idx_therapists_status ON therapists(status);

-- ======================
-- ADMINS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- ======================
-- INTAKE FORMS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS intake_forms (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  main_concerns TEXT,
  concern_severity VARCHAR(50),
  previous_therapy BOOLEAN DEFAULT false,
  previous_therapy_details TEXT,
  medications TEXT,
  medical_conditions TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(50),
  emergency_contact_relationship VARCHAR(100),
  insurance_provider VARCHAR(255),
  insurance_id VARCHAR(100),
  preferred_session_time VARCHAR(100),
  session_frequency VARCHAR(50),
  communication_preferences TEXT,
  cultural_considerations TEXT,
  goals TEXT,
  spiritual_beliefs TEXT,
  additional_notes TEXT,
  suicidal_thoughts BOOLEAN DEFAULT false,
  self_harm BOOLEAN DEFAULT false,
  substance_abuse BOOLEAN DEFAULT false,
  submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_forms_user_id ON intake_forms(user_id);
CREATE INDEX IF NOT EXISTS idx_intake_forms_submitted_at ON intake_forms(submitted_at);

-- ======================
-- INTAKE TOKENS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS intake_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  form_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_intake_tokens_token ON intake_tokens(token);
CREATE INDEX IF NOT EXISTS idx_intake_tokens_user_id ON intake_tokens(user_id);

-- ======================
-- THERAPIST CLIENTS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS therapist_clients (
  id SERIAL PRIMARY KEY,
  therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  UNIQUE(therapist_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_therapist_clients_therapist ON therapist_clients(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_clients_client ON therapist_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_therapist_clients_status ON therapist_clients(status);

-- ======================
-- BOOKINGS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time VARCHAR(10) NOT NULL,
  session_type VARCHAR(50) DEFAULT 'video',
  status VARCHAR(50) DEFAULT 'pending',
  payment_status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_therapist_id ON bookings(therapist_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- ======================
-- PAYMENTS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  call_id VARCHAR(255),
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  refunded_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_client_id ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_therapist_id ON payments(therapist_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- ======================
-- THERAPIST AVAILABILITY TABLE
-- ======================
CREATE TABLE IF NOT EXISTS therapist_availability (
  id SERIAL PRIMARY KEY,
  therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(therapist_id, day_of_week, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_therapist_availability_therapist_id ON therapist_availability(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_availability_day ON therapist_availability(day_of_week);

-- ======================
-- THERAPIST TIME OFF TABLE
-- ======================
CREATE TABLE IF NOT EXISTS therapist_time_off (
  id SERIAL PRIMARY KEY,
  therapist_id INTEGER REFERENCES therapists(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_therapist_time_off_therapist_id ON therapist_time_off(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_time_off_dates ON therapist_time_off(start_date, end_date);

-- ======================
-- NEWSLETTER TABLE
-- ======================
CREATE TABLE IF NOT EXISTS newsletter (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  subscribed BOOLEAN DEFAULT true,
  opt_in BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  unsubscribed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribed ON newsletter(subscribed);
