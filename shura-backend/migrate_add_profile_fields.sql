-- Migration to add profile fields to existing users table
-- Run this if you already have a users table without these columns

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS dob VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS spiritual_integration INTEGER DEFAULT 7;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(50) DEFAULT 'English';
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata';
ALTER TABLE users ADD COLUMN IF NOT EXISTS focus_areas TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT false;

SELECT 'Migration completed successfully!' as status;
