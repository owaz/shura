const pool = require('./index');

const VIDEO_SESSION_STATUSES = Object.freeze([
  'scheduled',
  'provisioning',
  'ready',
  'live',
  'rejoinable',
  'ended',
  'cancelled',
  'expired',
  'failed',
]);

const VIDEO_PARTICIPANT_ROLES = Object.freeze(['client', 'therapist']);
const VIDEO_WEBHOOK_PROCESSING_STATUSES = Object.freeze(['pending', 'processing', 'processed', 'failed']);
const VIDEO_SESSION_TERMINAL_STATUSES = Object.freeze(['ended', 'cancelled', 'expired']);
const VIDEO_WEBHOOK_PROCESSING_LEASE_SECONDS = 15 * 60;

const VIDEO_STATUS_TRANSITIONS = Object.freeze({
  scheduled: ['ready'],
  provisioning: ['scheduled', 'failed'],
  ready: ['provisioning'],
  live: ['ready', 'rejoinable'],
  rejoinable: ['live'],
  ended: ['ready', 'rejoinable', 'live'],
  cancelled: ['scheduled', 'provisioning', 'ready', 'live', 'rejoinable', 'failed'],
  expired: ['scheduled', 'ready', 'rejoinable'],
  failed: ['provisioning'],
});

const resolveTransitionSourceStatuses = (nextStatus, expectedCurrentStatuses = null) => {
  const allowed = VIDEO_STATUS_TRANSITIONS[nextStatus];
  if (!allowed) throw new Error(`No transition rule configured for status: ${nextStatus}`);
  if (!expectedCurrentStatuses) return allowed;
  if (!Array.isArray(expectedCurrentStatuses) || expectedCurrentStatuses.length === 0) {
    throw new Error('expectedCurrentStatuses must be a non-empty array');
  }
  for (const sourceStatus of expectedCurrentStatuses) {
    if (!VIDEO_SESSION_STATUSES.includes(sourceStatus)) {
      throw new Error(`Invalid expected status: ${sourceStatus}`);
    }
    if (!allowed.includes(sourceStatus)) {
      throw new Error(`Transition to ${nextStatus} is not allowed from ${sourceStatus}`);
    }
  }
  return expectedCurrentStatuses;
};

const createVideoSession = async ({ bookingId, status = 'scheduled', statusReason = null }, queryable = pool) => {
  if (!Number.isInteger(bookingId) || bookingId <= 0) throw new Error('bookingId must be a positive integer');
  if (!VIDEO_SESSION_STATUSES.includes(status)) throw new Error('Invalid video session status');
  const { rows } = await queryable.query(
    `INSERT INTO video_sessions (booking_id, status, status_reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (booking_id) DO UPDATE
     SET updated_at = NOW()
     RETURNING *`,
    [bookingId, status, statusReason]
  );
  return rows[0] || null;
};

const getVideoSessionByBookingId = async (bookingId, queryable = pool) => {
  if (!Number.isInteger(bookingId) || bookingId <= 0) throw new Error('bookingId must be a positive integer');
  const { rows } = await queryable.query(
    `SELECT *
     FROM video_sessions
     WHERE booking_id = $1`,
    [bookingId]
  );
  return rows[0] || null;
};

const updateVideoSessionStatus = async (
  {
    videoSessionId,
    status,
    statusReason = null,
    startedAt = null,
    endedAt = null,
    expectedCurrentStatuses = null,
  },
  queryable = pool
) => {
  if (!Number.isInteger(videoSessionId) || videoSessionId <= 0) {
    throw new Error('videoSessionId must be a positive integer');
  }
  if (!VIDEO_SESSION_STATUSES.includes(status)) throw new Error('Invalid video session status');
  const sourceStatuses = resolveTransitionSourceStatuses(status, expectedCurrentStatuses);
  const { rows } = await queryable.query(
    `UPDATE video_sessions
     SET status = $2,
         status_reason = $3,
         started_at = COALESCE($4, started_at),
         ended_at = COALESCE($5, ended_at),
         updated_at = NOW()
     WHERE id = $1
       AND status = ANY($6::text[])
       AND (
         $2 = ANY($7::text[])
         OR status <> ALL($8::text[])
       )
     RETURNING *`,
    [
      videoSessionId,
      status,
      statusReason,
      startedAt,
      endedAt,
      sourceStatuses,
      VIDEO_SESSION_TERMINAL_STATUSES,
      VIDEO_SESSION_TERMINAL_STATUSES,
    ]
  );
  return rows[0] || null;
};

const recordVideoSessionError = async ({ videoSessionId, errorCode, occurredAt = new Date() }, queryable = pool) => {
  if (!Number.isInteger(videoSessionId) || videoSessionId <= 0) {
    throw new Error('videoSessionId must be a positive integer');
  }
  if (!errorCode) throw new Error('errorCode is required');
  const { rows } = await queryable.query(
    `UPDATE video_sessions
     SET last_error_code = $2,
         last_error_at = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [videoSessionId, String(errorCode), occurredAt]
  );
  return rows[0] || null;
};

const upsertVideoParticipant = async (
  { videoSessionId, principalRole, principalId, providerUserId },
  queryable = pool
) => {
  if (!Number.isInteger(videoSessionId) || videoSessionId <= 0) {
    throw new Error('videoSessionId must be a positive integer');
  }
  if (!VIDEO_PARTICIPANT_ROLES.includes(principalRole)) throw new Error('Invalid principalRole');
  if (!Number.isInteger(principalId) || principalId <= 0) throw new Error('principalId must be a positive integer');
  if (!providerUserId) throw new Error('providerUserId is required');

  const { rows } = await queryable.query(
    `INSERT INTO video_participants (video_session_id, principal_role, principal_id, provider_user_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (video_session_id, principal_role, principal_id) DO UPDATE
     SET updated_at = NOW()
     RETURNING *`,
    [videoSessionId, principalRole, principalId, providerUserId]
  );
  return rows[0] || null;
};

const markParticipantJoined = async ({ videoParticipantId, joinedAt = new Date() }, queryable = pool) => {
  if (!Number.isInteger(videoParticipantId) || videoParticipantId <= 0) {
    throw new Error('videoParticipantId must be a positive integer');
  }
  const { rows } = await queryable.query(
    `UPDATE video_participants
     SET first_joined_at = COALESCE(first_joined_at, $2),
         last_joined_at = $2,
         connection_count = connection_count + 1,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [videoParticipantId, joinedAt]
  );
  return rows[0] || null;
};

const markParticipantLeft = async (
  { videoParticipantId, leftAt = new Date(), connectedSeconds = null },
  queryable = pool
) => {
  if (!Number.isInteger(videoParticipantId) || videoParticipantId <= 0) {
    throw new Error('videoParticipantId must be a positive integer');
  }
  if (connectedSeconds !== null && (!Number.isInteger(connectedSeconds) || connectedSeconds < 0)) {
    throw new Error('connectedSeconds must be null or a non-negative integer');
  }
  const { rows } = await queryable.query(
    `UPDATE video_participants
     SET last_left_at = $2,
         total_connected_seconds = total_connected_seconds + COALESCE($3, 0),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [videoParticipantId, leftAt, connectedSeconds]
  );
  return rows[0] || null;
};

const enqueueVideoWebhookEvent = async (event, queryable = pool) => {
  const {
    provider,
    providerEventId,
    eventType,
    providerRoomName = null,
    providerMeetingId = null,
    providerParticipantSessionId = null,
    providerUserId = null,
    eventOccurredAt = null,
    joinedAt = null,
    durationSeconds = null,
    processingStatus = 'pending',
    attemptCount = 0,
    nextAttemptAt = new Date(),
    errorCode = null,
    receivedAt = new Date(),
    processedAt = null,
  } = event || {};

  if (!provider || !providerEventId || !eventType) {
    throw new Error('provider, providerEventId, and eventType are required');
  }
  if (!Number.isInteger(attemptCount) || attemptCount < 0) {
    throw new Error('attemptCount must be a non-negative integer');
  }
  if (durationSeconds !== null && (!Number.isInteger(durationSeconds) || durationSeconds < 0)) {
    throw new Error('durationSeconds must be null or a non-negative integer');
  }
  if (!VIDEO_WEBHOOK_PROCESSING_STATUSES.includes(processingStatus)) {
    throw new Error('Invalid webhook processingStatus');
  }

  const { rows } = await queryable.query(
    `INSERT INTO video_webhook_events (
       provider, provider_event_id, event_type, provider_room_name, provider_meeting_id,
       provider_participant_session_id, provider_user_id, event_occurred_at, joined_at,
       duration_seconds, processing_status, attempt_count, next_attempt_at, error_code,
       received_at, processed_at
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9,
       $10, $11, $12, $13, $14,
       $15, $16
     )
     ON CONFLICT DO NOTHING
     RETURNING provider, provider_event_id`,
    [
      provider,
      providerEventId,
      eventType,
      providerRoomName,
      providerMeetingId,
      providerParticipantSessionId,
      providerUserId,
      eventOccurredAt,
      joinedAt,
      durationSeconds,
      processingStatus,
      attemptCount,
      nextAttemptAt,
      errorCode,
      receivedAt,
      processedAt,
    ]
  );

  return { queued: rows.length === 1, duplicate: rows.length === 0 };
};

const claimVideoWebhookEvents = async (
  limit = 20,
  queryable = pool,
  leaseSeconds = VIDEO_WEBHOOK_PROCESSING_LEASE_SECONDS
) => {
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('limit must be a positive integer');
  if (!Number.isInteger(leaseSeconds) || leaseSeconds <= 0) {
    throw new Error('leaseSeconds must be a positive integer');
  }
  const { rows } = await queryable.query(
    `WITH claim AS (
       SELECT provider, provider_event_id
       FROM video_webhook_events
       WHERE processing_status IN ('pending', 'failed', 'processing')
         AND next_attempt_at <= NOW()
       ORDER BY next_attempt_at ASC, received_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     )
     UPDATE video_webhook_events AS events
     SET processing_status = 'processing',
         attempt_count = events.attempt_count + 1,
         next_attempt_at = NOW() + ($2 * INTERVAL '1 second'),
         error_code = NULL
     FROM claim
     WHERE events.provider = claim.provider
       AND events.provider_event_id = claim.provider_event_id
     RETURNING events.*`,
    [limit, leaseSeconds]
  );
  return rows;
};

const markVideoWebhookProcessed = async (
  { provider, providerEventId, processedAt = new Date() },
  queryable = pool
) => {
  if (!provider || !providerEventId) throw new Error('provider and providerEventId are required');
  const { rows } = await queryable.query(
    `UPDATE video_webhook_events
     SET processing_status = 'processed',
         processed_at = $3,
        error_code = NULL,
        next_attempt_at = NOW()
     WHERE provider = $1
       AND provider_event_id = $2
     RETURNING *`,
    [provider, providerEventId, processedAt]
  );
  return rows[0] || null;
};

const markVideoWebhookFailed = async (
  { provider, providerEventId, errorCode, nextAttemptAt },
  queryable = pool
) => {
  if (!provider || !providerEventId) throw new Error('provider and providerEventId are required');
  if (!errorCode) throw new Error('errorCode is required');
  if (!nextAttemptAt) throw new Error('nextAttemptAt is required');
  const { rows } = await queryable.query(
    `UPDATE video_webhook_events
     SET processing_status = 'failed',
         error_code = $3,
        next_attempt_at = $4,
        processed_at = NULL
     WHERE provider = $1
       AND provider_event_id = $2
     RETURNING *`,
    [provider, providerEventId, String(errorCode), nextAttemptAt]
  );
  return rows[0] || null;
};

module.exports = {
  VIDEO_PARTICIPANT_ROLES,
  VIDEO_SESSION_STATUSES,
  VIDEO_WEBHOOK_PROCESSING_STATUSES,
  VIDEO_WEBHOOK_PROCESSING_LEASE_SECONDS,
  VIDEO_SESSION_TERMINAL_STATUSES,
  VIDEO_STATUS_TRANSITIONS,
  claimVideoWebhookEvents,
  createVideoSession,
  enqueueVideoWebhookEvent,
  getVideoSessionByBookingId,
  markParticipantJoined,
  markParticipantLeft,
  markVideoWebhookFailed,
  markVideoWebhookProcessed,
  recordVideoSessionError,
  updateVideoSessionStatus,
  upsertVideoParticipant,
};
