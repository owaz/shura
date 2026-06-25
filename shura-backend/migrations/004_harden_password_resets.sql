-- Store password reset tokens as hashes and support expiry lookups.

CREATE TABLE IF NOT EXISTS password_resets (
  email VARCHAR(255) PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64);
ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Drop any legacy plaintext tokens instead of carrying sensitive reset secrets forward.
ALTER TABLE password_resets DROP COLUMN IF EXISTS token;
DELETE FROM password_resets WHERE token_hash IS NULL OR expires_at IS NULL;
ALTER TABLE password_resets ALTER COLUMN token_hash SET NOT NULL;
ALTER TABLE password_resets ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at);
