-- Milestone 3: enrich approved therapist profiles for the authenticated client
-- portal and guarantee a single active therapist relationship per client.

ALTER TABLE therapists ADD COLUMN IF NOT EXISTS credentials TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS approach TEXT;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS faith_integration TEXT;
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS session_duration_options INTEGER[] NOT NULL DEFAULT ARRAY[50]::INTEGER[];
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE therapists DROP CONSTRAINT IF EXISTS therapists_session_duration_options_check;
ALTER TABLE therapists ADD CONSTRAINT therapists_session_duration_options_check
  CHECK (session_duration_options <@ ARRAY[30, 50, 80]::INTEGER[]);

-- Older installations can contain more than one active assignment. Preserve
-- the newest relationship and release the others before adding the invariant.
WITH ranked_assignments AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY client_id
           ORDER BY assigned_at DESC NULLS LAST, id DESC
         ) AS position
  FROM therapist_clients
  WHERE status = 'active'
)
UPDATE therapist_clients tc
SET status = 'released', updated_at = NOW()
FROM ranked_assignments ranked
WHERE tc.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_therapist_clients_one_active_per_client
  ON therapist_clients(client_id)
  WHERE status = 'active';
