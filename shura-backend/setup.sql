-- setup.sql - Shura Database Schema
-- Run this file to initialize the database

-- Create users table for client authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(255),
  dob VARCHAR(255),
  profile_picture TEXT,
  display_name VARCHAR(255),
  bio TEXT,
  spiritual_integration INTEGER DEFAULT 7,
  preferred_language VARCHAR(50) DEFAULT 'English',
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  focus_areas TEXT,
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create therapists table for therapist applications and profiles
CREATE TABLE IF NOT EXISTS therapists (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(255),
  license_number VARCHAR(255),
  experience_years INTEGER,
  specialties TEXT,
  session_types TEXT[], -- array of session types
  rate_60min INTEGER,
  availability TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create newsletter table for subscriptions
CREATE TABLE IF NOT EXISTS newsletter (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  opt_in BOOLEAN DEFAULT false,
  subscribed_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on email for faster queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter(email);

-- Admins table for admin portal authentication
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'admin',
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Reflections table for client therapy reflections
CREATE TABLE IF NOT EXISTS reflections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  reflection_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for user reflections
CREATE INDEX IF NOT EXISTS idx_reflections_user_id ON reflections(user_id);

-- Seed default admin (email: admin@shura.com, password: admin123)
INSERT INTO admins (email, password_hash, full_name, role)
VALUES (
  'admin@shura.com',
  '$2b$10$V5FIRn9EXe/ZcY4YC/kqSuCw2JrfgU7HDPIS9mY1JBcZJYCtaPDgm', -- bcrypt hash for "admin123"
  'Admin',
  'admin'
)
ON CONFLICT (email) DO NOTHING;

-- Success message
SELECT 'Database schema created successfully!' as status;
