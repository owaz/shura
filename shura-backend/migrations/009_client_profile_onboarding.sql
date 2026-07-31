-- Milestone 2: resumable client onboarding, profile lifecycle, and configurable
-- client-facing option lists. This migration remains additive and repeatable.

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_current_step INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_goals TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_notes VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_public_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_deletion_requested_at TIMESTAMPTZ;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_onboarding_current_step_check;
ALTER TABLE users ADD CONSTRAINT users_onboarding_current_step_check
  CHECK (onboarding_current_step BETWEEN 1 AND 5);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_gender_check;
ALTER TABLE users ADD CONSTRAINT users_gender_check
  CHECK (gender IS NULL OR gender IN ('male', 'female', 'prefer_not_to_say'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_emergency_relationship_check;
ALTER TABLE users ADD CONSTRAINT users_emergency_relationship_check
  CHECK (
    emergency_contact_relationship IS NULL OR
    emergency_contact_relationship IN ('spouse', 'parent', 'sibling', 'friend', 'other')
  );

INSERT INTO platform_settings (setting_key, setting_value)
VALUES
  (
    'client_profile_options',
    '{
      "languages":["Arabic","English","French","Hindi","Malay","Spanish","Turkish","Urdu"],
      "specialisations":["Anxiety","Depression","Trauma/PTSD","Grief","Relationships","Marriage/Couples","Parenting","Work Stress","Identity","OCD","Addiction","Chronic Illness"],
      "phoneCountryCodes":[
        {"code":"+971","label":"UAE (+971)"},
        {"code":"+966","label":"Saudi Arabia (+966)"},
        {"code":"+974","label":"Qatar (+974)"},
        {"code":"+965","label":"Kuwait (+965)"},
        {"code":"+973","label":"Bahrain (+973)"},
        {"code":"+968","label":"Oman (+968)"},
        {"code":"+44","label":"United Kingdom (+44)"},
        {"code":"+1","label":"United States / Canada (+1)"},
        {"code":"+91","label":"India (+91)"},
        {"code":"+92","label":"Pakistan (+92)"}
      ]
    }'::JSONB
  )
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = NOW();
