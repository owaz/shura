-- Video calling foundation: video lifecycle, participant identity, and durable
-- webhook inbox. Keep booking session status authoritative and additive.

CREATE TABLE IF NOT EXISTS video_sessions (
  id BIGSERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  status VARCHAR(24) NOT NULL,
  status_reason VARCHAR(64),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  last_error_code VARCHAR(64),
  last_error_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE video_sessions DROP CONSTRAINT IF EXISTS video_sessions_status_check;
ALTER TABLE video_sessions ADD CONSTRAINT video_sessions_status_check
  CHECK (status IN (
    'scheduled',
    'provisioning',
    'ready',
    'live',
    'rejoinable',
    'ended',
    'cancelled',
    'expired',
    'failed'
  ));

CREATE INDEX IF NOT EXISTS idx_video_sessions_status
  ON video_sessions(status);
CREATE INDEX IF NOT EXISTS idx_video_sessions_updated_at
  ON video_sessions(updated_at DESC);

CREATE TABLE IF NOT EXISTS video_participants (
  id BIGSERIAL PRIMARY KEY,
  video_session_id BIGINT NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
  principal_role VARCHAR(20) NOT NULL,
  principal_id INTEGER NOT NULL CHECK (principal_id > 0),
  provider_user_id UUID NOT NULL,
  first_joined_at TIMESTAMPTZ,
  last_joined_at TIMESTAMPTZ,
  last_left_at TIMESTAMPTZ,
  connection_count INTEGER NOT NULL DEFAULT 0 CHECK (connection_count >= 0),
  total_connected_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_connected_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (video_session_id, principal_role, principal_id),
  UNIQUE (provider_user_id)
);

ALTER TABLE video_participants DROP CONSTRAINT IF EXISTS video_participants_principal_role_check;
ALTER TABLE video_participants ADD CONSTRAINT video_participants_principal_role_check
  CHECK (principal_role IN ('client', 'therapist'));

CREATE INDEX IF NOT EXISTS idx_video_participants_session_role
  ON video_participants(video_session_id, principal_role, principal_id);

CREATE TABLE IF NOT EXISTS video_webhook_events (
  provider VARCHAR(30) NOT NULL,
  provider_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  provider_room_name VARCHAR(255),
  provider_meeting_id VARCHAR(255),
  provider_participant_session_id VARCHAR(255),
  provider_user_id UUID,
  event_occurred_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  processing_status VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_code VARCHAR(64),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  PRIMARY KEY (provider, provider_event_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_video_webhook_events_participant_dedupe
  ON video_webhook_events(provider, event_type, provider_participant_session_id)
  WHERE provider_participant_session_id IS NOT NULL
    AND event_type IN ('participant.joined', 'participant.left');

CREATE INDEX IF NOT EXISTS idx_video_webhook_events_processing
  ON video_webhook_events(processing_status, next_attempt_at, received_at)
  WHERE processing_status IN ('pending', 'failed', 'processing');

CREATE INDEX IF NOT EXISTS idx_video_webhook_events_room_event_time
  ON video_webhook_events(provider_room_name, event_occurred_at, received_at);

-- Keep legacy `no-show` read-compatible while allowing explicit participant
-- no-show outcomes for new writes.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT DISTINCT c.conname
    FROM pg_constraint c
    LEFT JOIN unnest(c.conkey) AS key(attnum) ON TRUE
    LEFT JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = key.attnum
    WHERE c.conrelid = 'bookings'::regclass
      AND c.contype = 'c'
      AND (
        c.conname = 'bookings_status_check'
        OR a.attname = 'status'
      )
  LOOP
    EXECUTE format('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (
    status IS NULL OR LOWER(status) IN (
      'pending',
      'confirmed',
      'upcoming',
      'live',
      'completed',
      'cancelled',
      'no-show',
      'no_show_client',
      'no_show_therapist'
    )
  );
