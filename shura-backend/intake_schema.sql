-- Intake form tokens table
CREATE TABLE IF NOT EXISTS intake_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  UNIQUE(user_id)
);

-- Intake forms data table
CREATE TABLE IF NOT EXISTS intake_forms (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Personal & Background
  marital_status VARCHAR(50),
  has_children VARCHAR(10),
  children_details TEXT,
  living_situation VARCHAR(100),
  religious_practice VARCHAR(100),
  prayer_frequency VARCHAR(100),
  quran_engagement TEXT,
  community_involvement TEXT,
  
  -- Mental Health Concerns
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
  
  -- Health, Support & Background
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
  coping_mechanisms JSONB,
  spiritual_connection VARCHAR(100),
  additional_info TEXT,
  
  -- Metadata
  submitted_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_intake_tokens_user_id ON intake_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_intake_tokens_token ON intake_tokens(token);
CREATE INDEX IF NOT EXISTS idx_intake_forms_user_id ON intake_forms(user_id);

-- Comments for documentation
COMMENT ON TABLE intake_tokens IS 'Stores unique tokens for intake form links sent to clients';
COMMENT ON TABLE intake_forms IS 'Stores comprehensive client intake form responses for therapist review';
