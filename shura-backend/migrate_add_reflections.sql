-- Migration: Add reflections table for client therapy reflections
-- Run this file to add reflection functionality to existing database

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

SELECT 'Reflections table created successfully!' as status;
