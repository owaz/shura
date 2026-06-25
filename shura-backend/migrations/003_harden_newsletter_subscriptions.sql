-- Make newsletter subscriptions compatible across existing schemas and safer to update.

ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS subscribed BOOLEAN DEFAULT true;
ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS opt_in BOOLEAN DEFAULT false;
ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMP DEFAULT NOW();
ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMP;

UPDATE newsletter
SET subscribed = COALESCE(subscribed, unsubscribed_at IS NULL, true),
    opt_in = COALESCE(opt_in, false),
    updated_at = COALESCE(updated_at, created_at, subscribed_at, NOW());

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_email_unique ON newsletter(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribed ON newsletter(subscribed);
